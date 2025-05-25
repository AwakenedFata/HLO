"use client"

import React from "react"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Card, Row, Col, Alert, Spinner, Button, Modal, Badge, Toast, ToastContainer } from "react-bootstrap"
import axios from "axios"
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from "chart.js"
import { Pie, Bar } from "react-chartjs-2"
import { useRouter } from "next/navigation"
import {
  FaSync,
  FaExclamationTriangle,
  FaWifi,
  FaPlay,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaEye,
} from "react-icons/fa"

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

// Cache utilities - Improved
const CACHE_KEYS = {
  DASHBOARD_STATS: "dashboard_stats",
  DASHBOARD_STATS_LAST_FETCH: "dashboard_stats_last_fetch",
  PIN_MANAGEMENT_LAST_FETCH: "pin_management_last_fetch",
  PIN_MANAGEMENT_DATA: "pin_management_data",
}

const invalidateAllCaches = () => {
  Object.values(CACHE_KEYS).forEach((key) => {
    localStorage.removeItem(key)
  })
  // Also clear any ETag related cache
  sessionStorage.removeItem("dashboard_etag")
  sessionStorage.removeItem("stats_etag")
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

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("adminToken")
      window.location.href = "/admin/login"
    }
    return Promise.reject(error)
  },
)

const PieChartComponent = React.memo(({ data, options }) => {
  return <Pie data={data} options={options} />
})

const BarChartComponent = React.memo(({ data, options }) => {
  return <Bar data={data} options={options} />
})

