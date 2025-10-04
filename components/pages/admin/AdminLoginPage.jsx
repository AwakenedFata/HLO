"use client"

import { useState, useEffect } from "react"
import { Card, Alert, Spinner } from "react-bootstrap"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { FcGoogle } from "react-icons/fc"
import "@/styles/adminstyles.css"

function AdminLoginPage() {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()

  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam) {
      if (errorParam === "AccessDenied") {
        setError("Akses ditolak. Email Anda tidak memiliki izin untuk mengakses halaman admin.")
      } else if (errorParam === "Configuration") {
        setError("Terjadi kesalahan konfigurasi. Silakan hubungi administrator.")
      } else {
        setError("Terjadi kesalahan saat login. Silakan coba lagi.")
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (status === "authenticated" && session) {
      const callbackUrl = searchParams.get("callbackUrl") || "/admin/dashboard"
      router.push(callbackUrl)
    }
  }, [status, session, router, searchParams])

  const handleGoogleLogin = async () => {
    setError("")
    setLoading(true)

    try {
      const callbackUrl = searchParams.get("callbackUrl") || "/admin/dashboard"

      await signIn("google", {
        callbackUrl,
        redirect: true,
      })
    } catch (error) {
      console.error("Login error:", error)
      setError("Terjadi kesalahan saat login. Silakan coba lagi.")
      setLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="login-container">
        <Card className="login-card">
          <Card.Body className="text-center">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <p className="mt-3">Memeriksa status login...</p>
          </Card.Body>
        </Card>
      </div>
    )
  }

  return (
    <div className="login-container">
      <Card className="login-card">
        <Card.Body>
          <div className="text-center mb-4">
            <img src="/assets/logo footter.png" alt="Logo" style={{ maxWidth: "150px", marginBottom: "20px" }} />
            <h2>Admin Login</h2>
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="google-login-btn"
            style={{
              width: "100%",
              padding: "12px 24px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              fontSize: "16px",
              fontWeight: "500",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.3s ease",
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"
                e.currentTarget.style.borderColor = "#4285f4"
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none"
              e.currentTarget.style.borderColor = "#ddd"
            }}
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" />
                <span>Menghubungkan...</span>
              </>
            ) : (
              <>
                <FcGoogle size={24} />
                <span>Masuk dengan Google</span>
              </>
            )}
          </button>

          <div className="text-center mt-4">
            <small className="text-muted">Hanya admin yang dapat mengakses halaman ini</small>
          </div>
        </Card.Body>
      </Card>
    </div>
  )
}

export default AdminLoginPage
