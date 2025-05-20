"use client"

import { useState, useEffect, useRef } from "react"
import {
  Row,
  Col,
  Card,
  Button,
  Form,
  Table,
  Badge,
  Alert,
  Tabs,
  Tab,
  Modal,
  Spinner,
  InputGroup,
  Dropdown,
  DropdownButton,
} from "react-bootstrap"
import { useRouter } from "next/navigation"
import axios from "axios"
import useSWR from "swr" // Import SWR
import { FaFileUpload, FaFileDownload, FaPlus, FaSync, FaTrash, FaCheck, FaFilter, FaSearch } from "react-icons/fa"
import Papa from "papaparse"
import "@/styles/adminstyles.css"

// Update the SWR fetcher to include pagination
const fetcher = async (url) => {
  if (typeof window === "undefined") return null

  const token = sessionStorage.getItem("adminToken")
  if (!token) {
    return { error: "auth", message: "No authentication token found" }
  }

  try {
    // Add pagination parameters to the URL
    const paginatedUrl = url.includes("?") ? url : `${url}?limit=500&page=1`

    const response = await axios.get(paginatedUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.data
  } catch (error) {
    // Handle 401 errors specifically
    if (error.response?.status === 401) {
      try {
        // Try to refresh the token
        const refreshToken = sessionStorage.getItem("refreshToken")
        if (!refreshToken) {
          throw new Error("No refresh token available")
        }

        const refreshResponse = await axios.post(
          "/api/auth/refresh",
          { refreshToken },
          {
            headers: {
              "Content-Type": "application/json",
            },
            withCredentials: true,
          },
        )

        if (refreshResponse.data.token) {
          // Store the new token
          sessionStorage.setItem("adminToken", refreshResponse.data.token)

          // Retry the original request with the new token
          const paginatedUrl = url.includes("?") ? url : `${url}?limit=500&page=1`
          const retryResponse = await axios.get(paginatedUrl, {
            headers: {
              Authorization: `Bearer ${refreshResponse.data.token}`,
            },
          })

          return retryResponse.data
        } else {
          // Clear the invalid token
          sessionStorage.removeItem("adminToken")
          sessionStorage.removeItem("refreshToken")
          return { error: "auth", message: "Authentication failed" }
        }
      } catch (refreshError) {
        // If token refresh fails, clear tokens and return auth error
        sessionStorage.removeItem("adminToken")
        sessionStorage.removeItem("refreshToken")
        return { error: "auth", message: "Authentication failed" }
      }
    }

    // For other errors, throw them to be caught by SWR's error handling
    throw error
  }
}

function PinManagement() {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [authError, setAuthError] = useState(false)

  // Tandai bahwa kita sudah di client-side
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Check authentication on component mount
  useEffect(() => {
    if (!isClient) return

    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      router.push("/admin/login")
    }
  }, [isClient, router])

  // Menggunakan SWR untuk data fetching dengan kondisional berdasarkan isClient
  const {
    data,
    error: swrError,
    mutate,
  } = useSWR(isClient ? "/api/admin/pins" : null, fetcher, {
    refreshInterval: 60000, // Ubah dari 30 detik menjadi 60 detik
    revalidateOnFocus: true,
    dedupingInterval: 10000, // Ubah dari 5 detik menjadi 10 detik
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // Don't retry on auth errors
      if (error?.response?.status === 401) return

      // Jangan retry pada 404
      if (error?.response?.status === 404) return

      // Jika error 429 (rate limit), tunggu lebih lama sebelum retry
      if (error?.response?.status === 429) {
        // Tunggu 1 menit sebelum mencoba lagi jika rate limited
        setTimeout(() => revalidate({ retryCount }), 60000)
        return
      }

      // Retry hingga 3 kali
      if (retryCount >= 3) return

      // Exponential backoff
      setTimeout(() => revalidate({ retryCount }), 5000 * 2 ** retryCount)
    },
  })

  // Handle authentication errors from the fetcher
  useEffect(() => {
    if (data && data.error === "auth") {
      setAuthError(true)
      // Redirect to login after a short delay
      const redirectTimer = setTimeout(() => {
        router.push("/admin/login")
      }, 2000)

      return () => clearTimeout(redirectTimer)
    }
  }, [data, router])

  // Rest of your component code remains the same...
  // State dari data SWR
  const [pins, setPins] = useState([])
  const [filteredPins, setFilteredPins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [pinCount, setPinCount] = useState(10)
  const [pinPrefix, setPinPrefix] = useState("")
  const [generating, setGenerating] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [activeTab, setActiveTab] = useState("generate")
  const [importError, setImportError] = useState("")
  const [importSuccess, setImportSuccess] = useState("")
  const [importPreview, setImportPreview] = useState([])
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef(null)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    used: 0,
    available: 0,
    pending: 0,
    processed: 0,
  })

  // Tambahkan fitur hapus multiple PIN
  // Tambahkan state untuk checkbox dan selected pins
  const [selectedPins, setSelectedPins] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false)
  const [deletingMultiple, setDeletingMultiple] = useState(false)

  // Tambahkan state untuk modal konfirmasi hapus
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [pinToDelete, setPinToDelete] = useState(null)

  // Tambahkan state untuk modal mark as processed
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [pinToProcess, setPinToProcess] = useState(null)
  const [processing, setProcessing] = useState(false)

  // Tambahkan state untuk filter dan search
  const [filterStatus, setFilterStatus] = useState("all") // all, available, pending, processed
  const [searchTerm, setSearchTerm] = useState("")

  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Update the useEffect that handles data from SWR
  useEffect(() => {
    if (data && !data.error) {
      setPins(data.pins || [])
      setTotalPages(data.totalPages || 1)

      // Calculate stats
      const total = data.pins?.length || 0
      const used = data.pins?.filter((pin) => pin.used).length || 0
      const pending = data.pins?.filter((pin) => pin.used && !pin.processed).length || 0
      const processed = data.pins?.filter((pin) => pin.used && pin.processed).length || 0

      setStats({
        total: data.total || total,
        used,
        available: total - used,
        pending,
        processed,
      })

      setLoading(false)

      // Apply filters
      applyFilters(data.pins || [], filterStatus, searchTerm)
    }
  }, [data, filterStatus, searchTerm])

  // Apply filters when filter status or search term changes
  useEffect(() => {
    applyFilters(pins, filterStatus, searchTerm)
  }, [filterStatus, searchTerm, pins])

  // Function to apply filters
  const applyFilters = (pinsData, status, search) => {
    let result = [...pinsData]

    // Apply status filter
    if (status === "available") {
      result = result.filter((pin) => !pin.used)
    } else if (status === "pending") {
      result = result.filter((pin) => pin.used && !pin.processed)
    } else if (status === "processed") {
      result = result.filter((pin) => pin.used && pin.processed)
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (pin) =>
          pin.code.toLowerCase().includes(searchLower) ||
          pin.redeemedBy?.nama?.toLowerCase().includes(searchLower) ||
          pin.redeemedBy?.idGame?.toLowerCase().includes(searchLower),
      )
    }

    setFilteredPins(result)
  }

  // Handle SWR error dengan penanganan khusus untuk error 429
  useEffect(() => {
    if (swrError) {
      console.error("Error fetching pins:", swrError)

      // Khusus untuk error 429
      if (swrError.response?.status === 429) {
        setError("Terlalu banyak permintaan ke server. Sistem akan mencoba kembali dalam 1 menit.")
      } else if (swrError.response?.status === 401) {
        if (isClient) {
          sessionStorage.removeItem("adminToken")
          router.push("/admin/login")
        }
      } else {
        setError("Gagal mengambil data PIN. " + (swrError.response?.data?.error || ""))
      }

      setLoading(false)
    }
  }, [swrError, router, isClient])

  // Fungsi untuk refresh data secara manual dengan debounce
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshTimeoutRef = useRef(null)

  const handleRefresh = () => {
    if (!isClient || isRefreshing) return

    setIsRefreshing(true)
    setLoading(true)

    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }

    // Clear dashboard and stats cache to force refresh
    localStorage.removeItem("dashboard_stats_cache")
    localStorage.removeItem("pending_pins_cache")

    // Set a timeout to prevent rapid refreshes
    refreshTimeoutRef.current = setTimeout(() => {
      mutate() // Trigger SWR revalidation
      setIsRefreshing(false)
    }, 1000)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  // Add a helper function to check authentication before making API calls
  const checkAuthAndGetToken = () => {
    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      setAuthError(true)
      router.push("/admin/login")
      return null
    }
    return token
  }

  // Add a function to handle API calls with token refresh
  const handleApiCall = async (apiCallFn) => {
    try {
      const token = checkAuthAndGetToken()
      if (!token) return null

      return await apiCallFn(token)
    } catch (error) {
      if (error.response?.status === 401) {
        try {
          // Try to refresh the token
          const refreshToken = sessionStorage.getItem("refreshToken")
          if (!refreshToken) {
            throw new Error("No refresh token available")
          }

          const refreshResponse = await axios.post(
            "/api/auth/refresh",
            { refreshToken },
            {
              headers: {
                "Content-Type": "application/json",
              },
              withCredentials: true,
            },
          )

          if (refreshResponse.data.token) {
            // Store the new token
            sessionStorage.setItem("adminToken", refreshResponse.data.token)

            // Retry the original request with the new token
            return await apiCallFn(refreshResponse.data.token)
          }
        } catch (refreshError) {
          console.error("Token refresh error:", refreshError)
          sessionStorage.removeItem("adminToken")
          sessionStorage.removeItem("refreshToken")
          setAuthError(true)
          router.push("/admin/login")
          return null
        }
      }
      throw error
    }
  }

  const handleGeneratePins = async (e) => {
    e.preventDefault()
    if (!isClient) return

    setError("")
    setSuccessMessage("")

    if (pinCount === "" || isNaN(pinCount) || pinCount <= 0 || pinCount > 1000) {
      setError("Jumlah PIN harus antara 1-1000")
      return
    }

    setGenerating(true)
    try {
      await handleApiCall(async (token) => {
        const response = await axios.post(
          `/api/admin/pins`,
          { count: Number.parseInt(pinCount), prefix: pinPrefix },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        )

        setSuccessMessage(`Berhasil generate ${response.data.count} PIN baru`)

        // Clear dashboard and stats cache to force refresh
        localStorage.removeItem("dashboard_stats_cache")

        mutate() // Refresh data setelah generate

        return response
      })
    } catch (error) {
      console.error("Error generating pins:", error)
      if (error.response?.status === 429) {
        setError("Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat.")
      } else {
        setError("Gagal generate PIN. " + (error.response?.data?.error || ""))
      }
    } finally {
      setGenerating(false)
    }
  }

  // Rest of your component methods...
  // I'm not including all of them to keep the response concise, but you should
  // update all methods that make API calls to use the handleApiCall helper
  const handleExportCSV = () => {
    if (!isClient) return

    // Buat CSV string
    const csvContent = [
      ["PIN Code", "Status", "Redeemed By", "ID Game", "Redeemed At", "Processed"],
      ...pins.map((pin) => [
        pin.code,
        pin.used ? (pin.processed ? "Processed" : "Pending") : "Available",
        pin.redeemedBy?.nama || "",
        pin.redeemedBy?.idGame || "",
        pin.redeemedBy?.redeemedAt ? new Date(pin.redeemedBy.redeemedAt).toLocaleString() : "",
        pin.processed ? "Yes" : pin.used ? "No" : "-",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    // Buat file dan download
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pin-codes-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleFileSelect = (e) => {
    if (!isClient) return

    const file = e.target.files[0]
    setImportError("")
    setImportSuccess("")
    setImportPreview([])

    if (!file) return

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setImportError("Hanya file CSV yang diperbolehkan")
      return
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setImportError("Error parsing CSV: " + results.errors[0].message)
          return
        }

        // Validasi format
        const requiredColumn = "PIN Code"
        if (!results.meta.fields.includes(requiredColumn)) {
          setImportError(`File CSV harus memiliki kolom '${requiredColumn}'`)
          return
        }

        // Preview data
        setImportPreview(results.data.slice(0, 5))
      },
      error: (error) => {
        setImportError("Error parsing CSV: " + error.message)
      },
    })
  }

  const handleImportCSV = async () => {
    if (!isClient || !fileInputRef.current?.files[0]) {
      setImportError("Pilih file CSV terlebih dahulu")
      return
    }

    setIsImporting(true)
    setImportError("")
    setImportSuccess("")

    try {
      await handleApiCall(async (token) => {
        const formData = new FormData()
        formData.append("file", fileInputRef.current.files[0])

        const response = await axios.post(`/api/admin/import-pins`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        })

        setImportSuccess(`Berhasil import ${response.data.imported} PIN`)
        fileInputRef.current.value = ""
        setImportPreview([])

        // Clear dashboard and stats cache to force refresh
        localStorage.removeItem("dashboard_stats_cache")

        mutate() // Refresh data setelah import

        return response
      })
    } catch (error) {
      console.error("Error importing pins:", error)
      if (error.response?.status === 429) {
        setImportError("Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat.")
      } else {
        setImportError("Gagal import PIN: " + (error.response?.data?.error || "Terjadi kesalahan"))
      }
    } finally {
      setIsImporting(false)
    }
  }

  // Tambahkan fungsi untuk menangani klik tombol hapus
  const handleDeleteClick = (pin) => {
    if (!isClient) return
    setPinToDelete(pin)
    setShowDeleteModal(true)
  }

  // Tambahkan fungsi untuk menghapus PIN
  const handleDeletePin = async () => {
    if (!isClient || !pinToDelete) return

    try {
      await handleApiCall(async (token) => {
        const response = await axios.delete(`/api/admin/pins/${pinToDelete._id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        // Tutup modal dan refresh data
        setShowDeleteModal(false)
        setPinToDelete(null)
        setSuccessMessage("PIN berhasil dihapus")

        // Clear dashboard and stats cache to force refresh
        localStorage.removeItem("dashboard_stats_cache")

        mutate() // Refresh data setelah hapus

        return response
      })
    } catch (error) {
      console.error("Error deleting pin:", error)
      if (error.response?.status === 429) {
        setError("Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat.")
      } else {
        setError("Gagal menghapus PIN: " + (error.response?.data?.error || "Terjadi kesalahan"))
      }
      setShowDeleteModal(false)
    }
  }

  // Tambahkan fungsi untuk menangani select all
  const handleSelectAll = (e) => {
    if (!isClient) return

    const isChecked = e.target.checked
    setSelectAll(isChecked)
    if (isChecked) {
      // Pilih semua PIN yang belum digunakan dari filtered pins
      const availablePinIds = filteredPins.filter((pin) => !pin.used).map((pin) => pin._id)
      setSelectedPins(availablePinIds)
    } else {
      setSelectedPins([])
    }
  }

  const handleSelectPin = (pinId, isChecked) => {
    if (!isClient) return

    if (isChecked) {
      setSelectedPins((prev) => [...prev, pinId])
    } else {
      setSelectedPins((prev) => prev.filter((id) => id !== pinId))
    }
  }

  const handleDeleteMultiplePins = async () => {
    if (!isClient || selectedPins.length === 0) return

    setDeletingMultiple(true)
    setError("")
    setSuccessMessage("")

    try {
      await handleApiCall(async (token) => {
        const response = await axios.post(
          `/api/admin/delete-pins`,
          { pinIds: selectedPins },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        )

        setShowDeleteMultipleModal(false)
        setSelectedPins([])
        setSelectAll(false)

        setSuccessMessage(response.data.message || "PIN berhasil dihapus")

        // Clear dashboard and stats cache to force refresh
        localStorage.removeItem("dashboard_stats_cache")

        mutate() // Refresh data setelah hapus multiple

        return response
      })
    } catch (error) {
      console.error("Error deleting multiple pins:", error)
      if (error.response?.status === 429) {
        setError("Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat.")
      } else {
        setError(error.response?.data?.error || "Terjadi kesalahan dalam penghapusan")
      }
    } finally {
      setDeletingMultiple(false)
      setShowDeleteMultipleModal(false)
    }
  }

  // Add function to handle mark as processed
  const handleProcessClick = (pin) => {
    if (!isClient) return
    setPinToProcess(pin)
    setShowProcessModal(true)
  }

  // Add function to mark PIN as processed
  const handleMarkAsProcessed = async () => {
    if (!isClient || !pinToProcess) return

    setProcessing(true)
    try {
      // Optimistic UI update
      const updatedPins = pins.map((p) => {
        if (p._id === pinToProcess._id) {
          return { ...p, processed: true }
        }
        return p
      })
      setPins(updatedPins)
      applyFilters(updatedPins, filterStatus, searchTerm)

      // Clear dashboard and stats cache to force refresh
      localStorage.removeItem("dashboard_stats_cache")
      localStorage.removeItem("pending_pins_cache")

      await handleApiCall(async (token) => {
        const response = await axios.patch(
          `/api/admin/pins/${pinToProcess._id}`,
          { processed: true },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        )

        // Close modal and refresh data
        setShowProcessModal(false)
        setPinToProcess(null)
        setSuccessMessage("PIN berhasil ditandai sebagai diproses")
        mutate() // Refresh data after update

        return response
      })
    } catch (error) {
      console.error("Error marking pin as processed:", error)
      if (error.response?.status === 429) {
        setError("Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat.")
      } else {
        setError("Gagal memproses PIN: " + (error.response?.data?.error || "Terjadi kesalahan"))
      }
      setShowProcessModal(false)
      mutate() // Refresh data to revert optimistic update
    } finally {
      setProcessing(false)
    }
  }

  // Add a function to handle page changes
  const handlePageChange = (page) => {
    setCurrentPage(page)
    mutate(`/api/admin/pins?limit=500&page=${page}`)
  }

  if (!isClient) {
    return (
      <div className="adminpanelmanajemenpinpage">
        <h1 className="mb-4">Manajemen PIN</h1>
        <div className="text-center my-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="adminpanelmanajemenpinpage">
        <h1 className="mb-4">Manajemen PIN</h1>
        <Alert variant="danger">Sesi login Anda telah berakhir. Anda akan dialihkan ke halaman login...</Alert>
      </div>
    )
  }

  // Rest of your component render code...
  return (
    <div className="adminpanelmanajemenpinpage">
      <h1 className="mb-4">Manajemen PIN</h1>

      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center h-100">
            <Card.Body>
              <h3>{stats.total}</h3>
              <p className="totalpindipinmanagement mb-0">Total PIN</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100 bg-success text-white">
            <Card.Body>
              <h3>{stats.available}</h3>
              <p className="mb-0">PIN Tersedia</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100 bg-warning text-white">
            <Card.Body>
              <h3>{stats.pending}</h3>
              <p className="mb-0">PIN Pending</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100 bg-danger text-white">
            <Card.Body>
              <h3>{stats.processed}</h3>
              <p className="mb-0">PIN Diproses</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-4">
        <Card.Header>
          <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3" fill>
            <Tab eventKey="generate" title="Generate PIN">
              <Card.Body>
                <Form onSubmit={handleGeneratePins}>
                  <Row>
                    <Col md={5}>
                      <Form.Group className="mb-3">
                        <Form.Label>Jumlah PIN</Form.Label>
                        <Form.Control
                          type="number"
                          value={pinCount === "" ? "" : pinCount}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val === "") {
                              setPinCount("")
                            } else {
                              const parsed = Number.parseInt(val)
                              if (!Number.isNaN(parsed)) {
                                setPinCount(parsed)
                              }
                            }
                          }}
                          min="1"
                          max="1000"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={5}>
                      <Form.Group className="mb-3">
                        <Form.Label>Prefix (opsional)</Form.Label>
                        <Form.Control
                          type="text"
                          value={pinPrefix}
                          onChange={(e) => setPinPrefix(e.target.value.toUpperCase())}
                          placeholder="Contoh: HLO"
                          maxLength={5}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2} className="d-flex align-items-end">
                      <Button type="submit" variant="primary" className="w-100 mb-3" disabled={generating}>
                        {generating ? (
                          "Generating..."
                        ) : (
                          <>
                            <FaPlus className="me-2" /> Generate
                          </>
                        )}
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Card.Body>
            </Tab>
            <Tab eventKey="import" title="Import CSV">
              <Card.Body>
                {importError && <Alert variant="danger">{importError}</Alert>}
                {importSuccess && <Alert variant="success">{importSuccess}</Alert>}

                <Form.Group className="mb-3">
                  <Form.Label>Upload File CSV</Form.Label>
                  <Form.Control type="file" accept=".csv" ref={fileInputRef} onChange={handleFileSelect} />
                  <Form.Text className="infotextpinmanagement">File CSV harus memiliki kolom 'PIN Code'</Form.Text>
                </Form.Group>

                {importPreview.length > 0 && (
                  <div className="mb-3">
                    <h6>Preview:</h6>
                    <Table striped bordered hover size="sm">
                      <thead>
                        <tr>
                          {Object.keys(importPreview[0]).map((key) => (
                            <th key={key}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, index) => (
                          <tr key={index}>
                            {Object.values(row).map((value, i) => (
                              <td key={i}>{value}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                    <p className="text-muted">Menampilkan {importPreview.length} dari total data</p>
                  </div>
                )}

                <Button
                  variant="success"
                  onClick={handleImportCSV}
                  disabled={isImporting || importPreview.length === 0}
                >
                  {isImporting ? (
                    "Importing..."
                  ) : (
                    <>
                      <FaFileUpload className="me-2" /> Import PIN
                    </>
                  )}
                </Button>
              </Card.Body>
            </Tab>
          </Tabs>
        </Card.Header>
      </Card>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Daftar PIN</span>
          <div>
            {selectedPins.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                className="me-2"
                onClick={() => setShowDeleteMultipleModal(true)}
                disabled={deletingMultiple}
              >
                <FaTrash className="me-1" />
                {deletingMultiple ? "Menghapus..." : `Hapus (${selectedPins.length})`}
              </Button>
            )}
            <Button
              variant="outline-primary"
              size="sm"
              className="me-2"
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
            >
              <FaSync className={`me-1 ${loading ? "fa-spin" : ""}`} />
              {loading ? "Memuat..." : "Refresh"}
            </Button>
            <Button variant="outline-success" size="sm" onClick={handleExportCSV}>
              <FaFileDownload className="me-1" /> Export CSV
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <Row className="mb-3">
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Cari PIN, nama, atau ID game..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={6} className="d-flex justify-content-end">
              <DropdownButton
                id="filter-dropdown"
                title={
                  <>
                    <FaFilter className="me-1" />
                    {filterStatus === "all" && "Semua PIN"}
                    {filterStatus === "available" && "PIN Tersedia"}
                    {filterStatus === "pending" && "PIN Pending"}
                    {filterStatus === "processed" && "PIN Diproses"}
                  </>
                }
                variant="outline-secondary"
              >
                <Dropdown.Item active={filterStatus === "all"} onClick={() => setFilterStatus("all")}>
                  Semua PIN
                </Dropdown.Item>
                <Dropdown.Item active={filterStatus === "available"} onClick={() => setFilterStatus("available")}>
                  PIN Tersedia
                </Dropdown.Item>
                <Dropdown.Item active={filterStatus === "pending"} onClick={() => setFilterStatus("pending")}>
                  PIN Pending
                </Dropdown.Item>
                <Dropdown.Item active={filterStatus === "processed"} onClick={() => setFilterStatus("processed")}>
                  PIN Diproses
                </Dropdown.Item>
              </DropdownButton>
            </Col>
          </Row>

          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>
                    <Form.Check
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      disabled={loading || filteredPins.filter((pin) => !pin.used).length === 0}
                    />
                  </th>
                  <th>PIN Code</th>
                  <th>Status</th>
                  <th>Digunakan Oleh</th>
                  <th>ID Game</th>
                  <th>Waktu Redeem</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : filteredPins.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center">
                      {searchTerm ? "Tidak ada PIN yang sesuai dengan pencarian" : "Belum ada PIN yang dibuat"}
                    </td>
                  </tr>
                ) : (
                  filteredPins.map((pin) => (
                    <tr key={pin._id}>
                      <td>
                        {!pin.used && (
                          <Form.Check
                            type="checkbox"
                            checked={selectedPins.includes(pin._id)}
                            onChange={(e) => handleSelectPin(pin._id, e.target.checked)}
                          />
                        )}
                      </td>
                      <td>
                        <code>{pin.code}</code>
                      </td>
                      <td>
                        {pin.used ? (
                          pin.processed ? (
                            <Badge bg="danger">Terpakai & Diproses</Badge>
                          ) : (
                            <Badge bg="warning">Pending</Badge>
                          )
                        ) : (
                          <Badge bg="success">Tersedia</Badge>
                        )}
                      </td>
                      <td>{pin.redeemedBy?.nama || "-"}</td>
                      <td>{pin.redeemedBy?.idGame || "-"}</td>
                      <td>{pin.redeemedBy?.redeemedAt ? new Date(pin.redeemedBy.redeemedAt).toLocaleString() : "-"}</td>
                      <td>
                        {!pin.used && (
                          <Button variant="danger" size="sm" onClick={() => handleDeleteClick(pin)} title="Hapus PIN">
                            <FaTrash />
                          </Button>
                        )}
                        {pin.used && !pin.processed && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleProcessClick(pin)}
                            title="Tandai sebagai diproses"
                          >
                            <FaCheck />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className="mt-2 text-muted">
            Menampilkan {filteredPins.length} dari {pins.length} PIN
          </div>
          <>
            {totalPages > 1 && (
              <div className="d-flex justify-content-center mt-3">
                <ul className="pagination pagination-sm">
                  <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      &laquo;
                    </button>
                  </li>
                  {[...Array(Math.min(5, totalPages)).keys()].map((page) => {
                    // Show current page and 2 pages before and after
                    const pageNum =
                      currentPage <= 3
                        ? page + 1
                        : currentPage >= totalPages - 2
                          ? totalPages - 4 + page
                          : currentPage - 2 + page

                    if (pageNum <= 0 || pageNum > totalPages) return null

                    return (
                      <li key={pageNum} className={`page-item ${currentPage === pageNum ? "active" : ""}`}>
                        <button className="page-link" onClick={() => handlePageChange(pageNum)}>
                          {pageNum}
                        </button>
                      </li>
                    )
                  })}
                  <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      &raquo;
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </>
        </Card.Body>
      </Card>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Konfirmasi Hapus</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Apakah Anda yakin ingin menghapus PIN <strong>{pinToDelete?.code}</strong>?
          <br />
          <small className="text-danger">Tindakan ini tidak dapat dibatalkan.</small>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleDeletePin}>
            Hapus
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Konfirmasi Hapus Multiple */}
      <Modal show={showDeleteMultipleModal} onHide={() => !deletingMultiple && setShowDeleteMultipleModal(false)}>
        <Modal.Header closeButton={!deletingMultiple}>
          <Modal.Title>Konfirmasi Hapus Multiple PIN</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Apakah Anda yakin ingin menghapus {selectedPins.length} PIN yang dipilih?
          <br />
          <small className="text-danger">Tindakan ini tidak dapat dibatalkan.</small>
          <div className="mt-3">
            <strong>PIN yang akan dihapus:</strong>
            <ul className="mt-2" style={{ maxHeight: "150px", overflowY: "auto" }}>
              {selectedPins.map((pinId) => {
                const pin = pins.find((p) => p._id === pinId)
                return pin ? (
                  <li key={pinId}>
                    <code>{pin.code}</code>
                  </li>
                ) : null
              })}
            </ul>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteMultipleModal(false)} disabled={deletingMultiple}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleDeleteMultiplePins} disabled={deletingMultiple}>
            {deletingMultiple ? "Menghapus..." : "Hapus"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Mark as Processed */}
      <Modal show={showProcessModal} onHide={() => !processing && setShowProcessModal(false)}>
        <Modal.Header closeButton={!processing}>
          <Modal.Title>Konfirmasi Proses PIN</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menandai PIN <strong>{pinToProcess?.code}</strong> sebagai sudah diproses?
          </p>
          {pinToProcess && (
            <div>
              <p>
                <strong>Detail Redemption:</strong>
              </p>
              <ul>
                <li>
                  <strong>Nama:</strong> {pinToProcess.redeemedBy?.nama || "-"}
                </li>
                <li>
                  <strong>ID Game:</strong> {pinToProcess.redeemedBy?.idGame || "-"}
                </li>
                <li>
                  <strong>Waktu Redeem:</strong>{" "}
                  {pinToProcess.redeemedBy?.redeemedAt
                    ? new Date(pinToProcess.redeemedBy.redeemedAt).toLocaleString()
                    : "-"}
                </li>
              </ul>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProcessModal(false)} disabled={processing}>
            Batal
          </Button>
          <Button variant="success" onClick={handleMarkAsProcessed} disabled={processing}>
            {processing ? "Memproses..." : "Tandai Sebagai Diproses"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default PinManagement
