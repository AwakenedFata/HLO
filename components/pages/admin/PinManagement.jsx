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
import axios from "axios"
import { FaFileUpload, FaFileDownload, FaPlus, FaSync, FaTrash, FaCheck, FaFilter, FaSearch } from "react-icons/fa"
import Papa from "papaparse"
import "@/styles/adminstyles.css"
import useApiWithCache from "@/hooks/use-api-with-cache"
import useAuth from "@/hooks/use-auth"
import { CACHE_KEYS, CACHE_EXPIRATION, EVENT_TYPES, eventBus } from "@/lib/utils/cache-utils"

function PinManagement() {
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
  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState("")

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    used: 0,
    available: 0,
    pending: 0,
    processed: 0,
  })

  // Selection state
  const [selectedPins, setSelectedPins] = useState([])
  const [selectAll, setSelectAll] = useState(false)

  // Modal state
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false)
  const [deletingMultiple, setDeletingMultiple] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [pinToDelete, setPinToDelete] = useState(null)
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [pinToProcess, setPinToProcess] = useState(null)
  const [processing, setProcessing] = useState(false)

  // Filter state
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredPins, setFilteredPins] = useState([])

  // Use auth hook
  const { isAuthenticated, isLoading: authLoading, authFetch } = useAuth()

  // Use API with cache hook for pins
  const {
    data: apiData,
    loading,
    error: apiError,
    isRefreshing,
    mutate,
    page,
    totalPages,
    totalItems,
    changePage,
  } = useApiWithCache(
    "/api/admin/pins",
    CACHE_KEYS.PIN_MANAGEMENT,
    CACHE_KEYS.PIN_MANAGEMENT_LAST_FETCH,
    CACHE_EXPIRATION.PIN_MANAGEMENT,
    [], // dependencies
    [EVENT_TYPES.PIN_PROCESSED, EVENT_TYPES.PIN_CREATED, EVENT_TYPES.PIN_DELETED, EVENT_TYPES.PIN_IMPORTED], // invalidate on these events
    {
      initialData: { pins: [], total: 0, totalPages: 1 },
      withPagination: true,
      pageSize: 500,
      transformResponse: (data) => data,
    },
  )

  // Extract pins from API data
  const pins = apiData?.pins || []

  // Set client-side state
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Apply filters when filter status or search term changes
  useEffect(() => {
    if (pins.length > 0) {
      applyFilters(pins, filterStatus, searchTerm)
    }
  }, [filterStatus, searchTerm, pins])

  // Calculate stats from pins data
  useEffect(() => {
    if (pins.length > 0) {
      const total = pins.length
      const used = pins.filter((pin) => pin.used).length
      const pending = pins.filter((pin) => pin.used && !pin.processed).length
      const processed = pins.filter((pin) => pin.used && pin.processed).length

      setStats({
        total: apiData.total || total,
        used,
        available: total - used,
        pending,
        processed,
      })
    }
  }, [pins, apiData])

  // Reset selection when pins change
  useEffect(() => {
    setSelectedPins([])
    setSelectAll(false)
  }, [pins])

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
      await authFetch(async () => {
        const response = await axios.post(
          `/api/admin/pins`,
          { count: Number.parseInt(pinCount), prefix: pinPrefix },
          {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem("adminToken")}`,
              "Content-Type": "application/json",
            },
          },
        )

        setSuccessMessage(`Berhasil generate ${response.data.count} PIN baru`)

        // Publish event for other components to react
        eventBus.publish(EVENT_TYPES.PIN_CREATED, { count: response.data.count })

        // Refresh data
        mutate(true)

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
      await authFetch(async () => {
        const formData = new FormData()
        formData.append("file", fileInputRef.current.files[0])

        const response = await axios.post(`/api/admin/import-pins`, formData, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("adminToken")}`,
            "Content-Type": "multipart/form-data",
          },
        })

        setImportSuccess(`Berhasil import ${response.data.imported} PIN`)
        fileInputRef.current.value = ""
        setImportPreview([])

        // Publish event for other components to react
        eventBus.publish(EVENT_TYPES.PIN_IMPORTED, { count: response.data.imported })

        // Refresh data
        mutate(true)

        return response
      })
    } catch (error) {
      console.error("Error importing pins:", error)
      if (error.response?.status === 429) {
        setError("Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat.")
      } else {
        setError("Gagal import PIN: " + (error.response?.data?.error || "Terjadi kesalahan"))
      }
    } finally {
      setIsImporting(false)
    }
  }

  const handleDeleteClick = (pin) => {
    if (!isClient) return
    setPinToDelete(pin)
    setShowDeleteModal(true)
  }

  const handleDeletePin = async () => {
    if (!isClient || !pinToDelete) return

    try {
      await authFetch(async () => {
        const response = await axios.delete(`/api/admin/pins/${pinToDelete._id}`, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("adminToken")}`,
          },
        })

        // Tutup modal dan refresh data
        setShowDeleteModal(false)
        setPinToDelete(null)
        setSuccessMessage("PIN berhasil dihapus")

        // Publish event for other components to react
        eventBus.publish(EVENT_TYPES.PIN_DELETED, { count: 1 })

        // Refresh data
        mutate(true)

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
      setSelectAll(false)
    }
  }

  const handleDeleteMultiplePins = async () => {
    if (!isClient || selectedPins.length === 0) return

    setDeletingMultiple(true)
    setError("")
    setSuccessMessage("")

    try {
      await authFetch(async () => {
        const response = await axios.post(
          `/api/admin/delete-pins`,
          { pinIds: selectedPins },
          {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem("adminToken")}`,
            },
          },
        )

        setShowDeleteMultipleModal(false)
        setSelectedPins([])
        setSelectAll(false)

        setSuccessMessage(response.data.message || "PIN berhasil dihapus")

        // Publish event for other components to react
        eventBus.publish(EVENT_TYPES.PIN_DELETED, { count: selectedPins.length })

        // Refresh data
        mutate(true)

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

  const handleProcessClick = (pin) => {
    if (!isClient) return
    setPinToProcess(pin)
    setShowProcessModal(true)
  }

  const handleMarkAsProcessed = async () => {
    if (!isClient || !pinToProcess) return

    setProcessing(true)
    try {
      await authFetch(async () => {
        const response = await axios.patch(
          `/api/admin/pins/${pinToProcess._id}`,
          { processed: true },
          {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem("adminToken")}`,
              "Content-Type": "application/json",
            },
          },
        )

        // Close modal and refresh data
        setShowProcessModal(false)
        setPinToProcess(null)
        setSuccessMessage("PIN berhasil ditandai sebagai diproses")

        // Publish event for other components to react
        eventBus.publish(EVENT_TYPES.PIN_PROCESSED, { count: 1 })

        // Refresh data
        mutate(true)

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
    } finally {
      setProcessing(false)
    }
  }

  // Render pagination controls
  const renderPagination = () => {
    if (totalPages <= 1) return null

    const items = []
    const maxVisiblePages = 5

    // Calculate range of pages to show
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    // Adjust if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    // Previous button
    items.push(<Pagination.Prev key="prev" disabled={page === 1} onClick={() => changePage(page - 1)} />)

    // First page
    if (startPage > 1) {
      items.push(
        <Pagination.Item key={1} onClick={() => changePage(1)}>
          1
        </Pagination.Item>,
      )
      if (startPage > 2) {
        items.push(<Pagination.Ellipsis key="ellipsis1" />)
      }
    }

    // Page numbers
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      items.push(
        <Pagination.Item key={pageNum} active={pageNum === page} onClick={() => changePage(pageNum)}>
          {pageNum}
        </Pagination.Item>,
      )
    }

    // Last page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<Pagination.Ellipsis key="ellipsis2" />)
      }
      items.push(
        <Pagination.Item key={totalPages} onClick={() => changePage(totalPages)}>
          {totalPages}
        </Pagination.Item>,
      )
    }

    // Next button
    items.push(<Pagination.Next key="next" disabled={page === totalPages} onClick={() => changePage(page + 1)} />)

    return (
      <div className="d-flex justify-content-center mt-3">
        <Pagination size="sm">{items}</Pagination>
      </div>
    )
  }

  // Show loading state during initial auth check
  if (authLoading) {
    return (
      <div className="adminpanelmanajemenpinpage">
        <h1 className="mb-4">Manajemen PIN</h1>
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-2">Verifying authentication...</p>
        </div>
      </div>
    )
  }

  // Show loading state if not client-side yet
  if (!isClient) {
    return (
      <div className="adminpanelmanajemenpinpage">
        <h1 className="mb-4">Manajemen PIN</h1>
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-2">Loading PIN management...</p>
        </div>
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
              onClick={() => mutate(true)}
              disabled={loading || isRefreshing}
            >
              <FaSync className={`me-1 ${isRefreshing ? "fa-spin" : ""}`} />
              {isRefreshing ? "Memuat..." : "Refresh"}
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
