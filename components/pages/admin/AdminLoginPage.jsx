"use client"

import { useState, useEffect, useRef } from "react"
import { Form, Button, Card, Alert } from "react-bootstrap"
import { useRouter } from "next/navigation"
import axios from "axios"
import "@/styles/adminstyles.css"

function AdminLoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [cooldownTime, setCooldownTime] = useState(0)
  const [isInCooldown, setIsInCooldown] = useState(false)
  const cooldownTimerRef = useRef(null)
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Cleanup timer saat komponen unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isClient) return
    const storedCooldownEnd = localStorage.getItem("loginCooldownEnd")

    if (storedCooldownEnd) {
      const cooldownEnd = Number.parseInt(storedCooldownEnd, 10)
      const now = Date.now()

      if (cooldownEnd > now) {
        // Masih dalam cooldown period
        const remainingSeconds = Math.ceil((cooldownEnd - now) / 1000)
        startCooldown(remainingSeconds)
      } else {
        // Cooldown sudah berakhir, hapus data
        localStorage.removeItem("loginCooldownEnd")
      }
    }
  }, [isClient])

  // Fungsi untuk memformat pesan error dari API
  const formatApiError = (error) => {
    if (!error.response) {
      return "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
    }

    if (error.response.status === 429) {
      const retryAfter =
        error.response.headers["retry-after"] || error.response.data.retryAfter || error.response.data.reset || 60
      return `Terlalu banyak percobaan login. Silakan coba lagi dalam ${retryAfter} detik.`
    }

    return (
      error.response.data?.message || error.response.data?.error || "Login gagal. Periksa username dan password Anda."
    )
  }

  // Fungsi untuk memulai cooldown
  const startCooldown = (seconds) => {
    setIsInCooldown(true)
    setCooldownTime(seconds)

    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current)
    }

    cooldownTimerRef.current = setInterval(() => {
      setCooldownTime((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(cooldownTimerRef.current)
          setIsInCooldown(false)
          return 0
        }
        return prevTime - 1
      })
    }, 1000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    // Validasi input
    if (!username || !password) {
      setError("Username dan password harus diisi")
      return
    }

    // Cek apakah dalam cooldown period
    if (isInCooldown) {
      setError(`Terlalu banyak percobaan login. Silakan coba lagi dalam ${cooldownTime} detik.`)
      return
    }

    setLoading(true)
    try {
      console.log("Attempting login to:", `/api/auth/login`)
      const response = await axios.post(
        `/api/auth/login`,
        {
          username,
          password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        },
      )

      console.log("Login response:", response.data)

      // Reset cooldown pada login berhasil
      localStorage.removeItem("loginCooldownEnd")

      if (typeof window !== "undefined") {
        sessionStorage.setItem("adminToken", response.data.token)
        sessionStorage.setItem("adminUsername", username)

        // Store profile image if available
        if (response.data.admin && response.data.admin.profileImage) {
          sessionStorage.setItem("adminProfileImage", response.data.admin.profileImage)
        }
      }

      // Clear any cached data to ensure fresh data on login
      localStorage.removeItem("pending_pins_cache")
      localStorage.removeItem("dashboard_stats_cache")
      localStorage.removeItem("admin_pending_count_cache")

      router.push("/admin/dashboard")
    } catch (error) {
      console.error("Login error:", error)

      // Penanganan khusus untuk error 429
      if (error.response?.status === 429) {
        // Ambil retry-after header jika ada, atau dari response data
        const retryAfter =
          error.response.headers["retry-after"] || error.response.data.retryAfter || error.response.data.reset || 60 // Default 60 detik

        const waitTime = Number.parseInt(retryAfter, 10)

        setError(formatApiError(error))
        startCooldown(waitTime)

        // Simpan waktu cooldown berakhir
        const cooldownEnd = Date.now() + waitTime * 1000
        localStorage.setItem("loginCooldownEnd", cooldownEnd.toString())
      } else {
        // Untuk error lainnya
        setError(formatApiError(error))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <Card className="login-card">
        <Card.Body>
          <h2>Admin Login</h2>

          {error && <Alert variant="danger">{error}</Alert>}

          {isInCooldown && (
            <Alert variant="warning">
              Terlalu banyak percobaan login. Silakan coba lagi dalam {cooldownTime} detik.
            </Alert>
          )}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-4">
              <Form.Label>Username</Form.Label>
              <Form.Control
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
                className="form-control-lg"
                disabled={isInCooldown || loading}
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                className="form-control-lg"
                disabled={isInCooldown || loading}
              />
            </Form.Group>

            <Button variant="primary" type="submit" className="w-100 py-2 mt-2" disabled={loading || isInCooldown}>
              {loading ? "Loading..." : isInCooldown ? `Coba lagi dalam ${cooldownTime}s` : "Login"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  )
}

export default AdminLoginPage
