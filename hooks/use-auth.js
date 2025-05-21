"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"

/**
 * Custom hook for authentication management
 * Handles token validation, refresh, and redirection
 */
export default function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState(null)
  const router = useRouter()

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      setIsLoading(true)

      try {
        const token = sessionStorage.getItem("adminToken")

        if (!token) {
          setIsAuthenticated(false)
          setIsLoading(false)
          router.push("/admin/login")
          return
        }

        // Verify token with backend
        const response = await axios.get("/api/auth/verify-token", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.data.valid) {
          setIsAuthenticated(true)
          setUser(response.data.admin || null)
        } else {
          // Try to refresh token
          const refreshed = await refreshToken()
          if (!refreshed) {
            setIsAuthenticated(false)
            sessionStorage.removeItem("adminToken")
            sessionStorage.removeItem("refreshToken")
            router.push("/admin/login")
          }
        }
      } catch (error) {
        console.error("Token verification error:", error)
        // Try to refresh token on error
        const refreshed = await refreshToken()

        if (!refreshed) {
          setIsAuthenticated(false)
          sessionStorage.removeItem("adminToken")
          sessionStorage.removeItem("refreshToken")
          router.push("/admin/login")
        }
      } finally {
        setIsLoading(false)
      }
    }

    verifyToken()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Function to refresh token
  const refreshToken = useCallback(async () => {
    try {
      const refreshToken = sessionStorage.getItem("refreshToken")

      if (!refreshToken) {
        return false
      }

      const response = await axios.post("/api/auth/refresh-token", {
        refreshToken,
      })

      if (response.data.token) {
        sessionStorage.setItem("adminToken", response.data.token)
        if (response.data.refreshToken) {
          sessionStorage.setItem("refreshToken", response.data.refreshToken)
        }
        setIsAuthenticated(true)
        setUser(response.data.admin || null)
        return true
      }

      return false
    } catch (error) {
      console.error("Token refresh error:", error)
      return false
    }
  }, [])

  // Function to handle API calls with automatic token refresh
  const authFetch = useCallback(
    async (apiCall) => {
      try {
        return await apiCall()
      } catch (error) {
        if (error.response?.status === 401) {
          // Try to refresh token
          const refreshed = await refreshToken()

          if (refreshed) {
            // Retry the API call with new token
            return await apiCall()
          } else {
            // Redirect to login if refresh fails
            setIsAuthenticated(false)
            sessionStorage.removeItem("adminToken")
            sessionStorage.removeItem("refreshToken")
            router.push("/admin/login")
            throw new Error("Authentication failed")
          }
        }

        throw error
      }
    },
    [refreshToken, router],
  )

  // Function to logout
  const logout = useCallback(async () => {
    try {
      const token = sessionStorage.getItem("adminToken")

      if (token) {
        await axios.post("/api/auth/logout", null, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      }
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      sessionStorage.removeItem("adminToken")
      sessionStorage.removeItem("refreshToken")
      setIsAuthenticated(false)
      setUser(null)
      router.push("/admin/login")
    }
  }, [router])

  return {
    isAuthenticated,
    isLoading,
    user,
    refreshToken,
    authFetch,
    logout,
  }
}
