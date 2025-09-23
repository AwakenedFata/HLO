"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  FaChartPie,
  FaKey,
  FaHistory,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaRegImages,
  FaCamera,
  FaExclamationCircle,
} from "react-icons/fa"
import { RiArticleFill } from "react-icons/ri";
import axios from "axios"
import Image from "next/image"
import "@/styles/adminstyles.css"
import { Alert } from "react-bootstrap"
import { checkTokenValidity, setupTokenRefreshTimer } from "@/lib/utils/authUtils"

// Cache keys
const CACHE_KEYS = {
  PENDING_PINS: "pending_pins_cache",
  PENDING_PINS_LAST_FETCH: "pending_pins_last_fetch",
  DASHBOARD_STATS: "dashboard_stats_cache",
  DASHBOARD_STATS_LAST_FETCH: "dashboard_stats_last_fetch",
  ADMIN_PENDING_COUNT: "admin_pending_count_cache",
  ADMIN_PENDING_COUNT_LAST_FETCH: "admin_pending_count_last_fetch",
}

function AdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [profileImage, setProfileImage] = useState("/logohok2.png")
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [adminUsername, setAdminUsername] = useState("")
  const [isClient, setIsClient] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [authError, setAuthError] = useState(false)
  const [isRefreshingToken, setIsRefreshingToken] = useState(false)
  const [isMobile, setIsMobile] = useState(false) // Add state to track mobile

  // Tambahkan ref untuk melacak apakah komponen masih terpasang
  const isMounted = useRef(true)
  const sidebarRef = useRef(null)

  // Minimum time between fetches (5 minutes in milliseconds) - reduced for better UX
  const MIN_FETCH_INTERVAL = 5 * 60 * 1000

  // Track last fetch time
  const lastPendingCountFetchTime = useRef(0)
  // Track last profile image fetch time
  const lastFetchTime = useRef(0)

  useEffect(() => {
    setIsClient(true)
    // Initialize mobile state on client
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (mobile) {
        setSidebarVisible(false)
      } else {
        setSidebarVisible(true)
      }
    }
    checkMobile()
  }, [])

  useEffect(() => {
    return () => {
      // Set flag bahwa komponen sudah tidak terpasang
      isMounted.current = false
    }
  }, [])

  // Add click outside handler for mobile sidebar
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Only handle click outside on mobile
      if (!isMobile) return

      if (
        sidebarVisible &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        !event.target.closest(".btn") // Don't close if clicking the hamburger button
      ) {
        setSidebarVisible(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [sidebarVisible, isMobile])

  // Close sidebar on route change for mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarVisible(false)
    }
  }, [pathname, isMobile])

  // Add a helper function to check authentication before making API calls
  const checkAuthAndGetToken = () => {
    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      setAuthError(true)
      router.push("/admin/login")
      return null
    }

    // Cek apakah token sudah kedaluwarsa
    const tokenExpiry = sessionStorage.getItem("tokenExpiry")
    if (tokenExpiry) {
      const expiryTime = Number.parseInt(tokenExpiry, 10)
      const now = Date.now()
      if (expiryTime <= now) {
        // Token sudah kedaluwarsa, coba refresh
        refreshToken()
        return null
      }
    }

    return token
  }

  // Add a function to refresh the token
  const refreshToken = async () => {
    if (isRefreshingToken) return null

    setIsRefreshingToken(true)
    try {
      const refreshToken = sessionStorage.getItem("refreshToken")
      if (!refreshToken) {
        throw new Error("No refresh token available")
      }

      const response = await axios.post(
        "/api/auth/refresh-token", // Pastikan endpoint sesuai dengan API Anda
        { refreshToken },
        {
          headers: {
            "Content-Type": "application/json",
          },
          withCredentials: true,
        },
      )

      if (response.data.token) {
        // Simpan token baru dengan informasi expiry
        const expiresIn = process.env.NEXT_PUBLIC_JWT_EXPIRES_IN
          ? Number.parseInt(process.env.NEXT_PUBLIC_JWT_EXPIRES_IN)
          : 3600

        const expiryTime = Date.now() + expiresIn * 1000

        sessionStorage.setItem("adminToken", response.data.token)
        sessionStorage.setItem("tokenExpiry", expiryTime.toString())

        // Setup timer untuk refresh token berikutnya
        setupTokenRefreshTimer()

        return response.data.token
      }

      throw new Error("Failed to refresh token")
    } catch (error) {
      console.error("Token refresh error:", error)
      sessionStorage.removeItem("adminToken")
      sessionStorage.removeItem("refreshToken")
      sessionStorage.removeItem("tokenExpiry")
      setAuthError(true)
      router.push("/admin/login")
      return null
    } finally {
      setIsRefreshingToken(false)
    }
  }

  // Add a function to handle 401 errors with token refresh
  const handleApiCall = async (apiCallFn) => {
    try {
      const token = checkAuthAndGetToken()
      if (!token) return null

      return await apiCallFn(token)
    } catch (error) {
      if (error.response?.status === 401) {
        // Try to refresh the token
        const newToken = await refreshToken()
        if (newToken) {
          // Retry the API call with the new token
          return await apiCallFn(newToken)
        }
      }
      throw error
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    // Check if admin is logged in
    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      router.push("/admin/login")
      return
    }

    // Cek validitas token dan setup refresh timer
    const initAuth = async () => {
      const isValid = await checkTokenValidity()
      if (!isValid) {
        // Coba refresh token
        const refreshed = await refreshToken()
        if (!refreshed) {
          // Jika refresh gagal, redirect ke login
          router.push("/admin/login")
          return
        }
      }

      // Setup timer untuk refresh token
      setupTokenRefreshTimer()
    }

    initAuth()

    // Set username and profile image from session storage
    const username = sessionStorage.getItem("adminUsername")
    if (username) {
      setAdminUsername(username)
    }

    const storedProfileImage = sessionStorage.getItem("adminProfileImage")
    if (storedProfileImage) {
      setProfileImage(storedProfileImage)
    }

    const fetchProfileImage = async () => {
      // Throttle API calls - hanya fetch jika sudah lebih dari 30 detik sejak fetch terakhir
      const now = Date.now()
      if (now - lastFetchTime.current < 30000) {
        return
      }

      lastFetchTime.current = now

      try {
        await handleApiCall(async (token) => {
          const response = await axios.get(`/api/profile/image`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          // Periksa apakah komponen masih terpasang sebelum update state
          if (!isMounted.current) return

          if (response.data.success && response.data.data.profileImage) {
            const imageUrl = response.data.data.profileImage
            setProfileImage(imageUrl)
            sessionStorage.setItem("adminProfileImage", imageUrl)
          }

          return response
        })
      } catch (error) {
        console.error("Error fetching profile image:", error)

        // Jangan retry jika error 429 (rate limit)
        if (error.response?.status === 429) {
          console.log("Rate limited, will not retry fetching profile image")
          return
        }

        // Jangan retry jika komponen sudah tidak terpasang
        if (!isMounted.current) return
      }
    }

    fetchProfileImage()

    // Load pending count from cache first
    try {
      const cachedPendingCount = localStorage.getItem(CACHE_KEYS.ADMIN_PENDING_COUNT)
      const lastFetch = localStorage.getItem(CACHE_KEYS.ADMIN_PENDING_COUNT_LAST_FETCH)

      if (cachedPendingCount) {
        setPendingCount(JSON.parse(cachedPendingCount))
      }

      if (lastFetch) {
        const parsedTime = Number.parseInt(lastFetch, 10)
        lastPendingCountFetchTime.current = parsedTime

        // If it's been more than the minimum interval, fetch fresh data
        if (Date.now() > parsedTime + MIN_FETCH_INTERVAL) {
          fetchPendingCount()
        }
      } else {
        // No record of last fetch, so fetch data
        fetchPendingCount()
      }
    } catch (error) {
      console.error("Error loading pending count from cache:", error)
      fetchPendingCount()
    }

    // Set up interval to refresh pending count (every 5 minutes)
    const intervalId = setInterval(() => {
      const now = Date.now()
      if (now - lastPendingCountFetchTime.current >= MIN_FETCH_INTERVAL) {
        fetchPendingCount()
      }
    }, MIN_FETCH_INTERVAL)

    // Setup interval untuk cek token secara berkala (setiap 5 menit)
    const tokenCheckIntervalId = setInterval(
      async () => {
        const isValid = await checkTokenValidity()
        if (!isValid && !isRefreshingToken) {
          refreshToken()
        }
      },
      5 * 60 * 1000,
    )

    // Setup event listener untuk data updates (polling-based)
    const handleDataUpdate = (event) => {
      // Jika event adalah pin-processed atau pins-batch-processed, refresh pending count
      if (event.detail && (event.detail.processedCount || event.type === "pin-data-updated")) {
        console.log("Data update event received, refreshing pending count")
        fetchPendingCount()
      }
    }

    window.addEventListener("pin-data-updated", handleDataUpdate)
    window.addEventListener("cache-invalidated", handleDataUpdate)

    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) {
        setSidebarVisible(false)
      } else {
        setSidebarVisible(true)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("pin-data-updated", handleDataUpdate)
      window.removeEventListener("cache-invalidated", handleDataUpdate)
      clearInterval(intervalId)
      clearInterval(tokenCheckIntervalId)
    }
  }, [router, isRefreshingToken])

  // Fetch pending count with rate limiting
  const fetchPendingCount = async () => {
    if (!isClient) return

    // Check if we're within rate limit window
    const now = Date.now()
    if (now - lastPendingCountFetchTime.current < MIN_FETCH_INTERVAL) {
      console.log("Skipping pending count fetch due to rate limiting")
      return
    }

    lastPendingCountFetchTime.current = now

    try {
      await handleApiCall(async (token) => {
        // Use the dedicated endpoint for pending count
        const response = await axios.get(`/api/admin/pending-pins-count`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        // Only update if component is still mounted
        if (!isMounted.current) return

        if (response.data && response.data.count !== undefined) {
          setPendingCount(response.data.count)

          // Update cache
          localStorage.setItem(CACHE_KEYS.ADMIN_PENDING_COUNT, JSON.stringify(response.data.count))
          localStorage.setItem(CACHE_KEYS.ADMIN_PENDING_COUNT_LAST_FETCH, now.toString())
        }

        return response
      })
    } catch (error) {
      console.error("Error fetching pending count:", error)

      // Don't retry on rate limit errors
      if (error.response?.status === 429) {
        console.log("Rate limited, will not retry fetching pending count")
      }
    }
  }

  const handleLogout = async () => {
    try {
      const token = sessionStorage.getItem("adminToken")
      if (token) {
        await axios.post(
          `/api/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )
      }
    } catch (error) {
      console.error("Logout error:", error)
    }

    if (typeof window !== "undefined") {
      // Hapus semua data session
      sessionStorage.removeItem("adminToken")
      sessionStorage.removeItem("refreshToken")
      sessionStorage.removeItem("adminUsername")
      sessionStorage.removeItem("adminProfileImage")
      sessionStorage.removeItem("tokenExpiry")

      // Hapus cache
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("pending_pins_") || key.startsWith("dashboard_") || key.includes("_cache")) {
          localStorage.removeItem(key)
        }
      })
    }
    router.push("/admin/login")
  }

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible)
  }

  const handleProfileImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadLoading(true)
    setUploadError("")

    try {
      await handleApiCall(async (token) => {
        const formData = new FormData()
        formData.append("file", file)

        const response = await axios.post(`/api/profile/upload-image`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        })

        if (response.data.success) {
          const imageUrl = response.data.data.profileImage
          setProfileImage(imageUrl)
          sessionStorage.setItem("adminProfileImage", imageUrl)
          setShowProfileModal(false)
        }

        return response
      })
    } catch (error) {
      console.error("Error uploading profile image:", error)

      if (error.response?.status === 429) {
        setUploadError("Terlalu banyak permintaan. Silakan coba lagi nanti.")
      } else {
        setUploadError(error.response?.data?.message || "Gagal mengunggah foto profil")
      }
    } finally {
      setUploadLoading(false)
    }
  }

  // Handle navigation link clicks on mobile
  const handleNavLinkClick = () => {
    if (isMobile) {
      setSidebarVisible(false)
    }
  }

  if (authError) {
    return (
      <div className="admin-layout">
        <div className="content">
          <Alert variant="danger">Sesi login Anda telah berakhir. Anda akan dialihkan ke halaman login...</Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      {/* Mobile overlay - Only render on client and when mobile */}
      {isClient && isMobile && sidebarVisible && (
        <div className="sidebar-overlay show" onClick={() => setSidebarVisible(false)} />
      )}

      <div ref={sidebarRef} className={`sidebar ${sidebarVisible ? "show" : ""}`}>
        <div className="border-bottom">
          <Image src="/assets/logo footter.png" alt="Logo" width={100} height={32} />
        </div>

        <div className="sidebar-nav-container">
          {/* Main Navigation */}
          <ul className="nav flex-column p-3">
            <li className="nav-item">
              <Link href="/admin/dashboard" className="nav-link d-flex align-items-center" onClick={handleNavLinkClick}>
                <FaChartPie className="me-2" /> Dashboard
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/admin/pins" className="nav-link d-flex align-items-center" onClick={handleNavLinkClick}>
                <FaKey className="me-2" /> Manajemen PIN
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/admin/pending-pins"
                className="nav-link d-flex align-items-center position-relative"
                onClick={handleNavLinkClick}
              >
                <FaExclamationCircle className="me-2" /> PIN Pending
                {pendingCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning text-dark">
                    {pendingCount}
                  </span>
                )}
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/admin/redemption-history"
                className="nav-link d-flex align-items-center"
                onClick={handleNavLinkClick}
              >
                <FaHistory className="me-2" /> Riwayat Redemption
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/admin/gallery"
                className="nav-link d-flex align-items-center"
                onClick={handleNavLinkClick}
              >
                <FaRegImages className="me-2" /> Manajemen Gallery
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/admin/article"
                className="nav-link d-flex align-items-center"
                onClick={handleNavLinkClick}
              >
                <RiArticleFill className="me-2" /> Manajemen Artikel
              </Link>
            </li>
          </ul>

          {/* Logout Button - Separate section */}
          <div className="sidebar-logout-section">
            <ul className="nav flex-column p-3">
              <li className="nav-item">
                <button
                  onClick={handleLogout}
                  className="nav-link d-flex align-items-center border-0 bg-transparent w-100 text-start"
                >
                  <FaSignOutAlt className="me-2" /> Logout
                </button>
              </li>
            </ul>
          </div>

          {/* Profile Section */}
          {isClient && adminUsername && (
            <div className="profile-section">
              <div className="d-flex align-items-center justify-content-center flex-column">
                <div className="profile-image-container mb-2" onClick={() => setShowProfileModal(true)}>
                  <img src={profileImage || "/placeholder.svg"} alt="Profile" className="profile-image" />
                  <div className="profile-image-overlay">
                    <FaCamera className="camera-icon" />
                  </div>
                </div>
                <small className="d-block text-center">
                  <strong>{adminUsername}</strong>
                </small>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="content">
        <button className="btn btn-sm btn-primary d-md-none mb-3" onClick={toggleSidebar}>
          {sidebarVisible ? <FaTimes /> : <FaBars />}
        </button>
        {children}
      </div>

      {showProfileModal && (
        <div className="profile-modal-backdrop" onClick={() => setShowProfileModal(false)}>
          <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h5>Update Profile Picture</h5>
              <button className="btn-close" onClick={() => setShowProfileModal(false)}></button>
            </div>
            <div className="profile-modal-body">
              <div className="current-profile-container mb-3">
                <img src={profileImage || "/placeholder.svg"} alt="Current Profile" className="current-profile-image" />
              </div>
              {uploadError && <div className="alert alert-danger">{uploadError}</div>}
              <div className="mb-3">
                <label htmlFor="profileImageInput" className="form-label">
                  Choose new image
                </label>
                <input
                  type="file"
                  className="form-control"
                  id="profileImageInput"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  disabled={uploadLoading}
                />
              </div>
            </div>
            <div className="profile-modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowProfileModal(false)} disabled={uploadLoading}>
                {uploadLoading ? "Uploading..." : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminLayout