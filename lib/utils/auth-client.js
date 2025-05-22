"use client"

import jwt from "jsonwebtoken"
import logger from "@/lib/utils/logger-client"
import axios from "axios"

// Sign JWT token (client-side version)
export const signToken = (id) => {
  return jwt.sign({ id }, process.env.NEXT_PUBLIC_JWT_SECRET, {
    expiresIn: process.env.NEXT_PUBLIC_JWT_EXPIRES_IN || "1h",
  })
}

// Get token from localStorage or cookies (client-side)
export const getToken = () => {
  if (typeof window !== "undefined") {
    return sessionStorage.getItem("adminToken") || localStorage.getItem("token") || getCookieValue("jwt")
  }
  return null
}

// Get cookie value by name
export const getCookieValue = (name) => {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"))
    return match ? match[2] : null
  }
  return null
}

// Set token in localStorage and cookie
export const setToken = (token) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token)
    document.cookie = `jwt=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Strict`
  }
}

// Remove token from localStorage and cookie
export const removeToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token")
    sessionStorage.removeItem("adminToken")
    sessionStorage.removeItem("adminUsername")
    sessionStorage.removeItem("adminProfileImage")
    sessionStorage.removeItem("tokenExpiry")
    sessionStorage.removeItem("refreshToken")
    sessionStorage.removeItem("tokenRefreshTimerId")
    sessionStorage.removeItem("isRefreshing")
    document.cookie = "jwt=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT"
    document.cookie = "refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT"
  }
}

// Check if user is authenticated
export const isAuthenticated = () => {
  if (typeof window === "undefined") return false

  const token = getToken()
  if (!token) return false

  // Cek apakah token sudah kedaluwarsa
  const tokenExpiry = sessionStorage.getItem("tokenExpiry")
  if (tokenExpiry) {
    const expiryTime = Number.parseInt(tokenExpiry, 10)
    const now = Date.now()
    if (expiryTime <= now) {
      // Token sudah kedaluwarsa, coba refresh
      refreshAuthToken()
      return false
    }
  }

  return true
}

// Get user info from token
export const getUserFromToken = () => {
  const token = getToken()
  if (!token) return null

  try {
    const decoded = jwt.decode(token)
    return decoded
  } catch (error) {
    logger.error(`Error decoding token: ${error.message}`)
    return null
  }
}

// Fungsi untuk refresh token
export const refreshAuthToken = async () => {
  if (typeof window === "undefined") return false

  // Cek apakah sedang dalam proses refresh
  if (sessionStorage.getItem("isRefreshing") === "true") {
    // Tunggu hingga proses refresh selesai
    return new Promise((resolve) => {
      const checkRefreshStatus = setInterval(() => {
        if (sessionStorage.getItem("isRefreshing") !== "true") {
          clearInterval(checkRefreshStatus)
          resolve(sessionStorage.getItem("adminToken") !== null)
        }
      }, 100)
    })
  }

  // Set flag bahwa sedang dalam proses refresh
  sessionStorage.setItem("isRefreshing", "true")

  const refreshToken = sessionStorage.getItem("refreshToken")
  if (!refreshToken) {
    sessionStorage.removeItem("isRefreshing")
    return false
  }

  try {
    const response = await axios.post("/api/auth/refresh-token", {
      refreshToken,
    })

    if (response.data.token) {
      // Simpan token baru
      const expiresIn = process.env.NEXT_PUBLIC_JWT_EXPIRES_IN
        ? Number.parseInt(process.env.NEXT_PUBLIC_JWT_EXPIRES_IN)
        : 3600

      const expiryTime = Date.now() + expiresIn * 1000

      // Simpan token di sessionStorage
      sessionStorage.setItem("adminToken", response.data.token)
      sessionStorage.setItem("tokenExpiry", expiryTime.toString())

      // Simpan refresh token baru jika ada
      if (response.data.refreshToken) {
        sessionStorage.setItem("refreshToken", response.data.refreshToken)
      }

      // Juga simpan di localStorage dan cookie untuk kompatibilitas
      setToken(response.data.token)

      // Log refresh token berhasil
      logger.info("Token berhasil diperbarui")

      // Setup timer untuk refresh token berikutnya
      setupTokenRefreshTimer()

      // Reset flag refresh
      sessionStorage.removeItem("isRefreshing")

      return true
    }
  } catch (error) {
    logger.error(`Gagal memperbarui token: ${error.message}`)

    // Reset flag refresh
    sessionStorage.removeItem("isRefreshing")

    return false
  }

  // Reset flag refresh
  sessionStorage.removeItem("isRefreshing")

  return false
}

