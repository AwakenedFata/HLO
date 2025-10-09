"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Row,
  Col,
  Card,
  Button,
  Table,
  Badge,
  Alert,
  Spinner,
  Modal,
  Form,
  Pagination,
  OverlayTrigger,
  Tooltip,
  Toast,
  ToastContainer,
} from "react-bootstrap"
import { useRouter } from "next/navigation"
import axios from "axios"
import {
  FaSync,
  FaCheck,
  FaExclamationTriangle,
  FaCheckDouble,
  FaWifi,
  FaPlay,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
} from "react-icons/fa"

// Cache utilities - Improved
const CACHE_KEYS = {
  PENDING_PINS_DATA: "pending_pins_data",
  PENDING_PINS_LAST_FETCH: "pending_pins_last_fetch",
  DASHBOARD_STATS: "dashboard_stats",
  DASHBOARD_STATS_LAST_FETCH: "dashboard_stats_last_fetch",
}

const invalidateAllCaches = () => {
  Object.values(CACHE_KEYS).forEach((key) => {
    localStorage.removeItem(key)
  })
  // Also clear any ETag related cache
  sessionStorage.removeItem("pending_etag")
  sessionStorage.removeItem("pending_count_etag")
}

// Force refresh function that bypasses all caches
const forceRefreshData = async (fetchFunction, ...args) => {
  // Clear all cache indicators
  invalidateAllCaches()

  // Add cache-busting parameter
  const timestamp = Date.now()
  return await fetchFunction(...args, {
    force: true,
    bypassCache: true,
    cacheBuster: timestamp,
  })
}

// Create axios instance with improved cache handling
const api = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
})

// Add request interceptor to handle cache busting
api.interceptors.request.use((config) => {
  // Add cache busting for critical operations
  if (config.method === "post" || config.method === "delete" || config.method === "patch") {
    config.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    config.headers["Pragma"] = "no-cache"
    config.headers["Expires"] = "0"
  }

  // Remove ETag for force refresh
  if (config.bypassCache) {
    delete config.headers["If-None-Match"]
    config.params = { ...config.params, _t: Date.now() }
  }

  return config
})

