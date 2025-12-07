"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import {
  FaChartPie,
  FaKey,
  FaHistory,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaRegImages,
  FaExclamationCircle,
  FaEnvelope,
} from "react-icons/fa"
import { RiArticleFill } from "react-icons/ri"
import { AiFillProduct } from "react-icons/ai";
import { MdConfirmationNumber } from "react-icons/md";
import axios from "axios"
import Image from "next/image"
import "@/styles/adminstyles.css"
import { Alert, Spinner } from "react-bootstrap"

const CACHE_KEYS = {
  ADMIN_PENDING_COUNT: "admin_pending_count_cache",
  ADMIN_PENDING_COUNT_LAST_FETCH: "admin_pending_count_last_fetch",
}

function AdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [isClient, setIsClient] = useState(false)
  
  const isMounted = useRef(true)
  const sidebarRef = useRef(null)
  const lastPendingCountFetchTime = useRef(0)
  const MIN_FETCH_INTERVAL = 5 * 60 * 1000

  // Initialize client-side and check mobile
  useEffect(() => {
    setIsClient(true)
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      setSidebarVisible(!mobile)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Component cleanup
  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  // Click outside handler for mobile
  useEffect(() => {
    if (!isMobile) return

    const handleClickOutside = (event) => {
      if (
        sidebarVisible &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        !event.target.closest(".btn")
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

  // Redirect if unauthenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login")
    }
  }, [status, router])

  // Fetch pending count - ONLY when authenticated
  const fetchPendingCount = async () => {
    // PENTING: Cek session dulu!
    if (status !== "authenticated" || !isClient) {
      console.log("Skipping fetch - not authenticated or not client-side")
      return
    }

    const now = Date.now()
    if (now - lastPendingCountFetchTime.current < MIN_FETCH_INTERVAL) {
      console.log("Skipping pending count fetch due to rate limiting")
      return
    }

    lastPendingCountFetchTime.current = now

    try {
      // PENTING: Gunakan endpoint yang benar!
      const response = await axios.get(`/api/admin/pending-pins/count`)

      if (!isMounted.current) return

      if (response.data?.count !== undefined) {
        setPendingCount(response.data.count)
        localStorage.setItem(CACHE_KEYS.ADMIN_PENDING_COUNT, JSON.stringify(response.data.count))
        localStorage.setItem(CACHE_KEYS.ADMIN_PENDING_COUNT_LAST_FETCH, now.toString())
      }
    } catch (error) {
      console.error("Error fetching pending count:", error)
      
      // Log specific error for debugging
      if (error.response) {
        console.error("Response error:", {
          status: error.response.status,
          data: error.response.data
        })
      }
    }
  }

  // Setup fetch and events - ONLY when authenticated
  useEffect(() => {
    if (status !== "authenticated" || !isClient) return

    // Load from cache first
    try {
      const cachedCount = localStorage.getItem(CACHE_KEYS.ADMIN_PENDING_COUNT)
      const lastFetch = localStorage.getItem(CACHE_KEYS.ADMIN_PENDING_COUNT_LAST_FETCH)

      if (cachedCount) {
        setPendingCount(JSON.parse(cachedCount))
      }

      // Fetch fresh data with delay to ensure session is fully ready
      const initialFetchTimer = setTimeout(() => {
        if (lastFetch) {
          const parsedTime = parseInt(lastFetch, 10)
          lastPendingCountFetchTime.current = parsedTime
          
          if (Date.now() > parsedTime + MIN_FETCH_INTERVAL) {
            fetchPendingCount()
          }
        } else {
          fetchPendingCount()
        }
      }, 1000) // 1 second delay

      // Setup interval
      const intervalId = setInterval(() => {
        const now = Date.now()
        if (now - lastPendingCountFetchTime.current >= MIN_FETCH_INTERVAL) {
          fetchPendingCount()
        }
      }, MIN_FETCH_INTERVAL)

      // Event listeners
      const handleDataUpdate = (event) => {
        if (event.detail?.processedCount || event.type === "pin-data-updated") {
          console.log("Data update event received, refreshing pending count")
          fetchPendingCount()
        }
      }

      window.addEventListener("pin-data-updated", handleDataUpdate)
      window.addEventListener("cache-invalidated", handleDataUpdate)

      return () => {
        clearTimeout(initialFetchTimer)
        clearInterval(intervalId)
        window.removeEventListener("pin-data-updated", handleDataUpdate)
        window.removeEventListener("cache-invalidated", handleDataUpdate)
      }
    } catch (error) {
      console.error("Error in pending count setup:", error)
    }
  }, [status, isClient]) // Dependencies yang benar

  const handleLogout = async () => {
    try {
      // Clear caches
      Object.keys(localStorage).forEach((key) => {
        if (key.includes("_cache") || key.includes("_last_fetch")) {
          localStorage.removeItem(key)
        }
      })

      await signOut({ callbackUrl: "/admin/login" })
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible)
  }

  const handleNavLinkClick = () => {
    if (isMobile) {
      setSidebarVisible(false)
    }
  }

  // Loading state
  if (status === "loading") {
    return (
      <div className="admin-layout">
        <div className="content d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
          <div className="text-center">
            <Spinner animation="border" role="status" variant="primary">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <p className="mt-3">Memuat sesi...</p>
          </div>
        </div>
      </div>
    )
  }

  // Unauthenticated state
  if (status === "unauthenticated") {
    return (
      <div className="admin-layout">
        <div className="content">
          <Alert variant="warning">Sesi tidak valid. Mengalihkan ke login...</Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      {isClient && isMobile && sidebarVisible && (
        <div className="sidebar-overlay show" onClick={() => setSidebarVisible(false)} />
      )}

<div ref={sidebarRef} className={`sidebar ${sidebarVisible ? "show" : ""}`}>
        <div className="border-bottom p-3">
          <Image src="/assets/logo footter.png" alt="Logo" width={100} height={32} />
        </div>

        <div className="sidebar-nav-container">
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
              <Link href="/admin/gallery" className="nav-link d-flex align-items-center" onClick={handleNavLinkClick}>
                <FaRegImages className="me-2" /> Manajemen Gallery
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/admin/article" className="nav-link d-flex align-items-center" onClick={handleNavLinkClick}>
                <RiArticleFill className="me-2" /> Manajemen Artikel
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/admin/mails" className="nav-link d-flex align-items-center" onClick={handleNavLinkClick}>
                <FaEnvelope className="me-2" /> User's Mails
              </Link>
            </li>
            <li className="nav-item">
              <Link href="/admin/serial-number" className="nav-link d-flex align-items-center" onClick={handleNavLinkClick}>
                <MdConfirmationNumber className="me-2" /> Serial Number
              </Link>
            </li>
          </ul>
        </div>

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

        {isClient && session?.user && (
          <div className="profile-section">
            <div className="d-flex align-items-center justify-content-center flex-column">
              <div className="profile-image-container mb-2">
                <img
                  src={session.user.image || "/assets/default-profile.png"}
                  alt="Profile"
                  className="profile-image"
                />
              </div>
              <small className="d-block text-center">
                <strong>{session.user.name || "Admin"}</strong>
              </small>
              <small className="d-block text-center text-muted">{session.user.email}</small>
            </div>
          </div>
        )}
      </div>

      <div className="content">
        <button className="btn btn-sm btn-primary d-md-none mb-3" onClick={toggleSidebar}>
          {sidebarVisible ? <FaTimes /> : <FaBars />}
        </button>
        {children}
      </div>
    </div>
  )
}

export default AdminLayout