"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  Row,
  Col,
  Card,
  Button,
  Form,
  Table,
  Badge,
  Alert,
  Spinner,
  InputGroup,
  Pagination,
  Toast,
  ToastContainer,
} from "react-bootstrap"
import { useRouter } from "next/navigation"
import axios from "axios"
import {
  FaSearch,
  FaFileDownload,
  FaSync,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaWifi,
  FaPlay,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaEye,
  FaSortUp,
  FaSortDown,
  FaSort,
} from "react-icons/fa"

// Cache utilities
const CACHE_KEYS = {
  REDEMPTION_HISTORY_DATA: "redemption_history_data",
  REDEMPTION_HISTORY_LAST_FETCH: "redemption_history_last_fetch",
  DASHBOARD_STATS: "dashboard_stats",
  DASHBOARD_STATS_LAST_FETCH: "dashboard_stats_last_fetch",
}

const invalidateAllCaches = () => {
  Object.values(CACHE_KEYS).forEach((key) => {
    localStorage.removeItem(key)
  })
  sessionStorage.removeItem("redemption_etag")
}

// Force refresh function that bypasses all caches
const forceRefreshData = async (fetchFunction, ...args) => {
  invalidateAllCaches()
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
  if (config.method === "post" || config.method === "delete" || config.method === "patch") {
    config.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    config.headers["Pragma"] = "no-cache"
    config.headers["Expires"] = "0"
  }

  if (config.bypassCache) {
    delete config.headers["If-None-Match"]
    config.params = { ...config.params, _t: Date.now() }
  }

  return config
})