function useStatsData() {
  const [stats, setStats] = useState({
    total: 0,
    used: 0,
    unused: 0,
    available: 0,
    pending: 0,
    processed: 0,
    batches: [],
    recentActivity: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [nextAllowedFetchTime, setNextAllowedFetchTime] = useState(0)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("connected")
  const [lastEtag, setLastEtag] = useState(null)
  const [rateLimitHit, setRateLimitHit] = useState(false)

  const isMounted = useRef(true)
  const timeoutRef = useRef(null)
  const abortControllerRef = useRef(null)
  const isFetchingRef = useRef(false)
  const requestInProgressRef = useRef(false)

  const MIN_FETCH_INTERVAL = 2000 // Reduced for better responsiveness
  const POLLING_INTERVAL = 15000 // 15 seconds for dashboard

  // Immediate stats update function
  const updateStatsImmediately = useCallback((operation, count = 1) => {
    setStats((prevStats) => {
      const newStats = { ...prevStats }

      switch (operation) {
        case "generate":
          newStats.total += count
          newStats.available += count
          newStats.unused += count
          break
        case "delete":
          newStats.total -= count
          newStats.available -= count
          newStats.unused -= count
          break
        case "process":
          newStats.pending -= count
          newStats.processed += count
          break
        case "redeem":
          newStats.available -= count
          newStats.unused -= count
          newStats.used += count
          newStats.pending += count
          break
      }

      // Update cache immediately
      localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS, JSON.stringify(newStats))

      return newStats
    })
  }, [])

  // Safe state update function
  const safeSetState = useCallback((updateFn) => {
    if (isMounted.current) {
      updateFn()
    }
  }, [])

  // Check authentication
  const checkAuth = useCallback(() => {
    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      return null
    }
    return token
  }, [])

  const fetchStats = useCallback(
    async (force = false, options = {}) => {
      if (requestInProgressRef.current && !force) {
        return { alreadyInProgress: true }
      }

      if (!isMounted.current) {
        return { componentUnmounted: true }
      }

      const token = checkAuth()
      if (!token) {
        return { authError: true }
      }

      // Rate limiting check
      const now = Date.now()
      if (!force && lastFetchTime && now - lastFetchTime < MIN_FETCH_INTERVAL) {
        const timeRemaining = Math.ceil((lastFetchTime + MIN_FETCH_INTERVAL - now) / 1000)
        return { rateLimited: true, timeRemaining }
      }

      requestInProgressRef.current = true

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      safeSetState(() => {
        setIsRefreshing(true)
        if (!stats.total) setLoading(true)
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

        let queryParams = ""
        // Add cache buster for force refresh
        if (options.bypassCache || force) {
          queryParams = `?_t=${Date.now()}`
        }

        const response = await api.get(`/api/admin/stats${queryParams}`, {
          headers,
          signal: abortControllerRef.current.signal,
          validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
          bypassCache: options.bypassCache || force,
        })

        if (!isMounted.current) {
          return { componentUnmounted: true }
        }

        safeSetState(() => {
          setConnectionStatus("connected")
        })

        // Handle 304 Not Modified - but still update timestamp
        if (response.status === 304) {
          safeSetState(() => {
            setLastFetchTime(now)
            setIsRefreshing(false)
            if (!stats.total) setLoading(false)
          })
          return { notModified: true }
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

        safeSetState(() => {
          setStats(responseData)
          setLastFetchTime(now)
          setNextAllowedFetchTime(now + MIN_FETCH_INTERVAL)
          setInitialLoadDone(true)
          setError("")
          setRateLimitHit(false)
          setLoading(false)
        })

        // Update cache
        localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS, JSON.stringify(responseData))
        localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH, now.toString())

        return { success: true }
      } catch (error) {
        if (!isMounted.current) {
          return { componentUnmounted: true }
        }

        if (error.name === "AbortError") {
          return { aborted: true }
        }

        safeSetState(() => {
          setConnectionStatus("error")

          if (error.response?.status === 401) {
            sessionStorage.removeItem("adminToken")
            return { authError: true }
          } else if (error.response?.status === 429) {
            setRateLimitHit(true)
            setError("Rate limit tercapai. Auto-refresh dihentikan sementara.")
          } else if (error.response?.status === 404) {
            setError("API endpoint tidak ditemukan. Periksa konfigurasi backend.")
          } else if (error.response?.status >= 500) {
            setError("Server error. Periksa backend server.")
          } else if (error.code === "ECONNABORTED") {
            setError("Request timeout. Periksa koneksi internet.")
          } else if (error.code === "ERR_NETWORK") {
            setError("Network error. Periksa koneksi internet dan backend server.")
          } else {
            setError("Gagal mengambil data statistik: " + (error.response?.data?.error || error.message))
          }

          // Load from cache if no stats currently loaded
          if (!stats.total) {
            const cachedData = JSON.parse(localStorage.getItem(CACHE_KEYS.DASHBOARD_STATS) || "{}")
            if (cachedData.total > 0) {
              setStats(cachedData)
              setLoading(false)
            }
          }
        })

        return { error: true }
      } finally {
        requestInProgressRef.current = false
        safeSetState(() => {
          setIsRefreshing(false)
          if (!stats.total) setLoading(false)
        })
      }
    },
    [checkAuth, lastFetchTime, lastEtag, stats.total, safeSetState],
  )

  const formatTimeRemaining = useCallback(() => {
    const now = Date.now()
    const timeRemaining = Math.max(0, nextAllowedFetchTime - now)
    const minutes = Math.floor(timeRemaining / 60000)
    const seconds = Math.floor((timeRemaining % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }, [nextAllowedFetchTime])

  useEffect(() => {
    isMounted.current = true

    const loadInitialData = async () => {
      try {
        // Load from cache first
        const cachedData = localStorage.getItem(CACHE_KEYS.DASHBOARD_STATS)
        const lastFetch = localStorage.getItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH)

        if (cachedData) {
          const parsed = JSON.parse(cachedData)
          setStats(parsed)
          if (parsed.total > 0) setLoading(false)
        }

        if (lastFetch) {
          const parsedTime = Number.parseInt(lastFetch, 10)
          setLastFetchTime(parsedTime)
          setNextAllowedFetchTime(parsedTime + MIN_FETCH_INTERVAL)
        }

        // Always fetch fresh data on mount
        await forceRefreshData(fetchStats)
      } catch (error) {
        console.error("Error loading initial data:", error)
        await forceRefreshData(fetchStats)
      }
    }

    const timer = setTimeout(loadInitialData, 100)

    return () => {
      isMounted.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      clearTimeout(timer)
    }
  }, [])

  return {
    stats,
    loading,
    error,
    isRefreshing,
    lastFetchTime,
    connectionStatus,
    rateLimitHit,
    fetchStats,
    formatTimeRemaining,
    updateStatsImmediately,
  }
}

const Dashboard = () => {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)
  const [showForceRefreshModal, setShowForceRefreshModal] = useState(false)
  const [pollingActive, setPollingActive] = useState(false)
  const [toasts, setToasts] = useState([])

  const pollingIntervalRef = useRef(null)
  const POLLING_INTERVAL = 15000 // 15 seconds

  // Use custom hook for stats data
  const {
    stats,
    loading,
    error,
    isRefreshing,
    lastFetchTime,
    connectionStatus,
    rateLimitHit,
    fetchStats,
    formatTimeRemaining,
    updateStatsImmediately,
  } = useStatsData()

  // Toast helper
  const addToast = useCallback((message, type = "success", duration = 5000) => {
    const id = Date.now()
    const toast = { id, message, type, duration }
    setToasts((prev) => [...prev, toast])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  // Polling functions
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    const poll = () => {
      if (!rateLimitHit) {
        fetchStats(false)
      }
    }

    pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL)
    setPollingActive(true)
  }, [fetchStats, rateLimitHit])

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

  useEffect(() => {
    setIsClient(true)

    // Event handlers for real-time updates
    const handleDataUpdate = async (event) => {
      console.log("Data update event received:", event.type)
      await forceRefreshData(fetchStats)
    }

    const handlePinGenerated = (event) => {
      const count = event.detail?.count || 1
      updateStatsImmediately("generate", count)
      addToast(`${count} PIN baru telah dibuat`, "success")
    }

    const handlePinDeleted = (event) => {
      const count = event.detail?.count || 1
      updateStatsImmediately("delete", count)
      addToast(`${count} PIN telah dihapus`, "info")
    }

    const handlePinProcessed = (event) => {
      const count = event.detail?.count || 1
      updateStatsImmediately("process", count)
      addToast(`${count} PIN telah diproses`, "success")
    }

    const handlePinRedeemed = (event) => {
      const count = event.detail?.count || 1
      updateStatsImmediately("redeem", count)
      addToast(`${count} PIN telah diredeem`, "info")
    }

    // Add event listeners
    window.addEventListener("pin-data-updated", handleDataUpdate)
    window.addEventListener("cache-invalidated", handleDataUpdate)
    window.addEventListener("pin-status-changed", handleDataUpdate)
    window.addEventListener("pin-redeemed", handleDataUpdate)
    window.addEventListener("pin-generated", handlePinGenerated)
    window.addEventListener("pin-deleted", handlePinDeleted)
    window.addEventListener("pin-processed", handlePinProcessed)
    window.addEventListener("pins-batch-deleted", handlePinDeleted)

    // Start polling after initial load
    setTimeout(() => {
      if (!rateLimitHit) {
        startPolling()
      }
    }, 3000)

    return () => {
      // Remove event listeners
      window.removeEventListener("pin-data-updated", handleDataUpdate)
      window.removeEventListener("cache-invalidated", handleDataUpdate)
      window.removeEventListener("pin-status-changed", handleDataUpdate)
      window.removeEventListener("pin-redeemed", handleDataUpdate)
      window.removeEventListener("pin-generated", handlePinGenerated)
      window.removeEventListener("pin-deleted", handlePinDeleted)
      window.removeEventListener("pin-processed", handlePinProcessed)
      window.removeEventListener("pins-batch-deleted", handlePinDeleted)

      stopPolling()
    }
  }, [fetchStats, updateStatsImmediately, addToast, startPolling, stopPolling, rateLimitHit])

  const handleRefresh = async () => {
    const now = Date.now()
    if (lastFetchTime && now - lastFetchTime < 2000) {
      const timeRemaining = Math.ceil((lastFetchTime + 2000 - now) / 1000)
      addToast(`Tunggu ${timeRemaining} detik sebelum refresh lagi`, "warning")
      return
    }

    invalidateAllCaches()
    const result = await forceRefreshData(fetchStats)
    if (result?.showRateLimitModal) {
      setShowRateLimitModal(true)
    } else if (result?.authError) {
      router.push("/admin/login")
    } else {
      addToast("Data berhasil diperbarui", "success")
    }
  }

  const handleForceRefresh = async () => {
    setShowForceRefreshModal(false)
    invalidateAllCaches()
    const result = await forceRefreshData(fetchStats)
    if (result?.showRateLimitModal) {
      setShowRateLimitModal(true)
    } else if (result?.authError) {
      router.push("/admin/login")
    } else {
      addToast("Data berhasil diperbarui", "success")
    }
  }

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

  // Custom chart colors - futuristic theme
  const chartColors = useMemo(
    () => ({
      primary: ["#6c63ff", "#4facfe"],
      secondary: ["#00f5a0", "#00d9f5"],
      accent: ["#ff6b6b", "#ff8e53"],
      warning: ["#ffb347", "#ffcc33"],
      background: "#16213e",
      text: "#ffffff",
      grid: "rgba(255, 255, 255, 0.43)",
    }),
    [],
  )

  // Common chart options
  const commonOptions = useMemo(
    () => ({
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: chartColors.text,
            font: {
              family: "'Nasalization', 'Overpass', sans-serif",
              size: 12,
            },
            usePointStyle: true,
            pointStyle: "rectRounded",
            padding: 20,
          },
        },
        tooltip: {
          backgroundColor: "rgba(22, 33, 62, 0.8)",
          titleColor: chartColors.text,
          bodyColor: chartColors.text,
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderWidth: 1,
          padding: 12,
          bodyFont: {
            family: "'Nasalization', 'Overpass', sans-serif",
          },
          titleFont: {
            family: "'Nasalization', 'Overpass', sans-serif",
            weight: "bold",
          },
          displayColors: true,
          boxPadding: 5,
        },
      },
    }),
    [chartColors],
  )

  // Data untuk pie chart - updated to include pending
  const pieData = useMemo(
    () => ({
      labels: ["Digunakan & Diproses", "Pending", "Belum Digunakan"],
      datasets: [
        {
          data: [stats.processed, stats.pending, stats.unused],
          backgroundColor: [chartColors.accent[0], chartColors.warning[0], chartColors.primary[0]],
          hoverBackgroundColor: [chartColors.accent[1], chartColors.warning[1], chartColors.primary[1]],
          borderColor: chartColors.background,
          borderWidth: 2,
        },
      ],
    }),
    [stats, chartColors],
  )

  // Options for pie chart
  const pieChartOptions = useMemo(
    () => ({
      ...commonOptions,
      plugins: {
        ...commonOptions.plugins,
        title: {
          display: true,
          color: chartColors.text,
          font: {
            family: "'Nasalization', 'Overpass', sans-serif",
            size: 16,
            weight: "bold",
          },
        },
      },
      maintainAspectRatio: false,
    }),
    [commonOptions, chartColors],
  )

  // Data untuk bar chart
  const barData = useMemo(
    () => ({
      labels: stats.batches?.map((batch) => batch.name || `Batch ${batch.id}`) || [],
      datasets: [
        {
          label: "Jumlah PIN",
          data: stats.batches?.map((batch) => batch.count) || [],
          backgroundColor: (context) => {
            const index = context.dataIndex
            const value = context.dataset.data[index]
            const maxValue = Math.max(...context.dataset.data, 1)
            const alpha = 0.7 + (value / maxValue) * 0.3
            return `rgba(108, 99, 255, ${alpha})`
          },
          borderColor: chartColors.primary[1],
          borderWidth: 1,
          borderRadius: 6,
          hoverBackgroundColor: chartColors.primary[1],
        },
      ],
    }),
    [stats.batches, chartColors],
  )

  // Options for bar chart
  const barOptions = useMemo(
    () => ({
      ...commonOptions,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        ...commonOptions.plugins,
        title: {
          display: true,
          color: chartColors.text,
          font: {
            family: "'Nasalization', 'Overpass', sans-serif",
            size: 16,
            weight: "bold",
          },
        },
        legend: {
          ...commonOptions.plugins.legend,
          labels: {
            ...commonOptions.plugins.legend.labels,
            color: chartColors.secondary[0],
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: chartColors.grid,
            borderColor: chartColors.grid,
            tickColor: chartColors.grid,
          },
          ticks: {
            color: chartColors.text,
            font: {
              family: "'Nasalization', 'Overpass', sans-serif",
            },
          },
        },
        y: {
          grid: {
            color: chartColors.grid,
            borderColor: chartColors.grid,
            tickColor: chartColors.grid,
          },
          ticks: {
            color: chartColors.text,
            font: {
              family: "'Nasalization', 'Overpass', sans-serif",
            },
            callback: (value) => {
              if (value % 1 === 0) {
                return value
              }
              return null
            },
          },
          beginAtZero: true,
        },
      },
      animation: {
        duration: 2000,
        easing: "easeOutQuart",
      },
    }),
    [commonOptions, chartColors],
  )

  return (
    <div className="adminpaneldashboardpage">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Dashboard</h1>
        <div className="d-flex align-items-center gap-2">
          {getConnectionStatusBadge()}
          <small className="text-muted">
            Update: {lastFetchTime > 0 ? new Date(lastFetchTime).toLocaleTimeString("id-ID") : "-"}
          </small>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          {lastFetchTime > 0 && (
            <small className="text-muted">Terakhir diperbarui: {new Date(lastFetchTime).toLocaleString()}</small>
          )}
        </div>
        <div className="d-flex gap-2">
          <Button
            variant={pollingActive && !rateLimitHit ? "success" : "outline-secondary"}
            size="sm"
            onClick={togglePolling}
            disabled={rateLimitHit}
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
          <Button variant="outline-primary" size="sm" onClick={handleRefresh} disabled={loading || isRefreshing}>
            <FaSync className={`me-1 ${isRefreshing ? "fa-spin" : ""}`} />
            {isRefreshing ? "Memuat..." : "Refresh"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
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

      {loading && !stats.total ? (
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-2">Memuat data statistik...</p>
        </div>
      ) : (
        <>
          <Row className="mb-4">
            <Col md={3}>
              <Card className="text-center h-100 border-primary">
                <Card.Body>
                  <div className="d-flex justify-content-center align-items-center mb-2">
                    <FaEye className="text-primary me-2" size={24} />
                    <h1 className="display-1 text-primary mb-0">{stats.total.toLocaleString("id-ID")}</h1>
                  </div>
                  <Card.Title>Total PIN</Card.Title>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center h-100 border-success">
                <Card.Body>
                  <div className="d-flex justify-content-center align-items-center mb-2">
                    <FaCheckCircle className="text-success me-2" size={24} />
                    <h1 className="display-1 text-success mb-0">{stats.unused.toLocaleString("id-ID")}</h1>
                  </div>
                  <Card.Title>PIN Tersedia</Card.Title>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center h-100 border-warning">
                <Card.Body>
                  <div className="d-flex justify-content-center align-items-center mb-2">
                    <FaClock className="text-warning me-2" size={24} />
                    <h1 className="display-1 text-warning mb-0">{stats.pending.toLocaleString("id-ID")}</h1>
                  </div>
                  <Card.Title>PIN Pending</Card.Title>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center h-100 border-danger">
                <Card.Body>
                  <div className="d-flex justify-content-center align-items-center mb-2">
                    <FaTimesCircle className="text-danger me-2" size={24} />
                    <h1 className="display-1 text-danger mb-0">{stats.processed.toLocaleString("id-ID")}</h1>
                  </div>
                  <Card.Title>PIN Diproses</Card.Title>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {isClient && (
            <Row>
              <Col md={6}>
                <Card className="mb-4 shadow-sm">
                  <Card.Body>
                    <Card.Title>Status Penggunaan PIN</Card.Title>
                    <div style={{ height: "300px" }} className="d-flex justify-content-center align-items-center">
                      {stats.total > 0 ? (
                        <PieChartComponent data={pieData} options={pieChartOptions} />
                      ) : (
                        <p className="errortextdashboard">Belum ada data PIN</p>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="mb-4 shadow-sm">
                  <Card.Body>
                    <Card.Title>Distribusi PIN per Batch</Card.Title>
                    <div style={{ height: "300px" }} className="d-flex justify-content-center align-items-center">
                      {stats.batches?.length > 0 ? (
                        <BarChartComponent data={barData} options={barOptions} />
                      ) : (
                        <p className="errortextdashboard">Belum ada data batch</p>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Recent Activity */}
          {stats.recentActivity && stats.recentActivity.length > 0 && (
            <Row>
              <Col md={12}>
                <Card className="mb-4 shadow-sm">
                  <Card.Header className="bg-light">
                    <Card.Title className="mb-0">Aktivitas Terbaru</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>PIN Code</th>
                            <th>Nama</th>
                            <th>ID Game</th>
                            <th>Waktu Diproses</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentActivity.slice(0, 10).map((activity, index) => (
                            <tr key={index}>
                              <td>
                                <code className="bg-light px-2 py-1 rounded">{activity.code}</code>
                              </td>
                              <td>{activity.redeemedBy?.nama || "-"}</td>
                              <td>{activity.redeemedBy?.idGame || "-"}</td>
                              <td>
                                {activity.processedAt ? new Date(activity.processedAt).toLocaleString("id-ID") : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Auto-refresh status */}
          <div className="mt-3 d-flex justify-content-between align-items-center">
            <div className="text-muted">
              Statistik PIN - Total: {stats.total.toLocaleString("id-ID")} | Tersedia:{" "}
              {stats.unused.toLocaleString("id-ID")} | Pending: {stats.pending.toLocaleString("id-ID")} | Diproses:{" "}
              {stats.processed.toLocaleString("id-ID")}
            </div>
            {pollingActive && !rateLimitHit && (
              <Badge bg="success" className="d-flex align-items-center">
                <FaWifi className="me-1" />
                Auto-refresh aktif
              </Badge>
            )}
          </div>
        </>
      )}

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
          <p>
            Anda dapat melakukan refresh data lagi dalam: <strong>{formatTimeRemaining()}</strong>
          </p>
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
          <p>
            Waktu yang disarankan untuk refresh berikutnya: <strong>{formatTimeRemaining()}</strong>
          </p>
          <Alert variant="warning">Apakah Anda yakin ingin memaksa refresh data sekarang?</Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowForceRefreshModal(false)}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleForceRefresh}>
            Force Refresh
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default Dashboard
