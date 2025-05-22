"use client"

import React from "react"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Card, Row, Col, Alert, Spinner, Button, Modal } from "react-bootstrap"
import axios from "axios"
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from "chart.js"
import { Pie, Bar } from "react-chartjs-2"
import { useRouter } from "next/navigation"
import { FaSync, FaExclamationTriangle } from "react-icons/fa"
import "@/styles/adminstyles.css"
import { CACHE_KEYS, isCacheStale } from "@/lib/utils/cache-utils"

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

// Memoized chart components to prevent unnecessary re-renders
const PieChartComponent = React.memo(({ data, options }) => {
  return <Pie data={data} options={options} />
})

const BarChartComponent = React.memo(({ data, options }) => {
  return <Bar data={data} options={options} />
})

// Custom hook for stats data
function useStatsData() {
  const [stats, setStats] = useState({
    total: 0,
    used: 0,
    unused: 0,
    pending: 0,
    batches: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [nextAllowedFetchTime, setNextAllowedFetchTime] = useState(0)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  
  // Refs for cleanup
  const isMounted = useRef(true)
  const timeoutRef = useRef(null)
  const abortControllerRef = useRef(null)
  
  // Minimum time between fetches (15 minutes in milliseconds)
  const MIN_FETCH_INTERVAL = 15 * 60 * 1000

  // Function to fetch stats
  const fetchStats = useCallback(async (force = false) => {
    if (!isMounted.current) return

    // Always force fetch on first load
    if (!initialLoadDone) {
      force = true
      console.log("First load detected, forcing data fetch")
    }

    // Check if we're allowed to fetch based on time interval
    const now = Date.now()

    if (!force && lastFetchTime && now - lastFetchTime < MIN_FETCH_INTERVAL) {
      const cachedStats = localStorage.getItem(CACHE_KEYS.DASHBOARD_STATS)
      if (cachedStats) {
        const parsed = JSON.parse(cachedStats)
        if (parsed.total > 0) {
          const timeRemaining = Math.ceil((lastFetchTime + MIN_FETCH_INTERVAL - now) / 1000)
          setError(`Untuk menghindari rate limit, tunggu ${timeRemaining} detik sebelum refresh data.`)
          return { showRateLimitModal: true }
        }
      }
    }

    setIsRefreshing(true)

    // Jangan set loading ke true jika kita sudah memiliki data
    if (!stats.total) {
      setLoading(true)
    }

    setError("")

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Create a new AbortController
    abortControllerRef.current = new AbortController()

    try {
      const token = sessionStorage.getItem("adminToken")

      if (!token) {
        return { authError: true }
      }

      // Add a timeout to abort the request if it takes too long
      timeoutRef.current = setTimeout(() => {
        if (abortControllerRef.current && isMounted.current) {
          abortControllerRef.current.abort()
        }
      }, 15000) // 15 second timeout

      const response = await axios.get(`/api/admin/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: abortControllerRef.current.signal,
      })

      // Only update state if component is still mounted
      if (!isMounted.current) return {}

      // Update state with new data
      setStats(response.data)

      // Update cache
      localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS, JSON.stringify(response.data))
      localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH, now.toString())
      setLastFetchTime(now)
      setNextAllowedFetchTime(now + MIN_FETCH_INTERVAL)
      setInitialLoadDone(true)

      // Clear any error messages
      setError("")
      
      return { success: true }
    } catch (error) {
      console.error("Error fetching stats:", error)

      if (!isMounted.current) return {}

      if (error.name === "AbortError") {
        setError("Permintaan timeout. Server mungkin sedang sibuk, coba lagi nanti.")
      } else if (error.response?.status === 401) {
        sessionStorage.removeItem("adminToken")
        return { authError: true }
      } else if (error.response?.status === 429) {
        setError("Terlalu banyak permintaan ke server. Coba lagi dalam beberapa menit.")
        
        // Update last fetch time to prevent immediate retries
        // Use a longer backoff period for 429 errors - 30 minutes
        const backoffTime = now - MIN_FETCH_INTERVAL + 30 * 60 * 1000
        localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH, backoffTime.toString())
        setLastFetchTime(backoffTime)
        setNextAllowedFetchTime(backoffTime + MIN_FETCH_INTERVAL)
        
        return { showRateLimitModal: true }
      } else {
        setError("Gagal mengambil data statistik: " + (error.response?.data?.error || "Terjadi kesalahan"))
      }
      
      return { error: true }
    } finally {
      if (isMounted.current) {
        setLoading(false)
        setIsRefreshing(false)

        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
    }
  }, [lastFetchTime, stats.total, initialLoadDone])

  // Load data from cache on initial render
  useEffect(() => {
    // Try to load from cache first
    try {
      const cachedData = localStorage.getItem(CACHE_KEYS.DASHBOARD_STATS)
      const lastFetch = localStorage.getItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH)

      if (cachedData) {
        const parsed = JSON.parse(cachedData)
        setStats(parsed)
        if (parsed.total > 0) {
          setLoading(false)
        }
      }

      if (lastFetch) {
        const parsedTime = Number.parseInt(lastFetch, 10)
        setLastFetchTime(parsedTime)

        // Calculate when next fetch is allowed
        const nextTime = parsedTime + MIN_FETCH_INTERVAL
        setNextAllowedFetchTime(nextTime)

        // Check if cache is stale
        const isStale = isCacheStale(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH, MIN_FETCH_INTERVAL)

        // Always fetch fresh data on first load or if cache is stale
        if (!initialLoadDone || isStale) {
          // Add a small delay to prevent multiple components from fetching simultaneously
          const randomDelay = Math.floor(Math.random() * 1000)
          timeoutRef.current = setTimeout(() => {
            if (isMounted.current) {
              fetchStats(true)
            }
          }, randomDelay)
        }
      } else {
        // No record of last fetch, so fetch data immediately
        fetchStats(true)
      }
    } catch (error) {
      console.error("Error loading from cache:", error)

      // Fetch data immediately on error
      fetchStats(true)
    }

    return () => {
      isMounted.current = false
      
      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchStats])

  // Format time remaining
  const formatTimeRemaining = useCallback(() => {
    const now = Date.now()
    const timeRemaining = Math.max(0, nextAllowedFetchTime - now)
    const minutes = Math.floor(timeRemaining / 60000)
    const seconds = Math.floor((timeRemaining % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }, [nextAllowedFetchTime])

  return {
    stats,
    loading,
    error,
    isRefreshing,
    lastFetchTime,
    fetchStats,
    formatTimeRemaining
  }
}

const Dashboard = () => {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)
  const [showForceRefreshModal, setShowForceRefreshModal] = useState(false)
  
  // Use custom hook for stats data
  const { 
    stats, 
    loading, 
    error, 
    isRefreshing, 
    lastFetchTime,
    fetchStats,
    formatTimeRemaining
  } = useStatsData()

  useEffect(() => {
    setIsClient(true)

    // Tambahkan event listener untuk update data
    const handleDataUpdate = () => {
      fetchStats(true)
    }

    window.addEventListener("pin-data-updated", handleDataUpdate)
    window.addEventListener("cache-invalidated", handleDataUpdate)
    window.addEventListener("sse-pin-processed", handleDataUpdate)
    window.addEventListener("sse-pins-batch-processed", handleDataUpdate)

    return () => {
      // Remove event listeners
      window.removeEventListener("pin-data-updated", handleDataUpdate)
      window.removeEventListener("cache-invalidated", handleDataUpdate)
      window.removeEventListener("sse-pin-processed", handleDataUpdate)
      window.removeEventListener("sse-pins-batch-processed", handleDataUpdate)
    }
  }, [fetchStats])

  const handleRefresh = async () => {
    const now = Date.now()
    if (lastFetchTime && now - lastFetchTime < 15 * 60 * 1000) {
      setShowForceRefreshModal(true)
    } else {
      const result = await fetchStats(true)
      if (result?.showRateLimitModal) {
        setShowRateLimitModal(true)
      } else if (result?.authError) {
        router.push("/admin/login")
      }
    }
  }

  const handleForceRefresh = async () => {
    setShowForceRefreshModal(false)
    const result = await fetchStats(true)
    if (result?.showRateLimitModal) {
      setShowRateLimitModal(true)
    } else if (result?.authError) {
      router.push("/admin/login")
    }
  }

  // Custom chart colors - futuristic theme
  const chartColors = useMemo(() => ({
    primary: ["#6c63ff", "#4facfe"],
    secondary: ["#00f5a0", "#00d9f5"],
    accent: ["#ff6b6b", "#ff8e53"],
    warning: ["#ffb347", "#ffcc33"], // New color for pending
    background: "#16213e",
    text: "#ffffff",
    grid: "rgba(255, 255, 255, 0.43)",
  }), [])

  // Common chart options
  const commonOptions = useMemo(() => ({
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
  }), [chartColors])

  // Data untuk pie chart - updated to include pending
  const pieData = useMemo(() => ({
    labels: ["Digunakan & Diproses", "Pending", "Belum Digunakan"],
    datasets: [
      {
        data: [stats.used - stats.pending, stats.pending, stats.unused],
        backgroundColor: [chartColors.accent[0], chartColors.warning[0], chartColors.primary[0]],
        hoverBackgroundColor: [chartColors.accent[1], chartColors.warning[1], chartColors.primary[1]],
        borderColor: chartColors.background,
        borderWidth: 2,
      },
    ],
  }), [stats, chartColors])

  // Options for pie chart
  const pieChartOptions = useMemo(() => ({
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
  }), [commonOptions, chartColors])

  // Data untuk bar chart
  const barData = useMemo(() => ({
    labels: stats.batches?.map((batch) => batch.name || `Batch ${batch.id}`) || [],
    datasets: [
      {
        label: "Jumlah PIN",
        data: stats.batches?.map((batch) => batch.count) || [],
        backgroundColor: (context) => {
          const index = context.dataIndex
          const value = context.dataset.data[index]
          const maxValue = Math.max(...context.dataset.data, 1) // Prevent division by zero
          const alpha = 0.7 + (value / maxValue) * 0.3
          return `rgba(108, 99, 255, ${alpha})`
        },
        borderColor: chartColors.primary[1],
        borderWidth: 1,
        borderRadius: 6,
        hoverBackgroundColor: chartColors.primary[1],
      },
    ],
  }), [stats.batches, chartColors])

  // Options for bar chart
  const barOptions = useMemo(() => ({
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
          color: chartColors.secondary[0], // Custom color for "Jumlah PIN" label
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
  }), [commonOptions, chartColors])

  return (
    <div className="adminpaneldashboardpage">
      <h1 className="mb-4">Dashboard</h1>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          {lastFetchTime > 0 && (
            <small className="text-muted">Terakhir diperbarui: {new Date(lastFetchTime).toLocaleString()}</small>
          )}
        </div>
        <Button variant="outline-primary" size="sm" onClick={handleRefresh} disabled={loading || isRefreshing}>
          <FaSync className={`me-1 ${isRefreshing ? "fa-spin" : ""}`} />
          {isRefreshing ? "Memuat..." : "Refresh"}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

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
              <Card className="text-center h-100">
                <Card.Body>
                  <h1 className="display-1 text-primary">{stats.total}</h1>
                  <Card.Title>Total PIN</Card.Title>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center h-100">
                <Card.Body>
                  <h1 className="display-1 text-success">{stats.unused}</h1>
                  <Card.Title>PIN Belum Digunakan</Card.Title>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center h-100">
                <Card.Body>
                  <h1 className="display-1 text-warning">{stats.pending}</h1>
                  <Card.Title>PIN Pending</Card.Title>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center h-100">
                <Card.Body>
                  <h1 className="display-1 text-danger">{stats.used - stats.pending}</h1>
                  <Card.Title>PIN Diproses</Card.Title>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {isClient && (
            <Row>
              <Col md={6}>
                <Card className="mb-4">
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
                <Card className="mb-4">
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
        </>
      )}

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