function RedemptionHistory() {
  const { status } = useSession()
  const router = useRouter()
  const isMountedRef = useRef(false)
  const pollingIntervalRef = useRef(null)
  const requestInProgressRef = useRef(false)
  const abortControllerRef = useRef(null)
  const searchTimeoutRef = useRef(null)

  // Basic state
  const [isClient, setIsClient] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [redemptions, setRedemptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [error, setError] = useState("")

  // Toast notifications
  const [toasts, setToasts] = useState([])

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [totalItems, setTotalItems] = useState(0)

  // Sorting
  const [sortField, setSortField] = useState("redeemedAt")
  const [sortDirection, setSortDirection] = useState("desc")

  // Polling
  const [pollingActive, setPollingActive] = useState(false)
  const [lastEtag, setLastEtag] = useState(null)
  const [lastRefreshTime, setLastRefreshTime] = useState(0)
  const [rateLimitHit, setRateLimitHit] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("connected")

  // Constants
  const MIN_REFRESH_INTERVAL = 2000 // 2 seconds
  const POLLING_INTERVAL = 30000 // 30 seconds for redemption history
  const SEARCH_DEBOUNCE_DELAY = 500

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

  // Enhanced fetch redemptions function
  const fetchRedemptions = useCallback(
    async (
      page = 1,
      limit = 50,
      force = false,
      currentSearchTerm = "",
      currentDateRange = {},
      currentSortField = "redeemedAt",
      currentSortDirection = "desc",
      options = {},
    ) => {
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

        // Build query parameters
        let queryParams = `?page=${page}&limit=${limit}&sort=${currentSortField}&direction=${currentSortDirection}`

        if (currentSearchTerm) {
          queryParams += `&search=${encodeURIComponent(currentSearchTerm)}`
        }

        if (currentDateRange.startDate) {
          queryParams += `&startDate=${encodeURIComponent(currentDateRange.startDate)}`
        }

        if (currentDateRange.endDate) {
          queryParams += `&endDate=${encodeURIComponent(currentDateRange.endDate)}`
        }

        // Add cache buster for force refresh
        if (options.bypassCache || force) {
          queryParams += `&_t=${Date.now()}`
        }

        const response = await api.get(`/api/admin/redemptions${queryParams}`, {
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

        // Handle 304 Not Modified
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
          setLastEtag(null)
        }

        const responseData = response.data
        const redemptionsData = responseData?.redemptions || []

        safeSetState(() => {
          setRedemptions(redemptionsData)
          setTotalPages(responseData?.totalPages || 1)
          setTotalItems(responseData?.total || 0)
          setCurrentPage(page)
          setDataLoaded(true)

          setError("")
          setRateLimitHit(false)
          setLastRefreshTime(now)
        })

        // Update cache
        localStorage.setItem(CACHE_KEYS.REDEMPTION_HISTORY_DATA, JSON.stringify(redemptionsData))
        localStorage.setItem(CACHE_KEYS.REDEMPTION_HISTORY_LAST_FETCH, now.toString())

        // Show success toast with data info
        if (force) {
          addToast(`Data berhasil dimuat: ${redemptionsData.length} redemption ditemukan`, "success")
        }
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
            setAuthError(true)
            router.push("/admin/login")
          } else if (error.response?.status === 429) {
            setRateLimitHit(true)
            addToast("Rate limit tercapai. Auto-refresh dihentikan sementara.", "warning")
          } else {
            setError("Gagal mengambil data riwayat redemption: " + (error.response?.data?.error || error.message))
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

  // Enhanced manual refresh
  const handleRefresh = useCallback(() => {
    invalidateAllCaches()
    forceRefreshData(fetchRedemptions, currentPage, itemsPerPage, true, searchTerm, dateRange, sortField, sortDirection)
    addToast("Data berhasil diperbarui", "success")
  }, [fetchRedemptions, currentPage, itemsPerPage, searchTerm, dateRange, sortField, sortDirection, addToast])

  // Improved polling with better error handling
  const startPolling = useCallback(() => {
    if (status !== "authenticated") {
      console.log("⏳ Cannot start polling, not authenticated")
      return
    }

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    const poll = () => {
      if (isMountedRef.current && !rateLimitHit && !requestInProgressRef.current && status === "authenticated") {
        fetchRedemptions(currentPage, itemsPerPage, false, searchTerm, dateRange, sortField, sortDirection)
      }
    }

    pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL)
    setPollingActive(true)
  }, [
    fetchRedemptions,
    currentPage,
    itemsPerPage,
    searchTerm,
    dateRange,
    sortField,
    sortDirection,
    rateLimitHit,
    status,
  ])

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

  // Debounced search
  const handleSearchChange = useCallback(
    (value) => {
      setSearchTerm(value)
      setSearchLoading(true)

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }

      searchTimeoutRef.current = setTimeout(() => {
        setSearchLoading(false)
        if (dataLoaded && isMountedRef.current) {
          setCurrentPage(1)
          fetchRedemptions(1, itemsPerPage, true, value, dateRange, sortField, sortDirection)
        }
      }, SEARCH_DEBOUNCE_DELAY)
    },
    [fetchRedemptions, itemsPerPage, dateRange, sortField, sortDirection, dataLoaded],
  )

  // Handle date range change
  const handleDateRangeChange = useCallback(
    (field, value) => {
      const newDateRange = { ...dateRange, [field]: value }
      setDateRange(newDateRange)

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }

      searchTimeoutRef.current = setTimeout(() => {
        if (dataLoaded && isMountedRef.current) {
          setCurrentPage(1)
          fetchRedemptions(1, itemsPerPage, true, searchTerm, newDateRange, sortField, sortDirection)
        }
      }, SEARCH_DEBOUNCE_DELAY)
    },
    [fetchRedemptions, itemsPerPage, searchTerm, dateRange, sortField, sortDirection, dataLoaded],
  )

  // Handle sort change
  const handleSortChange = useCallback(
    (field) => {
      let newDirection = "desc"
      const newField = field

      // If clicking the same field, toggle direction
      if (field === sortField) {
        newDirection = sortDirection === "asc" ? "desc" : "asc"
      }

      setSortField(newField)
      setSortDirection(newDirection)
      setCurrentPage(1)
      fetchRedemptions(1, itemsPerPage, true, searchTerm, dateRange, newField, newDirection)
    },
    [fetchRedemptions, itemsPerPage, searchTerm, dateRange, sortField, sortDirection],
  )

  // Page change
  const handlePageChange = useCallback(
    (page) => {
      setCurrentPage(page)
      fetchRedemptions(page, itemsPerPage, false, searchTerm, dateRange, sortField, sortDirection)
    },
    [fetchRedemptions, itemsPerPage, searchTerm, dateRange, sortField, sortDirection],
  )

  // Items per page change
  const handleItemsPerPageChange = useCallback(
    (e) => {
      const newItemsPerPage = Number.parseInt(e.target.value, 10)
      setItemsPerPage(newItemsPerPage)
      setCurrentPage(1)
      fetchRedemptions(1, newItemsPerPage, true, searchTerm, dateRange, sortField, sortDirection)
    },
    [fetchRedemptions, searchTerm, dateRange, sortField, sortDirection],
  )

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchTerm("")
    setDateRange({ startDate: "", endDate: "" })
    setCurrentPage(1)
    setSortField("redeemedAt")
    setSortDirection("desc")

    setTimeout(() => {
      if (isMountedRef.current) {
        fetchRedemptions(1, itemsPerPage, true, "", { startDate: "", endDate: "" }, "redeemedAt", "desc")
      }
    }, 100)
  }, [fetchRedemptions, itemsPerPage])

  // Enhanced export with better formatting
  const handleExportCSV = useCallback(() => {
    const csvContent = [
      ["PIN Code", "Nama", "ID Game", "Waktu Redeem", "Status", "Diproses Pada"],
      ...redemptions.map((redemption) => [
        redemption.code,
        redemption.redeemedBy?.nama || redemption.nama || "Data tidak tersedia",
        redemption.redeemedBy?.idGame || redemption.idGame || "Data tidak tersedia",
        redemption.redeemedBy?.redeemedAt
          ? new Date(redemption.redeemedBy.redeemedAt).toLocaleString("id-ID")
          : redemption.redeemedAt
            ? new Date(redemption.redeemedAt).toLocaleString("id-ID")
            : redemption.processedAt
              ? new Date(redemption.processedAt).toLocaleString("id-ID")
              : "Data tidak tersedia",
        redemption.processed ? "Diproses" : "Pending",
        redemption.processedAt ? new Date(redemption.processedAt).toLocaleString("id-ID") : "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `redemption-history-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    addToast(`Export berhasil! ${redemptions.length} redemption telah diunduh`, "success")
  }, [redemptions, addToast])

  useEffect(() => {
    isMountedRef.current = true
    setIsClient(true)

    if (status === "loading") {
      console.log("⏳ Waiting for session to load...")
      return
    }

    const token = checkAuth()
    if (!token) {
      return
    }

    const loadData = async () => {
      try {
        await forceRefreshData(fetchRedemptions, 1, 50, true, "", { startDate: "", endDate: "" }, "redeemedAt", "desc")
        setTimeout(() => {
          if (isMountedRef.current && !rateLimitHit && status === "authenticated") {
            startPolling()
          }
        }, 3000)
      } catch (error) {
        console.error("Initial load failed:", error)
      }
    }

    const timer = setTimeout(loadData, 100)

    // Listen untuk update dari komponen lain
    const handleDataUpdate = () => {
      if (isMountedRef.current) {
        forceRefreshData(
          fetchRedemptions,
          currentPage,
          itemsPerPage,
          true,
          searchTerm,
          dateRange,
          sortField,
          sortDirection,
        )
      }
    }

    window.addEventListener("pin-redeemed", handleDataUpdate)
    window.addEventListener("pin-processed", handleDataUpdate)
    window.addEventListener("pins-batch-processed", handleDataUpdate)

    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      stopPolling()
      clearTimeout(timer)
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      window.removeEventListener("pin-redeemed", handleDataUpdate)
      window.removeEventListener("pin-processed", handleDataUpdate)
      window.removeEventListener("pins-batch-processed", handleDataUpdate)
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

  // Render sort indicator
  const renderSortIndicator = (field) => {
    if (sortField !== field) {
      return <FaSort className="ms-1 text-muted" size={12} />
    }
    return sortDirection === "asc" ? (
      <FaSortUp className="ms-1 text-primary" size={12} />
    ) : (
      <FaSortDown className="ms-1 text-primary" size={12} />
    )
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
            Showing {redemptions.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{" "}
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
      <div className="adminpanelredemptionpage">
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
      <div className="adminpanelredemptionpage">
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
      <div className="adminpanelredemptionpage">
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
      <div className="adminpanelredemptionpage">
        <h1 className="mb-4">Riwayat Redemption</h1>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="text-center">
            <Spinner animation="border" variant="info" size="lg" />
            <p className="mt-3">Memuat data riwayat redemption...</p>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() =>
                forceRefreshData(fetchRedemptions, 1, itemsPerPage, true, "", { startDate: "", endDate: "" })
              }
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
    <div className="adminpanelredemptionpage">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Riwayat Redemption</h1>
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
          <Card className="text-center h-100 border-info">
            <Card.Body>
              <div className="d-flex justify-content-center align-items-center mb-2">
                <FaEye className="text-info me-2" size={24} />
                <h1 className="display-1 text-info mb-0">{totalItems.toLocaleString("id-ID")}</h1>
              </div>
              <Card.Title>Total Redemption</Card.Title>
              <p className="text-muted mb-0">Riwayat semua PIN yang telah diredeem</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Search and Filter */}
      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-light">
          <span className="fw-bold">Filter & Pencarian</span>
        </Card.Header>
        <Card.Body>
          <Form>
            <Row>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Cari</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>
                      <FaSearch />
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="PIN, Nama, atau ID Game"
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      disabled={status !== "authenticated"}
                    />
                    {searchLoading && (
                      <InputGroup.Text>
                        <Spinner animation="border" size="sm" />
                      </InputGroup.Text>
                    )}
                    {searchTerm && (
                      <Button
                        variant="outline-secondary"
                        onClick={() => handleSearchChange("")}
                        disabled={status !== "authenticated"}
                      >
                        &times;
                      </Button>
                    )}
                  </InputGroup>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaCalendarAlt className="me-1" /> Tanggal Mulai
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => handleDateRangeChange("startDate", e.target.value)}
                    disabled={status !== "authenticated"}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaCalendarAlt className="me-1" /> Tanggal Akhir
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => handleDateRangeChange("endDate", e.target.value)}
                    disabled={status !== "authenticated"}
                  />
                </Form.Group>
              </Col>
              <Col md={3} className="d-flex align-items-end">
                <div className="d-flex flex-wrap gap-2 w-100">
                  <Button
                    variant="outline-secondary"
                    onClick={clearFilters}
                    disabled={loading || status !== "authenticated"}
                  >
                    Clear
                  </Button>
                  <Button
                    variant={pollingActive && !rateLimitHit ? "success" : "outline-secondary"}
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
                    onClick={handleRefresh}
                    disabled={loading || status !== "authenticated"}
                  >
                    <FaSync className={`me-1 ${loading ? "fa-spin" : ""}`} />
                    {loading ? "Memuat..." : "Refresh"}
                  </Button>
                </div>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {/* Redemption List */}
      <Card className="shadow-sm">
        <Card.Header className="bg-light">
          <div className="d-flex justify-content-between align-items-center">
            <span className="fw-bold">Daftar Redemption</span>
            <div className="d-flex gap-2">
              <Badge bg="info">Total: {totalItems.toLocaleString("id-ID")}</Badge>
              <Button
                variant="outline-success"
                size="sm"
                onClick={handleExportCSV}
                disabled={loading || !redemptions.length || status !== "authenticated"}
              >
                <FaFileDownload className="me-1" /> Export CSV
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {/* Table */}
          <div className="table-responsive" style={{ maxHeight: "600px", overflowY: "auto" }}>
            <Table striped bordered hover responsive className="mb-0">
              <thead className="table-dark sticky-top">
                <tr>
                  <th
                    style={{ cursor: "pointer" }}
                    onClick={() => handleSortChange("code")}
                    className="user-select-none"
                  >
                    PIN Code
                    {renderSortIndicator("code")}
                  </th>
                  <th
                    style={{ cursor: "pointer" }}
                    onClick={() => handleSortChange("nama")}
                    className="user-select-none"
                  >
                    Nama
                    {renderSortIndicator("nama")}
                  </th>
                  <th
                    style={{ cursor: "pointer" }}
                    onClick={() => handleSortChange("idGame")}
                    className="user-select-none"
                  >
                    ID Game
                    {renderSortIndicator("idGame")}
                  </th>
                  <th
                    style={{ cursor: "pointer" }}
                    onClick={() => handleSortChange("redeemedAt")}
                    className="user-select-none"
                  >
                    Waktu Redeem
                    {renderSortIndicator("redeemedAt")}
                  </th>
                  <th
                    style={{ cursor: "pointer" }}
                    onClick={() => handleSortChange("processed")}
                    className="user-select-none"
                  >
                    Status
                    {renderSortIndicator("processed")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && redemptions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : redemptions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-muted">
                      {searchTerm || dateRange.startDate || dateRange.endDate
                        ? "Tidak ada redemption yang sesuai dengan filter"
                        : "Belum ada data redemption"}
                    </td>
                  </tr>
                ) : (
                  redemptions.map((redemption, index) => (
                    <tr key={redemption._id || index}>
                      <td>
                        <code className="bg-light px-2 py-1 rounded">{redemption.code || "N/A"}</code>
                      </td>
                      <td>{redemption.redeemedBy?.nama || redemption.nama || "Data tidak tersedia"}</td>
                      <td>{redemption.redeemedBy?.idGame || redemption.idGame || "Data tidak tersedia"}</td>
                      <td>
                        {redemption.redeemedBy?.redeemedAt
                          ? new Date(redemption.redeemedBy.redeemedAt).toLocaleString("id-ID")
                          : redemption.redeemedAt
                            ? new Date(redemption.redeemedAt).toLocaleString("id-ID")
                            : redemption.processedAt
                              ? new Date(redemption.processedAt).toLocaleString("id-ID")
                              : "Data tidak tersedia"}
                      </td>
                      <td>
                        {redemption.processed ? (
                          <Badge bg="success" className="d-flex align-items-center">
                            <FaCheckCircle className="me-1" />
                            Diproses
                          </Badge>
                        ) : (
                          <Badge bg="warning" className="d-flex align-items-center">
                            <FaClock className="me-1" />
                            Pending
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className="mt-3 d-flex justify-content-between align-items-center">
            <div className="text-muted">
              Menampilkan {redemptions.length.toLocaleString("id-ID")} dari {totalItems.toLocaleString("id-ID")}{" "}
              redemption
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
                {toast.type === "info" && <FaEye className="me-2" />}
                Notifikasi
              </strong>
            </Toast.Header>
            <Toast.Body className={toast.type === "error" ? "text-white" : ""}>{toast.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </div>
  )
}

export default RedemptionHistory
