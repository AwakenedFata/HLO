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
  Pagination,
} from "react-bootstrap"
import { useRouter } from "next/navigation"
import axios from "axios"
import { FaFileUpload, FaFileDownload, FaPlus, FaSync, FaTrash, FaCheck, FaFilter, FaSearch } from "react-icons/fa"
import Papa from "papaparse"
import { CACHE_KEYS, invalidateAllCaches, updatePendingCountInCaches } from "@/lib/utils/cache-utils"
import "@/styles/adminstyles.css"

function PinManagement() {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [authError, setAuthError] = useState(false)

  // State for pins data
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
  const [dataFetchAttempted, setDataFetchAttempted] = useState(false) // New state to track fetch attempts
  const [initialLoadDone, setInitialLoadDone] = useState(false) // New state to track initial load

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    used: 0,
    available: 0,
    pending: 0,
    processed: 0,
  })

  // State for selection and modals
  const [selectedPins, setSelectedPins] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false)
  const [deletingMultiple, setDeletingMultiple] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [pinToDelete, setPinToDelete] = useState(null)
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [pinToProcess, setPinToProcess] = useState(null)
  const [processing, setProcessing] = useState(false)

  // State for filtering and search
  const [filterStatus, setFilterStatus] = useState("all") // all, available, pending, processed
  const [searchTerm, setSearchTerm] = useState("")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(100)
  const [totalItems, setTotalItems] = useState(0)

  // State for refresh control
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshTimeoutRef = useRef(null)

  // AbortController for cancelling requests
  const abortControllerRef = useRef(null)

  // Reference to track if component is mounted
  const isMounted = useRef(true)

  // Tandai bahwa kita sudah di client-side
  useEffect(() => {
    setIsClient(true)

    // Tambahkan event listener untuk update data
    const handleDataUpdate = () => {
      if (isMounted.current) {
        fetchPins()
      }
    }

    window.addEventListener("pin-data-updated", handleDataUpdate)
    window.addEventListener("cache-invalidated", handleDataUpdate)

    return () => {
      isMounted.current = false
      // Cancel any pending requests when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      // Remove event listeners
      window.removeEventListener("pin-data-updated", handleDataUpdate)
      window.removeEventListener("cache-invalidated", handleDataUpdate)
    }
  }, [])

  // Check authentication on component mount
  useEffect(() => {
    if (!isClient) return

    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      router.push("/admin/login")
    } else {
      // Fetch pins on initial load
      fetchPins()

      // Set a timeout to ensure data is loaded even if there are issues
      const dataLoadTimeout = setTimeout(() => {
        if (!initialLoadDone && !dataFetchAttempted) {
          console.log("Data loading taking too long, trying again")
          fetchPins()
          setDataFetchAttempted(true)
        }
      }, 3000) // 3 seconds timeout

      return () => {
        clearTimeout(dataLoadTimeout)
      }
    }
  }, [isClient, router])

  // Apply filters when filter status or search term changes
  useEffect(() => {
    applyFilters(pins, filterStatus, searchTerm)
  }, [filterStatus, searchTerm, pins])

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

  // Function to fetch pins with pagination
  const fetchPins = async (page = currentPage, limit = itemsPerPage) => {
    if (!isClient) return

    const token = checkAuthAndGetToken()
    if (!token) return

    setLoading(true)
    setError("")
    setDataFetchAttempted(true)

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create a new AbortController
    abortControllerRef.current = new AbortController()

    try {
      // Set a timeout for the request (15 seconds)
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current && isMounted.current) {
          abortControllerRef.current.abort()
        }
      }, 15000)

      // Build query parameters for filtering
      let queryParams = `?page=${page}&limit=${limit}`
      if (filterStatus === "available") {
        queryParams += "&used=false"
      } else if (filterStatus === "pending") {
        queryParams += "&used=true&processed=false"
      } else if (filterStatus === "processed") {
        queryParams += "&used=true&processed=true"
      }

      if (searchTerm) {
        queryParams += `&search=${encodeURIComponent(searchTerm)}`
      }

      const response = await axios.get(`/api/admin/pins${queryParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: abortControllerRef.current.signal,
      })

      clearTimeout(timeoutId)

      // Only update state if component is still mounted
      if (!isMounted.current) return

      setPins(response.data.pins || [])
      setTotalPages(response.data.totalPages || 1)
      setTotalItems(response.data.total || 0)

      // Update stats if available in response
      if (response.data.stats) {
        setStats(response.data.stats)

        // Cache the stats for other components to use
        localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS, JSON.stringify(response.data.stats))
        localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH, Date.now().toString())
      } else {
        // Calculate stats from pins data
        const total = response.data.total || response.data.pins?.length || 0
        const used = response.data.pins?.filter((pin) => pin.used).length || 0
        const pending = response.data.pins?.filter((pin) => pin.used && !pin.processed).length || 0
        const processed = response.data.pins?.filter((pin) => pin.used && pin.processed).length || 0

        const calculatedStats = {
          total,
          used,
          available: total - used,
          pending,
          processed,
        }

        setStats(calculatedStats)

        // Cache the calculated stats
        localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS, JSON.stringify(calculatedStats))
        localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH, Date.now().toString())
      }

      // Apply filters to the fetched data
      applyFilters(response.data.pins || [], filterStatus, searchTerm)

      setLoading(false)
      setIsRefreshing(false)
      setInitialLoadDone(true)
    } catch (error) {
      console.error("Error fetching pins:", error)

      if (!isMounted.current) return

      if (error.name === "AbortError") {
        setError("Permintaan timeout. Server mungkin sedang sibuk, coba lagi nanti.")
      } else if (error.response?.status === 401) {
        sessionStorage.removeItem("adminToken")
        setAuthError(true)
        router.push("/admin/login")
      } else if (error.response?.status === 429) {
        setError("Terlalu banyak permintaan ke server. Coba lagi dalam beberapa menit.")
      } else {
        setError("Gagal mengambil data PIN: " + (error.response?.data?.error || "Terjadi kesalahan"))
      }

      setLoading(false)
      setIsRefreshing(false)
      setInitialLoadDone(true) // Mark as done even if there was an error
    }
  }

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

  // Function to refresh data manually with debounce
  const handleRefresh = () => {
    if (!isClient || isRefreshing) return

    setIsRefreshing(true)
    setLoading(true)

    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current)
    }

    // Invalidate all caches to force refresh
    invalidateAllCaches()

    // Set a timeout to prevent rapid refreshes
    refreshTimeoutRef.current = setTimeout(() => {
      fetchPins(currentPage, itemsPerPage)
    }, 1000)
  }

  // Function to handle page changes
  const handlePageChange = (page) => {
    setCurrentPage(page)
    fetchPins(page, itemsPerPage)
  }

  // Function to handle items per page changes
  const handleItemsPerPageChange = (e) => {
    const newItemsPerPage = Number.parseInt(e.target.value, 10)
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page
    fetchPins(1, newItemsPerPage)
  }

  // Function to generate PINs
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
      const token = checkAuthAndGetToken()
      if (!token) return

      // Create a new AbortController for this request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout for PIN generation

      const response = await axios.post(
        `/api/admin/pins`,
        { count: Number.parseInt(pinCount), prefix: pinPrefix },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        },
      )

      clearTimeout(timeoutId)

      // Only update if component is still mounted
      if (!isMounted.current) return

      setSuccessMessage(`Berhasil generate ${response.data.count} PIN baru`)

      // Invalidate all caches to force refresh
      invalidateAllCaches()

      // Broadcast event untuk memberi tahu komponen lain
      window.dispatchEvent(new CustomEvent("cache-invalidated"))

      // Refresh data after generate
      fetchPins()
    } catch (error) {
      console.error("Error generating pins:", error)

      if (!isMounted.current) return

      if (error.name === "AbortError") {
        setError("Permintaan timeout. Server mungkin sedang sibuk, coba lagi nanti.")
      } else if (error.response?.status === 429) {
        setError("Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat.")
      } else {
        setError("Gagal generate PIN. " + (error.response?.data?.error || ""))
      }
    } finally {
      if (isMounted.current) {
        setGenerating(false)
      }
    }
  }

  // Render pagination controls
  const renderPagination = () => {
    if (totalPages <= 1) return null

    const items = []
    const maxVisiblePages = 5

    // Calculate range of pages to show
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    // Adjust if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    // Previous button
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

    // Next button
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
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </Form.Select>
          <span className="ms-3">
            Showing {filteredPins.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{" "}
            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
          </span>
        </div>
        <Pagination size="sm" className="mb-0">
          {items}
        </Pagination>
      </div>
    )
  }

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
      const token = checkAuthAndGetToken()
      if (!token) return

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

      // Invalidate all caches to force refresh
      invalidateAllCaches()

      // Broadcast event untuk memberi tahu komponen lain
      window.dispatchEvent(new CustomEvent("cache-invalidated"))

      // Refresh data after import
      fetchPins()

      return response
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
      const token = checkAuthAndGetToken()
      if (!token) return

      const response = await axios.delete(`/api/admin/pins/${pinToDelete._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      // Tutup modal dan refresh data
      setShowDeleteModal(false)
      setPinToDelete(null)
      setSuccessMessage("PIN berhasil dihapus")

      // Invalidate all caches to force refresh
      invalidateAllCaches()

      // Broadcast event untuk memberi tahu komponen lain
      window.dispatchEvent(new CustomEvent("cache-invalidated"))

      fetchPins() // Refresh data setelah hapus

      return response
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
      const token = checkAuthAndGetToken()
      if (!token) return

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

      // Invalidate all caches to force refresh
      invalidateAllCaches()

      // Broadcast event untuk memberi tahu komponen lain
      window.dispatchEvent(new CustomEvent("cache-invalidated"))

      fetchPins() // Refresh data setelah hapus multiple

      return response
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

      const token = checkAuthAndGetToken()
      if (!token) return

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

      // Update global stats cache to reflect the change
      updatePendingCountInCaches(1)

      // Broadcast event untuk memberi tahu komponen lain
      window.dispatchEvent(
        new CustomEvent("pin-data-updated", {
          detail: { processedCount: 1 },
        }),
      )

      // Refresh data after update
      fetchPins()

      return response
    } catch (error) {
      console.error("Error marking pin as processed:", error)
      if (error.response?.status === 429) {
        setError("Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat.")
      } else {
        setError("Gagal memproses PIN: " + (error.response?.data?.error || "Terjadi kesalahan"))
      }
      setShowProcessModal(false)
      fetchPins() // Refresh data to revert optimistic update
    } finally {
      setProcessing(false)
    }
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
              <FaSync className={`me-1 ${isRefreshing ? "fa-spin" : ""}`} />
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
            Menampilkan {filteredPins.length} dari {totalItems} PIN
          </div>

          {/* Pagination controls */}
          {renderPagination()}
        </Card.Body>
      </Card>

      {/* Modal Konfirmasi Hapus */}
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