function PendingPins() {
  const { status } = useSession()
  const router = useRouter()
  const isMountedRef = useRef(false)
  const pollingIntervalRef = useRef(null)
  const requestInProgressRef = useRef(false)
  const componentIdRef = useRef(Math.random().toString(36).substr(2, 9))
  const abortControllerRef = useRef(null)
  const refreshTimeoutRef = useRef(null)

  // Basic state
  const [isClient, setIsClient] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [pendingPins, setPendingPins] = useState([])
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [error, setError] = useState("")

  // Toast notifications
  const [toasts, setToasts] = useState([])

  // Processing state
  const [processing, setProcessing] = useState(false)
  const [processingId, setProcessingId] = useState(null)
  const [batchProcessing, setBatchProcessing] = useState(false)

  // Selection state
  const [selectedPins, setSelectedPins] = useState([])
  const [selectAll, setSelectAll] = useState(false)

  // Modals
  const [showBatchProcessModal, setShowBatchProcessModal] = useState(false)
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)
  const [showForceRefreshModal, setShowForceRefreshModal] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [totalItems, setTotalItems] = useState(0)

  // Polling
  const [pollingActive, setPollingActive] = useState(false)
  const [lastEtag, setLastEtag] = useState(null)
  const [lastRefreshTime, setLastRefreshTime] = useState(0)
  const [rateLimitHit, setRateLimitHit] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("connected")

  // Constants
  const MIN_REFRESH_INTERVAL = 1000 // Reduced for better responsiveness
  const POLLING_INTERVAL = 15000 // 15 seconds for pending pins
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

  // Toast helper
  const addToast = useCallback((message, type = "success", duration = 5000) => {
    const id = Date.now()
    const toast = { id, message, type, duration }
    setToasts((prev) => [...prev, toast])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  // Safe state update function
  const safeSetState = useCallback((updateFn) => {
    if (isMountedRef.current) {
      updateFn()
    }
  }, [])

  // Check authentication
  const checkAuth = useCallback(() => {
    if (status !== "authenticated") {
      console.log("⏳ Waiting for authentication..., current status:", status)
      if (status === "unauthenticated") {
        safeSetState(() => {
          setAuthError(true)
        })
        router.push("/admin/login")
      }
      return null
    }
    return true
  }, [status, router, safeSetState])

  // Immediate stats update function for dashboard
  const updateStatsImmediately = useCallback((operation, count = 1) => {
    // Update dashboard stats cache immediately
    const cachedStats = localStorage.getItem(CACHE_KEYS.DASHBOARD_STATS)
    if (cachedStats) {
      try {
        const stats = JSON.parse(cachedStats)
        switch (operation) {
          case "process":
            stats.pending -= count
            stats.processed += count
            break
        }
        localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS, JSON.stringify(stats))
      } catch (error) {
        console.error("Error updating stats cache:", error)
      }
    }
  }, [])

  // Enhanced fetch pending pins function with better cache handling
  const fetchPendingPins = useCallback(
    async (page = 1, limit = 50, force = false, options = {}) => {
      if (status !== "authenticated") {
        console.log("⏳ Waiting for authentication..., current status:", status)
        return { waitingAuth: true }
      }

      if (requestInProgressRef.current && !force) {
        return
      }

      if (!isMountedRef.current) {
        return
      }

      const token = checkAuth()
      if (!token) {
        return
      }

      // Rate limiting check
      const now = Date.now()
      if (!force && lastRefreshTime && now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        return
      }

      requestInProgressRef.current = true

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      safeSetState(() => {
        setLoading(true)
        setError("")
        setConnectionStatus("connecting")
      })

      try {
        const headers = { Authorization: `Bearer ${token}` }

        // Force bypass cache if specified
        if (options.bypassCache || force) {
          headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
          headers["Pragma"] = "no-cache"
          delete headers["If-None-Match"]
        } else if (lastEtag && !force) {
          headers["If-None-Match"] = lastEtag
        }

        let queryParams = `?page=${page}&limit=${limit}`

        // Add cache buster for force refresh
        if (options.bypassCache || force) {
          queryParams += `&_t=${Date.now()}`
        }

        const response = await api.get(`/api/admin/pending-pins${queryParams}`, {
          headers,
          signal: abortControllerRef.current.signal,
          validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
          bypassCache: options.bypassCache || force,
        })

        if (!isMountedRef.current) {
          return
        }

        safeSetState(() => {
          setConnectionStatus("connected")
        })

        // Handle 304 Not Modified - but still update timestamp
        if (response.status === 304) {
          safeSetState(() => {
            setLastRefreshTime(now)
            setLoading(false)
          })
          return
        }

        // Save ETag only if not bypassing cache
        const newEtag = response.headers.etag
        if (newEtag && !options.bypassCache && !force) {
          setLastEtag(newEtag)
        } else {
          // Clear ETag for force refresh
          setLastEtag(null)
        }

        const responseData = response.data
        const pinsData = responseData?.pins || []

        safeSetState(() => {
          setPendingPins(pinsData)
          setTotalPages(responseData?.totalPages || 1)
          setTotalItems(responseData?.total || 0)
          setCurrentPage(page)
          setDataLoaded(true)

          setError("")
          setSelectedPins([])
          setSelectAll(false)
          setRateLimitHit(false)
          setLastRefreshTime(now)
        })

        // Update cache
        localStorage.setItem(CACHE_KEYS.PENDING_PINS_DATA, JSON.stringify(pinsData))
        localStorage.setItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, now.toString())
      } catch (error) {
        if (!isMountedRef.current) {
          return
        }

        if (error.name === "AbortError") {
          return
        }

        safeSetState(() => {
          setConnectionStatus("error")

          if (error.response?.status === 401) {
            sessionStorage.removeItem("adminToken")
            setAuthError(true)
            router.push("/admin/login")
          } else if (error.response?.status === 429) {
            setRateLimitHit(true)
            addToast("Rate limit tercapai. Auto-refresh dihentikan sementara.", "warning")
          } else {
            setError("Gagal mengambil data PIN pending: " + (error.response?.data?.error || error.message))
          }
        })
      } finally {
        requestInProgressRef.current = false
        safeSetState(() => {
          setLoading(false)
        })
      }
    },
    [checkAuth, lastRefreshTime, lastEtag, router, safeSetState, addToast, status],
  )

  // Improved mark as processed with immediate UI update
  const handleMarkAsProcessed = useCallback(
    async (pin) => {
      if (processing) return

      setProcessing(true)
      setProcessingId(pin._id)
      setError("")

      try {
        const token = checkAuth()
        if (!token) return

        // Optimistic update
        const updatedPins = pendingPins.filter((p) => p._id !== pin._id)
        setPendingPins(updatedPins)
        setTotalItems((prev) => prev - 1)
        updateStatsImmediately("process", 1)

        const response = await api.post(
          `/api/admin/pending-pins/process-pin`,
          { pinId: pin._id },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          },
        )

        if (isMountedRef.current) {
          addToast(`PIN ${pin.code} berhasil ditandai sebagai diproses`, "success")

          // Clear all caches and force refresh
          invalidateAllCaches()

          // Remove from selected pins if it was selected
          if (selectedPins.includes(pin._id)) {
            setSelectedPins((prev) => prev.filter((id) => id !== pin._id))
          }

          // If this was the last item on the page and not the first page, go to previous page
          if (updatedPins.length === 0 && currentPage > 1) {
            setCurrentPage(currentPage - 1)
            await forceRefreshData(fetchPendingPins, currentPage - 1, itemsPerPage)
          } else if (updatedPins.length === 0) {
            // If it was the last item on the first page, refresh to check if there are more items
            await forceRefreshData(fetchPendingPins, 1, itemsPerPage)
          }

          // Broadcast event untuk komponen lain
          window.dispatchEvent(
            new CustomEvent("pin-processed", {
              detail: { count: 1, pinId: pin._id, code: pin.code },
            }),
          )
        }
      } catch (error) {
        if (isMountedRef.current) {
          // Revert optimistic update on error
          await forceRefreshData(fetchPendingPins, currentPage, itemsPerPage)
          addToast("Gagal memproses PIN: " + (error.response?.data?.error || error.message), "error")
        }
      } finally {
        if (isMountedRef.current) {
          setProcessing(false)
          setProcessingId(null)
        }
      }
    },
    [
      processing,
      checkAuth,
      pendingPins,
      selectedPins,
      currentPage,
      itemsPerPage,
      fetchPendingPins,
      addToast,
      updateStatsImmediately,
    ],
  )

  // Improved batch process with immediate UI update
  const handleBatchProcess = useCallback(async () => {
    if (selectedPins.length === 0 || batchProcessing) return

    setBatchProcessing(true)
    setError("")

    try {
      const token = checkAuth()
      if (!token) return

      // Optimistic update
      const updatedPins = pendingPins.filter((p) => !selectedPins.includes(p._id))
      setPendingPins(updatedPins)
      setTotalItems((prev) => prev - selectedPins.length)
      updateStatsImmediately("process", selectedPins.length)

      const response = await api.post(
        `/api/admin/pending-pins/batch-process-pins`,
        { pinIds: selectedPins },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        },
      )

      if (isMountedRef.current) {
        const processedCount = response.data.processed || 0
        addToast(`${processedCount} PIN berhasil ditandai sebagai sudah diproses`, "success")

        setShowBatchProcessModal(false)
        setSelectedPins([])
        setSelectAll(false)

        // Clear all caches and force refresh
        invalidateAllCaches()

        // If all items on this page were processed, refresh or go to previous page
        if (updatedPins.length === 0) {
          if (currentPage > 1) {
            setCurrentPage(currentPage - 1)
            await forceRefreshData(fetchPendingPins, currentPage - 1, itemsPerPage)
          } else {
            await forceRefreshData(fetchPendingPins, 1, itemsPerPage)
          }
        }

        // Broadcast event untuk komponen lain
        window.dispatchEvent(
          new CustomEvent("pins-batch-processed", {
            detail: { count: processedCount, pinIds: selectedPins },
          }),
        )
      }
    } catch (error) {
      if (isMountedRef.current) {
        addToast("Gagal memproses PIN: " + (error.response?.data?.error || error.message), "error")
        // Revert optimistic update and refresh
        await forceRefreshData(fetchPendingPins, currentPage, itemsPerPage)
      }
    } finally {
      if (isMountedRef.current) {
        setBatchProcessing(false)
        setShowBatchProcessModal(false)
      }
    }
  }, [
    selectedPins,
    batchProcessing,
    checkAuth,
    pendingPins,
    currentPage,
    itemsPerPage,
    fetchPendingPins,
    addToast,
    updateStatsImmediately,
  ])

  // Enhanced manual refresh
  const handleRefresh = useCallback(() => {
    invalidateAllCaches()
    forceRefreshData(fetchPendingPins, currentPage, itemsPerPage)
    addToast("Data berhasil diperbarui", "success")
  }, [fetchPendingPins, currentPage, itemsPerPage, addToast])

  // Improved polling with better error handling
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    const poll = () => {
      if (isMountedRef.current && !rateLimitHit && !requestInProgressRef.current) {
        // Use regular fetch for polling, not force refresh
        fetchPendingPins(currentPage, itemsPerPage, false)
      }
    }

    pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL)
    setPollingActive(true)
  }, [fetchPendingPins, currentPage, itemsPerPage, rateLimitHit])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setPollingActive(false)
  }, [])

  const togglePolling = useCallback(() => {
    if (pollingActive) {
      stopPolling()
      addToast("Auto-refresh dimatikan", "info")
    } else {
      startPolling()
      addToast("Auto-refresh diaktifkan", "success")
    }
  }, [pollingActive, startPolling, stopPolling, addToast])

  // Page change
  const handlePageChange = useCallback(
    (page) => {
      setCurrentPage(page)
      fetchPendingPins(page, itemsPerPage)
    },
    [fetchPendingPins, itemsPerPage],
  )

  // Items per page change
  const handleItemsPerPageChange = useCallback(
    (e) => {
      const newItemsPerPage = Number.parseInt(e.target.value, 10)
      setItemsPerPage(newItemsPerPage)
      setCurrentPage(1)
      fetchPendingPins(1, newItemsPerPage)
    },
    [fetchPendingPins],
  )

  // Select all pins
  const handleSelectAll = useCallback(
    (e) => {
      const isChecked = e.target.checked
      setSelectAll(isChecked)
      if (isChecked) {
        setSelectedPins(pendingPins.map((pin) => pin._id))
      } else {
        setSelectedPins([])
      }
    },
    [pendingPins],
  )

  // Select individual pin
  const handleSelectPin = useCallback((pinId, isChecked) => {
    if (isChecked) {
      setSelectedPins((prev) => [...prev, pinId])
    } else {
      setSelectedPins((prev) => prev.filter((id) => id !== pinId))
      setSelectAll(false)
    }
  }, [])

  // Initialize component
  useEffect(() => {
    if (status === "loading") {
      return
    }

    isMountedRef.current = true
    setIsClient(true)

    const token = checkAuth()
    if (!token) {
      return
    }

    const loadData = async () => {
      try {
        await forceRefreshData(fetchPendingPins, 1, 50)
        setTimeout(() => {
          if (isMountedRef.current && !rateLimitHit && status === "authenticated") {
            startPolling()
          }
        }, 2000)
      } catch (error) {
        console.error("Initial load failed:", error)
      }
    }

    const timer = setTimeout(loadData, 100)

    // Listen untuk update dari komponen lain
    const handlePinUpdate = () => {
      if (isMountedRef.current && status === "authenticated") {
        forceRefreshData(fetchPendingPins, currentPage, itemsPerPage)
      }
    }

    window.addEventListener("pin-status-changed", handlePinUpdate)
    window.addEventListener("pin-redeemed", handlePinUpdate)
    window.addEventListener("pin-generated", handlePinUpdate)

    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      stopPolling()
      clearTimeout(timer)
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      window.removeEventListener("pin-status-changed", handlePinUpdate)
      window.removeEventListener("pin-redeemed", handlePinUpdate)
      window.removeEventListener("pin-generated", handlePinUpdate)
    }
  }, [status])

  // Connection status indicator
  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return <Badge bg="success">Terhubung</Badge>
      case "connecting":
        return <Badge bg="warning">Menghubungkan...</Badge>
      case "error":
        return <Badge bg="danger">Error</Badge>
      default:
        return <Badge bg="secondary">Unknown</Badge>
    }
  }

  // Render pagination
  const renderPagination = () => {
    if (totalPages <= 1) return null

    const items = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    // Previous
    items.push(
      <Pagination.Prev key="prev" disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} />,
    )

    // First page
    if (startPage > 1) {
      items.push(
        <Pagination.Item key={1} onClick={() => handlePageChange(1)}>
          1
        </Pagination.Item>,
      )
      if (startPage > 2) {
        items.push(<Pagination.Ellipsis key="ellipsis1" />)
      }
    }

    // Page numbers
    for (let page = startPage; page <= endPage; page++) {
      items.push(
        <Pagination.Item key={page} active={page === currentPage} onClick={() => handlePageChange(page)}>
          {page}
        </Pagination.Item>,
      )
    }

    // Last page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<Pagination.Ellipsis key="ellipsis2" />)
      }
      items.push(
        <Pagination.Item key={totalPages} onClick={() => handlePageChange(totalPages)}>
          {totalPages}
        </Pagination.Item>,
      )
    }

    // Next
    items.push(
      <Pagination.Next
        key="next"
        disabled={currentPage === totalPages}
        onClick={() => handlePageChange(currentPage + 1)}
      />,
    )

    return (
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="d-flex align-items-center">
          <span className="me-2">Items per page:</span>
          <Form.Select size="sm" value={itemsPerPage} onChange={handleItemsPerPageChange} style={{ width: "80px" }}>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Form.Select>
          <span className="ms-3">
            Showing {pendingPins.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{" "}
            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
          </span>
        </div>
        <Pagination size="sm" className="mb-0">
          {items}
        </Pagination>
      </div>
    )
  }

  if (status === "loading") {
    return (
      <div className="adminpanelpendingpinpage">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Memuat sesi...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show loading while not client-side
  if (!isClient) {
    return (
      <div className="adminpanelpendingpinpage">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Memuat aplikasi...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show auth error
  if (authError) {
    return (
      <div className="adminpanelpendingpinpage">
        <div className="container mt-5">
          <Alert variant="danger" className="text-center">
            <FaExclamationTriangle size={48} className="mb-3" />
            <h4>Sesi Login Berakhir</h4>
            <p>Anda akan dialihkan ke halaman login...</p>
          </Alert>
        </div>
      </div>
    )
  }

  // Show loading while data hasn't loaded
  if (!dataLoaded) {
    return (
      <div className="adminpanelpendingpinpage">
        <h1 className="mb-4">PIN Pending</h1>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="text-center">
            <Spinner animation="border" variant="warning" size="lg" />
            <p className="mt-3">Memuat data PIN pending...</p>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => forceRefreshData(fetchPendingPins, 1, itemsPerPage)}
              disabled={loading || status !== "authenticated"}
              className="mt-2"
            >
              {loading ? "Memuat ulang..." : "Muat Ulang Data"}
            </Button>
            {error && (
              <Alert variant="danger" className="mt-3">
                <FaExclamationTriangle className="me-2" />
                {error}
              </Alert>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="adminpanelpendingpinpage">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">PIN Pending</h1>
        <div className="d-flex align-items-center gap-2">
          {getConnectionStatusBadge()}
          <small className="text-muted">
            Update: {lastRefreshTime > 0 ? new Date(lastRefreshTime).toLocaleTimeString("id-ID") : "-"}
          </small>
        </div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")} className="mb-4">
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}

      {rateLimitHit && (
        <Alert variant="warning" className="mb-4">
          <strong>Rate Limit Tercapai!</strong> Auto-refresh telah dihentikan untuk mencegah spam request.
          <Button variant="link" size="sm" onClick={() => setRateLimitHit(false)} className="ms-2">
            Reset
          </Button>
        </Alert>
      )}

      {/* Stats Card */}
      <Row className="mb-4">
        <Col md={12}>
          <Card className="text-center h-100 border-warning">
            <Card.Body>
              <div className="d-flex justify-content-center align-items-center mb-2">
                <FaClock className="text-warning me-2" size={24} />
                <h1 className="display-1 text-warning mb-0">{totalItems.toLocaleString("id-ID")}</h1>
              </div>
              <Card.Title>Total PIN Pending</Card.Title>
              <p className="text-muted mb-0">PIN yang sudah digunakan tapi belum diproses</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* PIN List */}
      <Card className="shadow-sm">
        <Card.Header className="bg-light">
          <div className="d-flex justify-content-between align-items-center">
            <span className="fw-bold">Daftar PIN Pending</span>
            <div className="d-flex gap-2">
              {selectedPins.length > 0 && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => setShowBatchProcessModal(true)}
                  disabled={batchProcessing || status !== "authenticated"}
                >
                  <FaCheckDouble className="me-1" />
                  {batchProcessing ? "Memproses..." : `Proses Semua (${selectedPins.length})`}
                </Button>
              )}
              <Button
                variant={pollingActive && !rateLimitHit ? "success" : "outline-secondary"}
                size="sm"
                onClick={togglePolling}
                disabled={rateLimitHit || status !== "authenticated"}
              >
                {pollingActive ? (
                  <>
                    <FaWifi className="me-1" />
                    Auto ON
                  </>
                ) : (
                  <>
                    <FaPlay className="me-1" />
                    Auto OFF
                  </>
                )}
              </Button>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={handleRefresh}
                disabled={loading || status !== "authenticated"}
              >
                <FaSync className={`me-1 ${loading ? "fa-spin" : ""}`} />
                {loading ? "Memuat..." : "Refresh"}
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {/* Table */}
          <div className="table-responsive" style={{ maxHeight: "500px", overflowY: "auto" }}>
            <Table striped bordered hover responsive className="mb-0">
              <thead className="table-dark sticky-top">
                <tr>
                  <th style={{ width: "50px" }}>
                    <Form.Check
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      disabled={loading || pendingPins.length === 0 || status !== "authenticated"}
                    />
                  </th>
                  <th>PIN Code</th>
                  <th>Nama</th>
                  <th>ID Game</th>
                  <th>Waktu Redeem</th>
                  <th style={{ width: "150px" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading && pendingPins.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : pendingPins.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                      Tidak ada PIN pending saat ini
                    </td>
                  </tr>
                ) : (
                  pendingPins.map((pin) => (
                    <tr key={pin._id}>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={selectedPins.includes(pin._id)}
                          onChange={(e) => handleSelectPin(pin._id, e.target.checked)}
                          disabled={(processing && processingId === pin._id) || status !== "authenticated"}
                        />
                      </td>
                      <td>
                        <code className="bg-light px-2 py-1 rounded">{pin.code}</code>
                      </td>
                      <td>{pin.redeemedBy?.nama || "-"}</td>
                      <td>{pin.redeemedBy?.idGame || "-"}</td>
                      <td>
                        {pin.redeemedBy?.redeemedAt ? new Date(pin.redeemedBy.redeemedAt).toLocaleString("id-ID") : "-"}
                      </td>
                      <td>
                        <OverlayTrigger placement="top" overlay={<Tooltip>Tandai sebagai diproses</Tooltip>}>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleMarkAsProcessed(pin)}
                            disabled={(processing && processingId === pin._id) || status !== "authenticated"}
                          >
                            {processing && processingId === pin._id ? (
                              <>
                                <Spinner animation="border" size="sm" className="me-1" />
                                Memproses...
                              </>
                            ) : (
                              <>
                                <FaCheck className="me-1" />
                                Proses
                              </>
                            )}
                          </Button>
                        </OverlayTrigger>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className="mt-3 d-flex justify-content-between align-items-center">
            <div className="text-muted">
              Menampilkan {pendingPins.length.toLocaleString("id-ID")} dari {totalItems.toLocaleString("id-ID")} PIN
              pending
            </div>
            {pollingActive && !rateLimitHit && (
              <Badge bg="success" className="d-flex align-items-center">
                <FaWifi className="me-1" />
                Auto-refresh aktif
              </Badge>
            )}
          </div>

          {renderPagination()}
        </Card.Body>
      </Card>

      {/* Toast Notifications */}
      <ToastContainer position="top-end" className="p-3">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            bg={toast.type === "error" ? "danger" : toast.type}
            show={true}
            onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            delay={toast.duration}
            autohide
          >
            <Toast.Header>
              <strong className="me-auto">
                {toast.type === "success" && <FaCheckCircle className="me-2" />}
                {toast.type === "error" && <FaTimesCircle className="me-2" />}
                {toast.type === "warning" && <FaExclamationTriangle className="me-2" />}
                {toast.type === "info" && <FaClock className="me-2" />}
                Notifikasi
              </strong>
            </Toast.Header>
            <Toast.Body className={toast.type === "error" ? "text-white" : ""}>{toast.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>

      {/* Batch Process Modal */}
      <Modal show={showBatchProcessModal} onHide={() => !batchProcessing && setShowBatchProcessModal(false)} centered>
        <Modal.Header closeButton={!batchProcessing}>
          <Modal.Title>
            <FaCheckDouble className="me-2 text-success" /> Konfirmasi Proses Batch
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menandai <strong className="text-success">{selectedPins.length}</strong> PIN sebagai
            sudah diproses?
          </p>
          <Alert variant="info" className="mb-0">
            <FaCheckCircle className="me-2" />
            Tindakan ini akan memproses semua PIN yang dipilih sekaligus.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBatchProcessModal(false)} disabled={batchProcessing}>
            Batal
          </Button>
          <Button variant="success" onClick={handleBatchProcess} disabled={batchProcessing}>
            {batchProcessing ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Memproses...
              </>
            ) : (
              <>
                <FaCheckDouble className="me-2" />
                Proses Semua
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Rate Limit Warning Modal */}
      <Modal show={showRateLimitModal} onHide={() => setShowRateLimitModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaExclamationTriangle className="text-warning me-2" />
            Peringatan Rate Limit
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Untuk menghindari error rate limit (429), sistem membatasi frekuensi permintaan data.</p>
          <Alert variant="info">Data yang ditampilkan saat ini adalah data yang tersimpan di cache lokal.</Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRateLimitModal(false)}>
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Force Refresh Confirmation Modal */}
      <Modal show={showForceRefreshModal} onHide={() => setShowForceRefreshModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaExclamationTriangle className="text-warning me-2" />
            Konfirmasi Force Refresh
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Melakukan refresh terlalu sering dapat menyebabkan error rate limit (429).</p>
          <Alert variant="warning">Apakah Anda yakin ingin memaksa refresh data sekarang?</Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowForceRefreshModal(false)}>
            Batal
          </Button>
          <Button variant="danger" onClick={() => forceRefreshData(fetchPendingPins, currentPage, itemsPerPage)}>
            Force Refresh
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default PendingPins
