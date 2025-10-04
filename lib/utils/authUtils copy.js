// lib/utils/auth-utils.js
import axios from "axios"
import {
  refreshAuthToken,
  logout as clientLogout,
  getToken,
  isAuthenticated,
  createAuthenticatedAxios,
} from "./auth-client"

// Fungsi untuk memeriksa apakah token masih valid
export const isTokenValid = () => {
  const token = sessionStorage.getItem("adminToken")
  if (!token) return false

  try {
    // Decode token (tanpa verifikasi signature)
    const base64Url = token.split(".")[1]
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const payload = JSON.parse(window.atob(base64))

    // Cek apakah token sudah expired
    const currentTime = Date.now() / 1000
    return payload.exp > currentTime
  } catch (error) {
    console.error("Error checking token validity:", error)
    return false
  }
}

// Fungsi untuk logout
export const logout = (navigate) => {
  clientLogout().then(() => {
    if (navigate) {
      navigate("/admin/login")
    } else if (typeof window !== "undefined") {
      window.location.href = "/admin/login"
    }
  })
}

// Fungsi untuk setup auto-logout setelah periode tidak aktif
export const setupInactivityTimer = (logoutCallback, timeoutMinutes = 15) => {
  if (typeof window === "undefined") return () => {}

  let inactivityTimer

  const resetTimer = () => {
    clearTimeout(inactivityTimer)
    inactivityTimer = setTimeout(
      () => {
        // Auto logout setelah periode tidak aktif
        if (sessionStorage.getItem("adminToken")) {
          console.log("Auto logout karena tidak aktif")
          if (logoutCallback) {
            logoutCallback()
          } else {
            logout()
          }
        }
      },
      timeoutMinutes * 60 * 1000,
    ) // Konversi menit ke milidetik
  }

  // Reset timer saat ada aktivitas
  const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"]
  events.forEach((event) => {
    document.addEventListener(event, resetTimer)
  })

  // Setup timer awal
  resetTimer()

  // Fungsi untuk cleanup
  return () => {
    clearTimeout(inactivityTimer)
    events.forEach((event) => {
      document.removeEventListener(event, resetTimer)
    })
  }
}

// Fungsi untuk memeriksa validitas token dengan API
export const checkTokenValidity = async () => {
  if (typeof window === "undefined") return false

  const token = sessionStorage.getItem("adminToken")
  if (!token) return false

  // Cek apakah token sudah kedaluwarsa berdasarkan waktu expiry yang disimpan
  const tokenExpiry = sessionStorage.getItem("tokenExpiry")
  if (tokenExpiry) {
    const expiryTime = Number.parseInt(tokenExpiry, 10)
    const now = Date.now()

    // Jika token akan kedaluwarsa dalam 5 menit, refresh
    if (expiryTime - now < 5 * 60 * 1000) {
      // Coba refresh token
      return await refreshAuthToken()
    }

    // Token masih valid
    return expiryTime > now
  }

  // Jika tidak ada informasi expiry, cek dengan API
  try {
    const response = await axios.get("/api/auth/verify-token", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data.valid
  } catch (error) {
    console.error("Error verifying token:", error)
    return false
  }
}

// Fungsi untuk setup token refresh timer
export const setupTokenRefreshTimer = () => {
  if (typeof window === "undefined") return

  const tokenExpiry = sessionStorage.getItem("tokenExpiry")
  if (!tokenExpiry) return

  const expiryTime = Number.parseInt(tokenExpiry, 10)
  const now = Date.now()

  // Refresh 1 menit sebelum token kedaluwarsa
  const timeToRefresh = expiryTime - now - 60000

  if (timeToRefresh > 0) {
    // Hapus timer yang sudah ada jika ada
    const existingTimerId = sessionStorage.getItem("tokenRefreshTimerId")
    if (existingTimerId) {
      clearTimeout(Number.parseInt(existingTimerId, 10))
    }

    // Set timer baru
    const timerId = setTimeout(async () => {
      await refreshAuthToken()
    }, timeToRefresh)

    // Simpan ID timer untuk bisa dihapus nanti
    sessionStorage.setItem("tokenRefreshTimerId", timerId.toString())
  }
}

// Export fungsi dari auth-client untuk konsistensi
export { refreshAuthToken, getToken, isAuthenticated, createAuthenticatedAxios }

// Fungsi untuk mendapatkan axios instance dengan token
export const getAuthenticatedAxios = () => {
  return createAuthenticatedAxios()
}