// Setup timer untuk refresh token
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

// Login function
export const login = async (username, password) => {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    })

    const data = await response.json()

    if (response.ok) {
      // Simpan token di localStorage dan cookie
      setToken(data.token)

      // Simpan token di sessionStorage dengan informasi expiry
      const expiresIn = process.env.NEXT_PUBLIC_JWT_EXPIRES_IN
        ? Number.parseInt(process.env.NEXT_PUBLIC_JWT_EXPIRES_IN)
        : 3600

      const expiryTime = Date.now() + expiresIn * 1000

      sessionStorage.setItem("adminToken", data.token)
      sessionStorage.setItem("tokenExpiry", expiryTime.toString())

      // Simpan refresh token jika ada
      if (data.refreshToken) {
        sessionStorage.setItem("refreshToken", data.refreshToken)
      }

      // Simpan informasi user
      sessionStorage.setItem("adminUsername", username)

      // Simpan profile image jika ada
      if (data.admin && data.admin.profileImage) {
        sessionStorage.setItem("adminProfileImage", data.admin.profileImage)
      }

      // Setup timer untuk refresh token
      setupTokenRefreshTimer()

      return { success: true, data }
    } else {
      return { success: false, error: data.message || "Login failed" }
    }
  } catch (error) {
    logger.error(`Login error: ${error.message}`)
    return { success: false, error: "Network error" }
  }
}

// Logout function
export const logout = async () => {
  try {
    const token = getToken()
    const refreshToken = sessionStorage.getItem("refreshToken")

    // Hapus timer refresh token
    const existingTimerId = sessionStorage.getItem("tokenRefreshTimerId")
    if (existingTimerId) {
      clearTimeout(Number.parseInt(existingTimerId, 10))
      sessionStorage.removeItem("tokenRefreshTimerId")
    }

    if (token) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      })
    }

    removeToken()

    // Hapus cache
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("pending_pins_") || key.startsWith("dashboard_") || key.includes("_cache")) {
        localStorage.removeItem(key)
      }
    })

    return { success: true }
  } catch (error) {
    logger.error(`Logout error: ${error.message}`)
    return { success: false, error: "Logout failed" }
  }
}

// Buat axios instance dengan interceptor untuk auto refresh token
export const createAuthenticatedAxios = () => {
  const instance = axios.create()

  // Tambahkan interceptor untuk request
  instance.interceptors.request.use(
    async (config) => {
      // Cek apakah token masih valid
      if (!isAuthenticated()) {
        // Coba refresh token
        const refreshed = await refreshAuthToken()
        if (!refreshed) {
          // Jika refresh gagal, redirect ke login
          if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
            window.location.href = "/admin/login"
          }
          return Promise.reject(new Error("Token kedaluwarsa"))
        }
      }

      // Tambahkan token ke header
      const token = getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      return config
    },
    (error) => Promise.reject(error),
  )

  // Tambahkan interceptor untuk response
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config

      // Jika error 401 dan belum pernah retry
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true

        // Coba refresh token
        const refreshed = await refreshAuthToken()
        if (refreshed) {
          // Jika berhasil, ulangi request
          const token = getToken()
          originalRequest.headers.Authorization = `Bearer ${token}`
          return instance(originalRequest)
        } else {
          // Jika gagal, logout
          await logout()
          if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
            window.location.href = "/admin/login"
          }
        }
      }

      return Promise.reject(error)
    },
  )

  return instance
}

// Fungsi untuk mendapatkan authenticated axios instance
export const getAuthenticatedAxios = () => {
  return createAuthenticatedAxios()
}
