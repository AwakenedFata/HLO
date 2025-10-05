"use client"

import React from "react"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Card, Row, Col, Alert, Spinner, Badge, Toast, ToastContainer } from "react-bootstrap"
import { useSession } from "next-auth/react"
import axios from "axios"
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from "chart.js"
import { Pie, Bar } from "react-chartjs-2"
import { useRouter } from "next/navigation"
import {
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaEye,
} from "react-icons/fa"

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

const api = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
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
  const { status } = useSession()

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
  const [connectionStatus, setConnectionStatus] = useState("connected")

  const isMounted = useRef(true)
  const abortControllerRef = useRef(null)

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

      return newStats
    })
  }, [])

  const clearError = useCallback(() => {
    setError("")
  }, [])

  const fetchStats = useCallback(async () => {
    if (status !== "authenticated") {
      console.log("⏳ Waiting for authentication..., current status:", status)
      return { waitingAuth: true }
    }

    if (!isMounted.current) {
      return { componentUnmounted: true }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setLoading(true)
    setError("")
    setConnectionStatus("connecting")

    try {
      console.log("🚀 Fetching stats from API...")

      const response = await api.get("/api/admin/stats", {
        signal: abortControllerRef.current.signal,
      })

      console.log("✅ Stats API response received:", response.status)

      if (!isMounted.current) {
        return { componentUnmounted: true }
      }

      setConnectionStatus("connected")
      const responseData = response.data

      setStats(responseData)
      setError("")
      setLoading(false)

      console.log("✅ Stats updated successfully")
      return { success: true }
    } catch (error) {
      if (!isMounted.current) {
        return { componentUnmounted: true }
      }

      if (error.name === "CanceledError" || error.name === "AbortError" || error.code === "ERR_CANCELED") {
        console.log("⏭️ Request was canceled")
        return { aborted: true }
      }

      console.error("❌ Stats fetch error:", error)

      setConnectionStatus("error")

      if (error.response?.status === 401) {
        setError("Sesi telah berakhir. Silakan login kembali.")
        return { authError: true }
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

      setLoading(false)
      return { error: true }
    }
  }, [status])

  useEffect(() => {
    isMounted.current = true

    if (status !== "authenticated") {
      console.log("⏸️ Waiting for session to be authenticated...")
      setLoading(false)
      return
    }

    console.log("✅ Session authenticated, loading initial data...")

    const loadInitialData = async () => {
      try {
        await fetchStats()
      } catch (error) {
        if (error.name === "CanceledError" || error.code === "ERR_CANCELED") {
          console.log("⏭️ Initial load was canceled, ignoring...")
          return
        }
        console.error("Error loading initial data:", error)
      }
    }

    const timer = setTimeout(loadInitialData, 100)

    return () => {
      isMounted.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      clearTimeout(timer)
    }
  }, [status, fetchStats])

  return {
    stats,
    loading,
    error,
    connectionStatus,
    updateStatsImmediately,
    clearError,
  }
}

const Dashboard = () => {
  const router = useRouter()
  const { status } = useSession()
  const [isClient, setIsClient] = useState(false)
  const [toasts, setToasts] = useState([])

  const {
    stats,
    loading,
    error,
    connectionStatus,
    updateStatsImmediately,
    clearError,
  } = useStatsData()

  const addToast = useCallback((message, type = "success", duration = 5000) => {
    const id = Date.now()
    const toast = { id, message, type, duration }
    setToasts((prev) => [...prev, toast])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  useEffect(() => {
    setIsClient(true)

    if (status !== "authenticated") {
      return
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

    window.addEventListener("pin-generated", handlePinGenerated)
    window.addEventListener("pin-deleted", handlePinDeleted)
    window.addEventListener("pin-processed", handlePinProcessed)
    window.addEventListener("pins-batch-deleted", handlePinDeleted)

    return () => {
      window.removeEventListener("pin-generated", handlePinGenerated)
      window.removeEventListener("pin-deleted", handlePinDeleted)
      window.removeEventListener("pin-processed", handlePinProcessed)
      window.removeEventListener("pins-batch-deleted", handlePinDeleted)
    }
  }, [status, updateStatsImmediately, addToast])

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

  if (status === "loading") {
    return (
      <div className="adminpaneldashboardpage">
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-2">Memuat sesi...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="adminpaneldashboardpage">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Dashboard</h1>
        <div className="d-flex align-items-center gap-2">
          {getConnectionStatusBadge()}
        </div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={clearError}>
          <FaExclamationTriangle className="me-2" />
          {error}
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

          <div className="mt-3 d-flex justify-content-between align-items-center">
            <div className="text-muted">
              Statistik PIN - Total: {stats.total.toLocaleString("id-ID")} | Tersedia:{" "}
              {stats.unused.toLocaleString("id-ID")} | Pending: {stats.pending.toLocaleString("id-ID")} | Diproses:{" "}
              {stats.processed.toLocaleString("id-ID")}
            </div>
          </div>
        </>
      )}

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

export default Dashboard