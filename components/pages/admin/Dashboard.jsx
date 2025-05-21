"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, Row, Col, Alert, Spinner, Button, Modal } from "react-bootstrap"
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from "chart.js"
import { Pie, Bar } from "react-chartjs-2"
import { useRouter } from "next/navigation"
import { FaSync, FaExclamationTriangle } from "react-icons/fa"
import "@/styles/adminstyles.css"
import { CACHE_KEYS, CACHE_EXPIRATION, eventBus, EVENT_TYPES } from "@/lib/utils/cache-utils"
import { fetchWithCache, createTimeoutController } from "@/lib/utils/api-utils"

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

function Dashboard() {
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
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [nextAllowedFetchTime, setNextAllowedFetchTime] = useState(0)
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)
  const [showForceRefreshModal, setShowForceRefreshModal] = useState(false)

  // Reference to track if component is mounted
  const isMounted = useRef(true)
  const abortControllerRef = useRef(null)

  // Set client-side state
  useEffect(() => {
    setIsClient(true)
    return () => {
      isMounted.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Subscribe to events
  useEffect(() => {
    // Subscribe to PIN_PROCESSED events
    const unsubscribePinProcessed = eventBus.subscribe(EVENT_TYPES.PIN_PROCESSED, ({ count }) => {
      if (isMounted.current) {
        setStats((prevStats) => ({
          ...prevStats,
          pending: Math.max(0, prevStats.pending - count),
        }))
      }
    })

    // Subscribe to PIN_CREATED events
    const unsubscribePinCreated = eventBus.subscribe(EVENT_TYPES.PIN_CREATED, () => {
      if (isMounted.current) {
        fetchStats(true)
      }
    })

    // Subscribe to PIN_DELETED events
    const unsubscribePinDeleted = eventBus.subscribe(EVENT_TYPES.PIN_DELETED, () => {
      if (isMounted.current) {
        fetchStats(true)
      }
    })

    // Subscribe to PIN_IMPORTED events
    const unsubscribePinImported = eventBus.subscribe(EVENT_TYPES.PIN_IMPORTED, () => {
      if (isMounted.current) {
        fetchStats(true)
      }
    })

    return () => {
      unsubscribePinProcessed()
      unsubscribePinCreated()
      unsubscribePinDeleted()
      unsubscribePinImported()
    }
  }, [])

  // Fetch stats on component mount
  useEffect(() => {
    if (isClient) {
      fetchStats()
    }
  }, [isClient])

  // Update next allowed fetch time
  useEffect(() => {
    if (isClient) {
      const lastFetch = localStorage.getItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH)
      if (lastFetch) {
        const parsedTime = Number.parseInt(lastFetch, 10)
        setLastFetchTime(parsedTime)
        setNextAllowedFetchTime(parsedTime + CACHE_EXPIRATION.DASHBOARD)
      }
    }
  }, [isClient, lastFetchTime])

  // Fetch stats function
  const fetchStats = useCallback(
    async (force = false) => {
      if (!isClient) return

      // Check if we're allowed to fetch based on time interval
      const now = Date.now()
      if (!force && lastFetchTime && now - lastFetchTime < CACHE_EXPIRATION.DASHBOARD) {
        const timeRemaining = Math.ceil((lastFetchTime + CACHE_EXPIRATION.DASHBOARD - now) / 1000)
        setError(`Untuk menghindari rate limit, tunggu ${timeRemaining} detik sebelum refresh data.`)
        setShowRateLimitModal(true)
        return
      }

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      setIsRefreshing(true)
      setLoading(true)
      setError("")

      try {
        // Create a timeout controller
        const { signal, clear } = createTimeoutController(15000)
        abortControllerRef.current = { abort: clear }

        // Get token
        const token = sessionStorage.getItem("adminToken")
        if (!token) {
          router.push("/admin/login")
          return
        }

        // Fetch data with caching
        const data = await fetchWithCache(
          "/api/admin/stats",
          CACHE_KEYS.DASHBOARD_STATS,
          CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH,
          CACHE_EXPIRATION.DASHBOARD,
          force,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal,
          },
        )

        // Only update state if component is still mounted
        if (isMounted.current) {
          setStats(data)
          setLastFetchTime(
            Number.parseInt(localStorage.getItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH) || Date.now(), 10),
          )
          setError("")
        }
      } catch (error) {
        console.error("Error fetching stats:", error)

        if (!isMounted.current) return

        if (error.name === "AbortError" || error.name === "CanceledError") {
          setError("Permintaan timeout. Server mungkin sedang sibuk, coba lagi nanti.")
        } else if (error.response?.status === 401) {
          sessionStorage.removeItem("adminToken")
          router.push("/admin/login")
        } else if (error.response?.status === 429) {
          setError("Terlalu banyak permintaan ke server. Coba lagi dalam beberapa menit.")
          setShowRateLimitModal(true)

          // Update last fetch time to prevent immediate retries
          const backoffTime = now + 30 * 60 * 1000 // 30 minutes backoff
          localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH, backoffTime.toString())
          setLastFetchTime(backoffTime)
        } else {
          const errorMessage = error.response?.data?.error || error.response?.data?.message || "Terjadi kesalahan"
          setError("Gagal mengambil data statistik: " + errorMessage)
        }
      } finally {
        if (isMounted.current) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [isClient, lastFetchTime, router],
  )

  const handleRefresh = () => {
    const now = Date.now()
    if (lastFetchTime && now - lastFetchTime < CACHE_EXPIRATION.DASHBOARD) {
      setShowForceRefreshModal(true)
    } else {
      fetchStats(true)
    }
  }

  const handleForceRefresh = () => {
    setShowForceRefreshModal(false)
    fetchStats(true)
  }

  const formatTimeRemaining = () => {
    const now = Date.now()
    const timeRemaining = Math.max(0, nextAllowedFetchTime - now)
    const minutes = Math.floor(timeRemaining / 60000)
    const seconds = Math.floor((timeRemaining % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Custom chart colors - futuristic theme
  const chartColors = {
    primary: ["#6c63ff", "#4facfe"],
    secondary: ["#00f5a0", "#00d9f5"],
    accent: ["#ff6b6b", "#ff8e53"],
    warning: ["#ffb347", "#ffcc33"], // New color for pending
    background: "#16213e",
    text: "#ffffff",
    grid: "rgba(255, 255, 255, 0.43)",
  }

  // Common chart options
  const commonOptions = {
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
  }

  // Data untuk pie chart - updated to include pending
  const pieData = {
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
  }

  // Options for pie chart
  const pieChartOptions = {
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
  }

  // Data untuk bar chart
  const barData = {
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
  }

  // Options for bar chart
  const barOptions = {
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
  }

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
                        <Pie data={pieData} options={pieChartOptions} />
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
                        <Bar data={barData} options={barOptions} />
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
