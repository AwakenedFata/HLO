
"use client"

import { useEffect, useState, useCallback, useRef } from "react"
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
  OverlayTrigger,
  Tooltip,
  Toast,
  ToastContainer,
} from "react-bootstrap"
import {
  FaPlus,
  FaSync,
  FaTrash,
  FaFilter,
  FaSearch,
  FaExclamationTriangle,
  FaEye,
  FaCheckCircle,
  FaTimesCircle,
  FaBoxes,
  FaBarcode,
  FaLock,
  FaLockOpen,
  FaEdit,
  FaCalendarAlt,
  FaMapMarkerAlt,
} from "react-icons/fa"

const initialForm = {
  product: { name: "", productionDate: "" },
  code: "",
}

const initialBatch = {
  productName: "",
  productionDate: "",
  count: 100,
  digits: 6,
  startFrom: "",
}

export default function VerifikasiOrisinalManagement() {
  const isMountedRef = useRef(false)

  // States
  const [isClient, setIsClient] = useState(false)
  const [serials, setSerials] = useState([])
  const [filteredSerials, setFilteredSerials] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(50)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [batch, setBatch] = useState(initialBatch)
  const [activeTab, setActiveTab] = useState("manual")
  const [error, setError] = useState("")
  const [toasts, setToasts] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showEditDateModal, setShowEditDateModal] = useState(false)
  const [editingSerial, setEditingSerial] = useState(null)
  const [editDate, setEditDate] = useState("")

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [serialToDelete, setSerialToDelete] = useState(null)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    verified: 0,
    used: 0,
  })

  // Toast helper
  const addToast = useCallback((message, type = "success", duration = 5000) => {
    const id = Date.now()
    const toast = { id, message, type, duration }
    setToasts((prev) => [...prev, toast])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!isMountedRef.current) return

    setLoading(true)
    setError("")

    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", String(limit))
      if (search) params.set("search", search)
      if (filterStatus === "true" || filterStatus === "false") params.set("active", filterStatus)

      const res = await fetch(`/api/admin/serials?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Gagal mengambil data")

      const data = await res.json()

      if (isMountedRef.current) {
        setSerials(data.items || [])
        setFilteredSerials(data.items || [])
        setTotalPages(data.totalPages || 1)
        setTotal(data.total || 0)

        // Calculate stats
        const items = data.items || []
        setStats({
          total: items.length,
          active: items.filter((s) => s.isActive).length,
          inactive: items.filter((s) => !s.isActive).length,
          verified: items.reduce((sum, s) => sum + (s.verificationCount || 0), 0),
          used: items.filter((s) => s.isVerified).length,
        })
      }
    } catch (e) {
      console.error(e)
      if (isMountedRef.current) {
        setError(e.message || "Gagal memuat data")
        addToast(e.message || "Gagal memuat data", "error")
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [page, limit, search, filterStatus, addToast])

  useEffect(() => {
    isMountedRef.current = true
    setIsClient(true)

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (isClient) {
      fetchData()
    }
  }, [isClient, page, filterStatus, fetchData])

  // Create serial
  const onCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError("")

    try {
      const code = String(form.code || "")
        .toUpperCase()
        .trim()
      if (!/^\d{6}$/.test(code)) {
        throw new Error("Kode harus 6 digit angka (contoh: 000001)")
      }

      const payload = {
        code,
        productName: form.product.name || "",
        productionDate: form.product.productionDate || "",
      }

      const res = await fetch("/api/admin/serials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || data?.error || "Gagal membuat serial")

      setForm(initialForm)
      fetchData()
      addToast("Serial berhasil ditambahkan", "success")
    } catch (e) {
      setError(e.message || "Gagal membuat serial")
      addToast(e.message || "Gagal membuat serial", "error")
    } finally {
      setCreating(false)
    }
  }

  // Batch create
  const onBatch = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError("")

    try {
      const payload = {
        productName: batch.productName || "",
        productionDate: batch.productionDate || "",
        count: Number(batch.count || 0),
        digits: Number(batch.digits || 6),
        startFrom: batch.startFrom ? String(batch.startFrom) : undefined,
      }

      if (payload.count < 1) throw new Error("Jumlah minimal 1")
      if (payload.digits < 4 || payload.digits > 12) throw new Error("Digit harus 4-12")
      if (payload.startFrom && !/^\d+$/.test(payload.startFrom)) throw new Error("startFrom harus angka")
      if (payload.startFrom && payload.startFrom.length !== payload.digits)
        throw new Error(`startFrom harus ${payload.digits} digit`)

      const res = await fetch("/api/admin/serials/batch-process-serials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || data?.error || "Gagal batch")

      setBatch(initialBatch)
      fetchData()
      addToast(`Batch selesai. Dibuat: ${data.created}, dilewati: ${data.skipped}`, "success")
    } catch (e) {
      setError(e.message || "Gagal batch")
      addToast(e.message || "Gagal batch", "error")
    } finally {
      setCreating(false)
    }
  }

  // Delete serial
  const handleDeleteSerial = async () => {
    if (!serialToDelete) return

    setDeletingId(serialToDelete._id)
    try {
      const res = await fetch(`/api/admin/serials/${serialToDelete._id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || data?.error || "Gagal menghapus")

      setShowDeleteModal(false)
      setSerialToDelete(null)
      fetchData()
      addToast("Serial berhasil dihapus", "success")
    } catch (e) {
      setError(e.message || "Gagal menghapus")
      addToast(e.message || "Gagal menghapus", "error")
    } finally {
      setDeletingId(null)
    }
  }

  // Bulk delete serials
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkDeleting(true)
    try {
      const res = await fetch("/api/admin/serials/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || data?.error || "Gagal menghapus massal")
      setShowBulkDeleteModal(false)
      setSelectedIds(new Set())
      fetchData()
      addToast(`Berhasil menghapus ${data.deleted ?? ids.length} item`, "success")
    } catch (e) {
      setError(e.message || "Gagal menghapus massal")
      addToast(e.message || "Gagal menghapus massal", "error")
    } finally {
      setBulkDeleting(false)
    }
  }

  // Toggle active status
  const onToggleActive = async (id, isActive) => {
    try {
      const res = await fetch(`/api/admin/serials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || data?.error || "Gagal update")

      fetchData()
      addToast(`Serial berhasil ${!isActive ? "diaktifkan" : "dinonaktifkan"}`, "success")
    } catch (e) {
      setError(e.message || "Gagal update")
      addToast(e.message || "Gagal update", "error")
    }
  }

  // Edit production date
  const handleEditDate = async () => {
    if (!editingSerial) return

    try {
      const res = await fetch(`/api/admin/serials/${editingSerial._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionDate: editDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || data?.error || "Gagal update tanggal produksi")

      setShowEditDateModal(false)
      setEditingSerial(null)
      fetchData()
      addToast("Tanggal produksi berhasil diubah", "success")
    } catch (e) {
      setError(e.message || "Gagal update tanggal produksi")
      addToast(e.message || "Gagal update tanggal produksi", "error")
    }
  }

  // Handle search
  const handleSearchChange = useCallback((value) => {
    setSearch(value)
  }, [])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchData()
    addToast("Data berhasil diperbarui", "success")
  }, [fetchData, addToast])

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    setPage(newPage)
  }, [])

  // Handle items per page change
  const handleItemsPerPageChange = useCallback((e) => {
    const newLimit = Number.parseInt(e.target.value, 10)
    setLimit(newLimit)
    setPage(1)
  }, [])

  // Handle bulk selection
  const handleBulkSelect = useCallback(
    (id, checked) => {
      const newSelectedIds = new Set(selectedIds)
      if (checked) {
        newSelectedIds.add(id)
      } else {
        newSelectedIds.delete(id)
      }
      setSelectedIds(newSelectedIds)
    },
    [selectedIds],
  )

  // Stats cards data
  const statsCards = [
    {
      title: "Total Serial",
      value: total,
      variant: "primary",
      icon: FaBarcode,
    },
    {
      title: "Serial Aktif",
      value: stats.active,
      variant: "success",
      icon: FaCheckCircle,
    },
    {
      title: "Sudah Digunakan",
      value: stats.used,
      variant: "warning",
      icon: FaLock,
    },
    {
      title: "Total Verifikasi",
      value: stats.verified,
      variant: "info",
      icon: FaEye,
    },
  ]

  // Render pagination
  const renderPagination = () => {
    if (totalPages <= 1) return null

    const items = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    items.push(<Pagination.Prev key="prev" disabled={page === 1} onClick={() => handlePageChange(page - 1)} />)

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

    for (let p = startPage; p <= endPage; p++) {
      items.push(
        <Pagination.Item key={p} active={p === page} onClick={() => handlePageChange(p)}>
          {p}
        </Pagination.Item>,
      )
    }

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

    items.push(<Pagination.Next key="next" disabled={page === totalPages} onClick={() => handlePageChange(page + 1)} />)

    return (
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="d-flex align-items-center">
          <span className="me-2 text-white">Items per page:</span>
          <Form.Select size="sm" value={limit} onChange={handleItemsPerPageChange} style={{ width: "80px" }}>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Form.Select>
          <span className="ms-3 text-white">
            Showing {filteredSerials.length > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, total)} of{" "}
            {total}
          </span>
        </div>
        <Pagination size="sm" className="mb-0">
          {items}
        </Pagination>
      </div>
    )
  }

  // Select helpers
  const isPageAllSelected = serials.length > 0 && serials.every((s) => selectedIds.has(s._id))

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAllPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (isPageAllSelected) {
        serials.forEach((s) => next.delete(s._id))
      } else {
        serials.forEach((s) => next.add(s._id))
      }
      return next
    })
  }, [isPageAllSelected, serials])

  if (!isClient) {
    return (
      <div className="adminpanelmanajemenpinpage">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Memuat aplikasi...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="adminpanelmanajemenpinpage">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Manajemen Serial Number</h1>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")} className="mb-4">
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Row className="mb-4">
        {statsCards.map((stat, index) => (
          <Col md={3} key={index}>
            <Card className={`text-center h-100 border-${stat.variant}`}>
              <Card.Body>
                <div className="d-flex justify-content-center align-items-center mb-2">
                  <stat.icon className={`text-${stat.variant} me-2`} size={24} />
                  <h3 className="mb-0">{stat.value.toLocaleString("id-ID")}</h3>
                </div>
                <p className="mb-0 text-muted">{stat.title}</p>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Action Tabs */}
      <Card className="mb-4 shadow-sm">
        <Card.Header>
          <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="border-0" fill>
            <Tab
              eventKey="manual"
              title={
                <>
                  <FaPlus className="me-2" />
                  Tambah Manual
                </>
              }
            >
              <div className="p-3">
                <Form onSubmit={onCreate}>
                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nama Produk (opsional)</Form.Label>
                        <Form.Control
                          type="text"
                          value={form.product.name}
                          onChange={(e) => setForm((s) => ({ ...s, product: { ...s.product, name: e.target.value } }))}
                          placeholder="Masukkan nama produk"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Tanggal (opsional)</Form.Label>
                        <Form.Control
                          type="date"
                          value={form.product.productionDate || ""}
                          onChange={(e) =>
                            setForm((s) => ({ ...s, product: { ...s.product, productionDate: e.target.value } }))
                          }
                          placeholder="YYYY-MM-DD"
                        />
                        <Form.Text muted>Gunakan format YYYY-MM-DD</Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Kode Serial (6 digit)</Form.Label>
                        <Form.Control
                          type="text"
                          value={form.code}
                          onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
                          placeholder="000001"
                          maxLength={12}
                          style={{ textTransform: "uppercase" }}
                        />
                        <Form.Text muted>Masukkan kode 6 digit angka</Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={12} className="d-flex align-items-start">
                      <Button type="submit" variant="primary" disabled={creating}>
                        {creating ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                          </>
                        ) : (
                          <>
                            <FaPlus className="me-2" /> Tambah
                          </>
                        )}
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </div>
            </Tab>
            <Tab
              eventKey="batch"
              title={
                <>
                  <FaBoxes className="me-2" />
                  Batch Sequential
                </>
              }
            >
              <div className="p-3">
                <Form onSubmit={onBatch}>
                  <Row>
                    <Col md={3}>
                      <Form.Group className="mb-3">
                        <Form.Label>Nama Produk</Form.Label>
                        <Form.Control
                          type="text"
                          value={batch.productName}
                          onChange={(e) => setBatch((s) => ({ ...s, productName: e.target.value }))}
                          placeholder="opsional"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group className="mb-3">
                        <Form.Label>Tanggal Produksi</Form.Label>
                        <Form.Control
                          type="date"
                          value={batch.productionDate}
                          onChange={(e) => setBatch((s) => ({ ...s, productionDate: e.target.value }))}
                          placeholder="YYYY-MM-DD"
                        />
                        <Form.Text muted>(opsional)</Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-3">
                        <Form.Label>Jumlah</Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          max={100000}
                          value={batch.count}
                          onChange={(e) => setBatch((s) => ({ ...s, count: Number(e.target.value || 0) }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2}>
                      <Form.Group className="mb-3">
                        <Form.Label>Digit</Form.Label>
                        <Form.Control
                          type="number"
                          min={4}
                          max={12}
                          value={batch.digits}
                          onChange={(e) => setBatch((s) => ({ ...s, digits: Number(e.target.value || 6) }))}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group className="mb-3">
                        <Form.Label>Mulai Dari (opsional)</Form.Label>
                        <Form.Control
                          type="text"
                          value={batch.startFrom}
                          onChange={(e) => setBatch((s) => ({ ...s, startFrom: e.target.value }))}
                          placeholder="000001"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={2} className="d-flex align-items-start">
                      <Button
                        type="submit"
                        variant="warning"
                        className="w-100"
                        disabled={creating}
                        style={{ marginTop: "35px" }}
                      >
                        {creating ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                          </>
                        ) : (
                          <>
                            <FaBoxes className="me-2" /> Batch
                          </>
                        )}
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </div>
            </Tab>
          </Tabs>
        </Card.Header>
      </Card>

      {/* Serial List */}
      <Card className="shadow-sm">
        <Card.Header className="bg-light">
          <div className="d-flex justify-content-between align-items-center">
            <span className="fw-bold">Daftar Serial Number</span>
            <div className="d-flex gap-2">
              {selectedIds.size > 0 && (
                <Button variant="danger" size="sm" onClick={() => setShowBulkDeleteModal(true)} disabled={bulkDeleting}>
                  <FaTrash className="me-1" />
                  {bulkDeleting ? "Menghapus..." : `Hapus (${selectedIds.size})`}
                </Button>
              )}
              <Button variant="outline-primary" size="sm" onClick={handleRefresh} disabled={loading}>
                <FaSync className={`me-1 ${loading ? "fa-spin" : ""}`} />
                {loading ? "Memuat..." : "Refresh"}
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {/* Search and Filter */}
          <Row className="mb-3">
            <Col md={8}>
              <InputGroup>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Cari code atau nama produk..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
                {search && (
                  <Button variant="outline-secondary" onClick={() => handleSearchChange("")}>
                    &times;
                  </Button>
                )}
              </InputGroup>
            </Col>
            <Col md={4} className="d-flex justify-content-end">
              <DropdownButton
                title={
                  <>
                    <FaFilter className="me-1" />
                    {filterStatus === "all" && "Semua Status"}
                    {filterStatus === "true" && "Aktif"}
                    {filterStatus === "false" && "Nonaktif"}
                  </>
                }
                variant="outline-secondary"
              >
                <Dropdown.Item active={filterStatus === "all"} onClick={() => setFilterStatus("all")}>
                  <FaEye className="me-2" />
                  Semua Status
                </Dropdown.Item>
                <Dropdown.Item active={filterStatus === "true"} onClick={() => setFilterStatus("true")}>
                  <FaCheckCircle className="me-2 text-success" />
                  Aktif
                </Dropdown.Item>
                <Dropdown.Item active={filterStatus === "false"} onClick={() => setFilterStatus("false")}>
                  <FaTimesCircle className="me-2 text-danger" />
                  Nonaktif
                </Dropdown.Item>
              </DropdownButton>
            </Col>
          </Row>

          {/* Table */}
          <div className="table-responsive" style={{ maxHeight: "500px", overflowY: "auto" }}>
            <Table striped bordered hover responsive className="mb-0">
              <thead className="table-dark sticky-top">
                <tr>
                  <th style={{ width: "36px" }}>
                    <Form.Check
                      type="checkbox"
                      checked={isPageAllSelected}
                      onChange={toggleSelectAllPage}
                      aria-label="Pilih semua di halaman ini"
                    />
                  </th>
                  <th>Code</th>
                  <th>Produk</th>
                  <th>Tanggal Produksi</th>
                  <th>Verifikasi</th>
                  <th>Status Penggunaan</th>
                  <th>Lokasi Verifikasi</th>
                  <th>Status</th>
                  <th style={{ width: "150px" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading && serials.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : serials.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-4 text-muted">
                      {search ? "Tidak ada serial yang sesuai dengan pencarian" : "Belum ada serial yang dibuat"}
                    </td>
                  </tr>
                ) : (
                  serials.map((s) => (
                    <tr key={s._id}>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={selectedIds.has(s._id)}
                          onChange={() => toggleSelect(s._id)}
                        />
                      </td>
                      <td>
                        <code className="bg-light px-2 py-1 rounded">{s.code}</code>
                      </td>
                      <td>{s.product?.name || "-"}</td>
                      <td>{s.product?.productionDate || "-"}</td>
                      <td>
                        <Badge bg="info">{s.verificationCount || 0}x</Badge>
                      </td>
                      <td>
                        {s.isVerified ? (
                          <Badge bg="warning" className="d-flex align-items-center" style={{ width: "fit-content" }}>
                            <FaLock className="me-1" />
                            Sudah Digunakan
                          </Badge>
                        ) : (
                          <Badge bg="secondary" className="d-flex align-items-center" style={{ width: "fit-content" }}>
                            <FaLockOpen className="me-1" />
                            Belum Digunakan
                          </Badge>
                        )}
                      </td>
                      <td>
                        {s.verificationLocation?.fullLocation ? (
                          <div className="d-flex align-items-center">
                            <FaMapMarkerAlt className="me-2 text-danger" />
                            <span className="text-muted small">
                              {s.verificationLocation.fullLocation}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        {s.isActive ? (
                          <Badge bg="success" className="d-flex align-items-center" style={{ width: "fit-content" }}>
                            <FaCheckCircle className="me-1" />
                            Aktif
                          </Badge>
                        ) : (
                          <Badge bg="danger" className="d-flex align-items-center" style={{ width: "fit-content" }}>
                            <FaTimesCircle className="me-1" />
                            Nonaktif
                          </Badge>
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>{s.isActive ? "Nonaktifkan" : "Aktifkan"}</Tooltip>}
                          >
                            <Button
                              variant={s.isActive ? "outline-warning" : "outline-success"}
                              size="sm"
                              onClick={() => onToggleActive(s._id, s.isActive)}
                            >
                              {s.isActive ? <FaTimesCircle /> : <FaCheckCircle />}
                            </Button>
                          </OverlayTrigger>
                          <OverlayTrigger placement="top" overlay={<Tooltip>Edit Tanggal Produksi</Tooltip>}>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => {
                                setEditingSerial(s)
                                setEditDate(s.product?.productionDate || "")
                                setShowEditDateModal(true)
                              }}
                            >
                              <FaEdit />
                            </Button>
                          </OverlayTrigger>
                          <OverlayTrigger placement="top" overlay={<Tooltip>Hapus Serial</Tooltip>}>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => {
                                setSerialToDelete(s)
                                setShowDeleteModal(true)
                              }}
                              disabled={deletingId === s._id}
                            >
                              <FaTrash />
                            </Button>
                          </OverlayTrigger>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className="mt-3 d-flex justify-content-between align-items-center">
            <div className="text-muted">
              Menampilkan {serials.length.toLocaleString("id-ID")} dari {total.toLocaleString("id-ID")} Serial
              {selectedIds.size > 0 && (
                <span className="ms-3">
                  Dipilih: <strong>{selectedIds.size.toLocaleString("id-ID")}</strong>
                </span>
              )}
            </div>
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

      {/* Delete Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" /> Konfirmasi Hapus
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menghapus serial <strong className="text-danger">{serialToDelete?.code}</strong>?
          </p>
          {serialToDelete?.isVerified && (
            <Alert variant="warning" className="mb-2">
              <FaExclamationTriangle className="me-2" />
              Serial ini sudah pernah diverifikasi!
            </Alert>
          )}
          <Alert variant="warning" className="mb-0">
            <FaExclamationTriangle className="me-2" />
            Tindakan ini tidak dapat dibatalkan.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleDeleteSerial} disabled={deletingId}>
            {deletingId ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Menghapus...
              </>
            ) : (
              <>
                <FaTrash className="me-2" />
                Hapus
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal show={showBulkDeleteModal} onHide={() => setShowBulkDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" /> Hapus Serial Terpilih
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Anda akan menghapus <strong className="text-danger">{selectedIds.size}</strong> serial terpilih.
          </p>
          <Alert variant="warning" className="mb-0">
            <FaExclamationTriangle className="me-2" />
            Tindakan ini tidak dapat dibatalkan.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkDeleteModal(false)} disabled={bulkDeleting}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleBulkDelete} disabled={bulkDeleting || selectedIds.size === 0}>
            {bulkDeleting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Menghapus...
              </>
            ) : (
              <>
                <FaTrash className="me-2" />
                Hapus Terpilih
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

{/* Edit Date Modal */}
      <Modal show={showEditDateModal} onHide={() => setShowEditDateModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaCalendarAlt className="me-2" /> Edit Tanggal Serial
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3">
            Serial: <code className="bg-light px-2 py-1 rounded">{editingSerial?.code}</code>
          </p>
          <Form.Group className="mb-3">
            <Form.Label>Tanggal Produksi (Production Date)</Form.Label>
            <Form.Control
              type="date"
              value={editDate || ""}
              onChange={(e) => setEditDate(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
            <Form.Text muted>Tanggal pembuatan produk</Form.Text>
          </Form.Group>
          <Alert variant="info" className="mb-0">
            <FaCalendarAlt className="me-2" />
            <strong>Issued Date (Tanggal Penerbitan Sertifikat)</strong> akan otomatis mengikuti tanggal produksi yang Anda masukkan.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditDateModal(false)}>
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!editingSerial?._id) return
              try {
                const payload = {}
                
                if (editDate) {
                  payload.product = { productionDate: editDate }
                  payload.issuedDate = editDate // Sync issuedDate with productionDate
                } else {
                  // If empty, set both to empty/null
                  payload.product = { productionDate: "" }
                  payload.issuedDate = new Date().toISOString() // Reset to current date
                }
                
                const res = await fetch(`/api/admin/serials/${editingSerial._id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data?.message || data?.error || "Gagal menyimpan tanggal")
                addToast("Tanggal serial berhasil diperbarui (production date + issued date)", "success")
                setShowEditDateModal(false)
                setEditingSerial(null)
                setEditDate("")
                fetchData()
              } catch (e) {
                addToast(e.message || "Gagal menyimpan tanggal", "error")
              }
            }}
          >
            Simpan
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}