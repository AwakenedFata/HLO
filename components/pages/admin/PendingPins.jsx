"use client"

import { useState, useEffect, useRef } from "react"
import { Card, Table, Button, Alert, Row, Col, Spinner, Modal, Form, Pagination } from "react-bootstrap"
import axios from "axios"
import { FaSync, FaCheck, FaExclamationTriangle, FaCheckDouble } from "react-icons/fa"
import { useRouter } from "next/navigation"
import "@/styles/adminstyles.css"
import { CACHE_KEYS, updatePendingCountInCaches } from "@/lib/utils/cache-utils"

function PendingPins() {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [pendingPins, setPendingPins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [processing, setProcessing] = useState(false)
  const [processingId, setProcessingId] = useState(null)
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)
  const [nextAllowedFetchTime, setNextAllowedFetchTime] = useState(0)
  const [showForceRefreshModal, setShowForceRefreshModal] = useState(false)
  const [selectedPins, setSelectedPins] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [showBatchProcessModal, setShowBatchProcessModal] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [totalItems, setTotalItems] = useState(0)

  // Minimum time between fetches (5 minutes in milliseconds)
  const MIN_FETCH_INTERVAL = 5 * 60 * 1000

  // Reference to track if component is mounted
  const isMounted = useRef(true)

  // AbortController for cancelling requests
  const abortControllerRef = useRef(null)

  useEffect(() => {
    setIsClient(true)
    return () => {
      isMounted.current = false
      // Cancel any pending requests when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Check authentication on component mount
  useEffect(() => {
    if (!isClient) return

    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      router.push("/admin/login")
    } else {
      // Load data on initial render
      fetchPendingPins()
    }
  }, [isClient, router])

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

  // Update the fetchPendingPins function to support pagination and timeout
  const fetchPendingPins = async (force = false, page = currentPage, limit = itemsPerPage) => {
    if (!isClient) return

    const token = checkAuthAndGetToken()
    if (!token) return

    // Check if we're allowed to fetch based on time interval
    const now = Date.now()
    if (!force && lastFetchTime && now - lastFetchTime < MIN_FETCH_INTERVAL) {
      const timeRemaining = Math.ceil((lastFetchTime + MIN_FETCH_INTERVAL - now) / 1000)
      setError(`Untuk menghindari rate limit, tunggu ${timeRemaining} detik sebelum refresh data.`)
      setShowRateLimitModal(true)
      return
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create a new AbortController
    abortControllerRef.current = new AbortController()

    setIsRefreshing(true)
    setLoading(true)
    setError("")

    try {
      // Set a timeout for the request (10 seconds)
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }, 10000)

      // Use the dedicated endpoint for pending pins with pagination
      const response = await axios.get(`/api/admin/pending-pins?page=${page}&limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: abortControllerRef.current.signal,
      })

      clearTimeout(timeoutId)

      // Only update state if component is still mounted
      if (!isMounted.current) return

      // Update state with pins from the dedicated endpoint
      setPendingPins(response.data.pins || [])
      setTotalPages(response.data.totalPages || 1)
      setTotalItems(response.data.total || 0)

      // Update cache with the current page data
      const cacheKey = `${CACHE_KEYS.PENDING_PINS}_page_${page}_limit_${limit}`
      localStorage.setItem(cacheKey, JSON.stringify(response.data.pins || []))
      localStorage.setItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, now.toString())
      setLastFetchTime(now)
      setNextAllowedFetchTime(now + MIN_FETCH_INTERVAL)

      // Clear any error messages
      setError("")

      // Reset selection state
      setSelectedPins([])
      setSelectAll(false)
    } catch (error) {
      console.error("Error fetching pending pins:", error)

      if (!isMounted.current) return

      if (error.name === "AbortError") {
        setError("Permintaan timeout. Server mungkin sedang sibuk, coba lagi nanti.")
      } else if (error.response?.status === 401) {
        sessionStorage.removeItem("adminToken")
        setAuthError(true)
        router.push("/admin/login")
      } else if (error.response?.status === 429) {
        setError("Terlalu banyak permintaan ke server. Coba lagi dalam beberapa menit.")
        setShowRateLimitModal(true)

        // Update last fetch time to prevent immediate retries
        localStorage.setItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, now.toString())
        setLastFetchTime(now)
        setNextAllowedFetchTime(now + MIN_FETCH_INTERVAL)
      } else {
        setError("Gagal mengambil data PIN pending: " + (error.response?.data?.error || "Terjadi kesalahan"))
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
        setIsRefreshing(false)
      }
    }
  }

  // Add a function to handle page changes
  const handlePageChange = (page) => {
    setCurrentPage(page)
    fetchPendingPins(false, page, itemsPerPage)
  }

  // Add a function to handle items per page changes
  const handleItemsPerPageChange = (e) => {
    const newItemsPerPage = Number.parseInt(e.target.value, 10)
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page
    fetchPendingPins(false, 1, newItemsPerPage)
  }

  const handleMarkAsProcessed = async (pin) => {
    if (!isClient) return

    setProcessing(true)
    setProcessingId(pin._id)
    setError("")
    setSuccessMessage("")

    try {
      const token = sessionStorage.getItem("adminToken")

      // Create a new AbortController for this request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

      // Use the optimized process-pin endpoint
      await axios.post(
        `/api/admin/process-pin`,
        { pinId: pin._id },
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

      setSuccessMessage(`PIN ${pin.code} berhasil ditandai sebagai diproses`)

      // Remove the processed pin from the list and update cache
      const updatedPins = pendingPins.filter((p) => p._id !== pin._id)
      setPendingPins(updatedPins)

      // Update the cache for the current page
      const cacheKey = `${CACHE_KEYS.PENDING_PINS}_page_${currentPage}_limit_${itemsPerPage}`
      localStorage.setItem(cacheKey, JSON.stringify(updatedPins))

      // Update global stats cache to reflect the change
      updatePendingCountInCaches(1)

      // Remove from selected pins if it was selected
      if (selectedPins.includes(pin._id)) {
        setSelectedPins((prev) => prev.filter((id) => id !== pin._id))
      }

      // If this was the last item on the page and not the first page, go to previous page
      if (updatedPins.length === 0 && currentPage > 1) {
        handlePageChange(currentPage - 1)
      } else if (updatedPins.length === 0) {
        // If it was the last item on the first page, refresh to check if there are more items
        fetchPendingPins(true)
      }
    } catch (error) {
      console.error("Error marking pin as processed:", error)

      if (!isMounted.current) return

      if (error.name === "AbortError") {
        setError("Permintaan timeout. Server mungkin sedang sibuk, coba lagi nanti.")
      } else if (error.response?.status === 429) {
        setError("Terlalu banyak permintaan. Silakan coba lagi setelah beberapa menit.")
        setShowRateLimitModal(true)
      } else {
        setError("Gagal memproses PIN: " + (error.response?.data?.error || "Terjadi kesalahan"))
      }
    } finally {
      if (isMounted.current) {
        setProcessing(false)
        setProcessingId(null)
      }
    }
  }

  const handleBatchProcess = async () => {
    if (!isClient || selectedPins.length === 0) return

    setBatchProcessing(true)
    setError("")
    setSuccessMessage("")

    try {
      const token = sessionStorage.getItem("adminToken")

      // Create a new AbortController for this request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      const response = await axios.post(
        `/api/admin/batch-process-pins`,
        { pinIds: selectedPins },
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

      const processedCount = response.data.processed || 0
      setSuccessMessage(`${processedCount} PIN berhasil ditandai sebagai diproses`)

      // Remove the processed pins from the list
      const updatedPins = pendingPins.filter((p) => !selectedPins.includes(p._id))
      setPendingPins(updatedPins)

      // Update the cache for the current page
      const cacheKey = `${CACHE_KEYS.PENDING_PINS}_page_${currentPage}_limit_${itemsPerPage}`
      localStorage.setItem(cacheKey, JSON.stringify(updatedPins))

      // Update global stats cache to reflect the changes
      updatePendingCountInCaches(processedCount)

      // Reset selection
      setSelectedPins([])
      setSelectAll(false)
      setShowBatchProcessModal(false)

      // If all items on this page were processed, refresh or go to previous page
      if (updatedPins.length === 0) {
        if (currentPage > 1) {
          handlePageChange(currentPage - 1)
        } else {
          fetchPendingPins(true)
        }
      }
    } catch (error) {
      console.error("Error batch processing pins:", error)

      if (!isMounted.current) return

      if (error.name === "AbortError") {
        setError("Permintaan timeout. Server mungkin sedang sibuk, coba lagi nanti.")
      } else if (error.response?.status === 429) {
        setError("Terlalu banyak permintaan. Silakan coba lagi setelah beberapa menit.")
        setShowRateLimitModal(true)
      } else {
        setError("Gagal memproses PIN: " + (error.response?.data?.error || "Terjadi kesalahan"))
      }
    } finally {
      if (isMounted.current) {
        setBatchProcessing(false)
        setShowBatchProcessModal(false)
      }
    }
  }

  const handleRefresh = () => {
    const now = Date.now()
    if (lastFetchTime && now - lastFetchTime < MIN_FETCH_INTERVAL) {
      setShowForceRefreshModal(true)
    } else {
      fetchPendingPins(true)
    }
  }

  const handleForceRefresh = () => {
    setShowForceRefreshModal(false)
    fetchPendingPins(true)
  }

  const formatTimeRemaining = () => {
    const now = Date.now()
    const timeRemaining = Math.max(0, nextAllowedFetchTime - now)
    const minutes = Math.floor(timeRemaining / 60000)
    const seconds = Math.floor((timeRemaining % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Handle select all pins
  const handleSelectAll = (e) => {
    const isChecked = e.target.checked
    setSelectAll(isChecked)
    if (isChecked) {
      setSelectedPins(pendingPins.map((pin) => pin._id))
    } else {
      setSelectedPins([])
    }
  }

  // Handle select individual pin
  const handleSelectPin = (pinId, isChecked) => {
    if (isChecked) {
      setSelectedPins((prev) => [...prev, pinId])
    } else {
      setSelectedPins((prev) => prev.filter((id) => id !== pinId))
      setSelectAll(false)
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

  if (!isClient) {
    return (
      <div className="adminpanelpendingpinpage">
        <h1 className="mb-4">PIN Pending</h1>
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
      <div className="adminpanelpendingpinpage">
        <h1 className="mb-4">PIN Pending</h1>
        <Alert variant="danger">Sesi login Anda telah berakhir. Anda akan dialihkan ke halaman login...</Alert>
      </div>
    )
  }

  return (
    <div className="adminpanelpendingpinpage">
      <h1 className="mb-4">PIN Pending</h1>

      {error && <Alert variant="danger">{error}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <Row className="mb-4">
        <Col>
          <Card className="text-center bg-warning text-white">
            <Card.Body>
              <h3>{totalItems}</h3>
              <p className="mb-0">Total PIN Pending</p>
              {lastFetchTime > 0 && (
                <small className="d-block mt-2">
                  Terakhir diperbarui: {new Date(lastFetchTime).toLocaleTimeString()}
                </small>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Daftar PIN Pending</span>
          <div>
            {selectedPins.length > 0 && (
              <Button
                variant="success"
                size="sm"
                className="me-2"
                onClick={() => setShowBatchProcessModal(true)}
                disabled={batchProcessing}
              >
                <FaCheckDouble className="me-1" />
                {batchProcessing ? "Memproses..." : `Proses Semua (${selectedPins.length})`}
              </Button>
            )}
            <Button variant="outline-primary" size="sm" onClick={handleRefresh} disabled={loading || isRefreshing}>
              <FaSync className={`me-1 ${isRefreshing ? "fa-spin" : ""}`} />
              {isRefreshing ? "Memuat..." : "Refresh"}
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          {loading && pendingPins.length === 0 ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <p className="mt-2">Memuat data PIN pending...</p>
            </div>
          ) : (
            <div style={{ maxHeight: "600px", overflowY: "auto" }}>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>
                      <Form.Check
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        disabled={loading || pendingPins.length === 0}
                      />
                    </th>
                    <th>PIN Code</th>
                    <th>Nama</th>
                    <th>ID Game</th>
                    <th>Waktu Redeem</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPins.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center">
                        Tidak ada PIN pending
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
                            disabled={processing && processingId === pin._id}
                          />
                        </td>
                        <td>
                          <code>{pin.code}</code>
                        </td>
                        <td>{pin.redeemedBy?.nama || "-"}</td>
                        <td>{pin.redeemedBy?.idGame || "-"}</td>
                        <td>
                          {pin.redeemedBy?.redeemedAt ? new Date(pin.redeemedBy.redeemedAt).toLocaleString() : "-"}
                        </td>
                        <td>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleMarkAsProcessed(pin)}
                            disabled={processing && processingId === pin._id}
                          >
                            {processing && processingId === pin._id ? (
                              "Memproses..."
                            ) : (
                              <>
                                <FaCheck className="me-1" /> Tandai Diproses
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          )}

          {/* Pagination controls */}
          {renderPagination()}
        </Card.Body>
      </Card>

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

      {/* Batch Process Confirmation Modal */}
      <Modal show={showBatchProcessModal} onHide={() => !batchProcessing && setShowBatchProcessModal(false)}>
        <Modal.Header closeButton={!batchProcessing}>
          <Modal.Title>
            <FaCheckDouble className="text-success me-2" />
            Konfirmasi Proses Batch
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menandai <strong>{selectedPins.length}</strong> PIN sebagai sudah diproses?
          </p>
          <Alert variant="info">
            Tindakan ini akan memproses semua PIN yang dipilih sekaligus, yang dapat meningkatkan efisiensi.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBatchProcessModal(false)} disabled={batchProcessing}>
            Batal
          </Button>
          <Button variant="success" onClick={handleBatchProcess} disabled={batchProcessing}>
            {batchProcessing ? "Memproses..." : "Proses Semua"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default PendingPins
