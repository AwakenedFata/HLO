"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
  Modal,
  Spinner,
  InputGroup,
  DropdownButton,
  Dropdown,
  Pagination,
  OverlayTrigger,
  Tooltip,
  Toast,
  ToastContainer,
  Tabs,
  Tab,
} from "react-bootstrap"
import { useRouter } from "next/navigation"
import axios from "axios"
import {
  FaTrash,
  FaSearch,
  FaExclamationTriangle,
  FaWifi,
  FaEye,
  FaCheck,
  FaSync,
  FaEnvelope,
  FaArchive,
  FaFilter,
} from "react-icons/fa"

// Axios instance
const api = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.request.use((config) => {
  if (config.method === "post" || config.method === "delete" || config.method === "patch") {
    config.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
  }
  return config
})

function UsersMails() {
  const router = useRouter()
  const { status } = useSession()
  const isMountedRef = useRef(false)
  const searchTimeoutRef = useRef(null)

  // Basic state
  const [isClient, setIsClient] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [mails, setMails] = useState([])
  const [filteredMails, setFilteredMails] = useState([])
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [error, setError] = useState("")

  // Toast notifications
  const [toasts, setToasts] = useState([])

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    read: 0,
    archived: 0,
  })

  // Filtering and search
  const [filterStatus, setFilterStatus] = useState("unread")
  const [searchTerm, setSearchTerm] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [totalItems, setTotalItems] = useState(0)

  // Selection and modals
  const [selectedMails, setSelectedMails] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [mailToDelete, setMailToDelete] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedMailDetail, setSelectedMailDetail] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [marking, setMarking] = useState(false)

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState("connected")

  // Hydration fix
  useEffect(() => {
    setIsClient(true)
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Check authentication
  useEffect(() => {
    if (status === "unauthenticated") {
      setAuthError(true)
      router.push("/login")
    }
  }, [status, router])

  // Fetch mails
  const fetchMails = useCallback(
    async (page = 1, options = {}) => {
      if (!isMountedRef.current || status !== "authenticated") return

      setLoading(true)
      setError("")

      try {
        const params = {
          page,
          limit: itemsPerPage,
          search: searchTerm,
          status: filterStatus,
          _t: Date.now(),
        }

        const response = await api.get("/api/admin/user-mails", { params })

        if (isMountedRef.current) {
          setMails(response.data.mails)
          setFilteredMails(response.data.mails)
          setTotalItems(response.data.total)
          setTotalPages(response.data.totalPages)
          setStats(response.data.stats)
          setCurrentPage(page)
          setDataLoaded(true)
          setConnectionStatus("connected")
        }
      } catch (err) {
        if (isMountedRef.current) {
          const errorMessage = err.response?.data?.error || "Gagal memuat data mails"
          setError(errorMessage)
          setConnectionStatus("disconnected")

          if (err.response?.status === 401) {
            setAuthError(true)
            router.push("/login")
          }
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
          setSearchLoading(false)
        }
      }
    },
    [status, itemsPerPage, searchTerm, filterStatus, router],
  )

  // Initial fetch
  useEffect(() => {
    if (status === "authenticated" && isClient) {
      fetchMails(1)
    }
  }, [status, isClient, fetchMails])

  const handleSearch = useCallback((value) => {
    setSearchTerm(value)
    setSearchLoading(true)
    setCurrentPage(1)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setSearchLoading(false)
      }
    }, 500)
  }, [])

  // Handle filter change
  const handleFilterChange = (newStatus) => {
    setFilterStatus(newStatus)
    setCurrentPage(1)
  }

  // Handle mark as read
  const handleMarkAsRead = async (mailId) => {
    if (!isMountedRef.current) return

    setMarking(true)
    try {
      await api.patch(`/api/admin/user-mails/${mailId}`, { read: true })

      if (isMountedRef.current) {
        setMails((prev) => prev.map((m) => (m._id === mailId ? { ...m, read: true } : m)))
        setFilteredMails((prev) => prev.map((m) => (m._id === mailId ? { ...m, read: true } : m)))
        addToast("Mail ditandai sebagai sudah dibaca", "success")
        fetchMails(currentPage)
      }
    } catch (err) {
      if (isMountedRef.current) {
        addToast("Gagal mengubah status mail", "error")
      }
    } finally {
      if (isMountedRef.current) {
        setMarking(false)
      }
    }
  }

  // Handle archive
  const handleArchiveMail = async (mailId, isArchived) => {
    if (!isMountedRef.current) return

    setMarking(true)
    try {
      await api.patch(`/api/admin/user-mails/${mailId}`, { archived: !isArchived })

      if (isMountedRef.current) {
        setMails((prev) =>
          prev.map((m) => (m._id === mailId ? { ...m, archived: !isArchived } : m))
        )
        setFilteredMails((prev) =>
          prev.map((m) => (m._id === mailId ? { ...m, archived: !isArchived } : m))
        )
        addToast(
          `Mail berhasil ${!isArchived ? "diarsipkan" : "dikembalikan dari arsip"}`,
          "success"
        )
        // Refresh stats
        fetchMails(currentPage)
      }
    } catch (err) {
      if (isMountedRef.current) {
        addToast("Gagal mengubah status arsip", "error")
      }
    } finally {
      if (isMountedRef.current) {
        setMarking(false)
      }
    }
  }

  // Handle delete
  const handleDeleteMail = async () => {
    if (!mailToDelete || !isMountedRef.current) return

    setDeleting(true)
    try {
      await api.delete(`/api/admin/user-mails/${mailToDelete._id}`)

      if (isMountedRef.current) {
        addToast("Mail berhasil dihapus", "success")
        setShowDeleteModal(false)
        setMailToDelete(null)
        fetchMails(currentPage)
      }
    } catch (err) {
      if (isMountedRef.current) {
        addToast("Gagal menghapus mail", "error")
      }
    } finally {
      if (isMountedRef.current) {
        setDeleting(false)
      }
    }
  }

  // Handle Select All
  const handleSelectAll = (e) => {
    setSelectAll(e.target.checked)
    if (e.target.checked) {
      setSelectedMails(filteredMails.map((mail) => mail._id))
    } else {
      setSelectedMails([])
    }
  }

  // Handle Select Individual
  const handleSelectMail = (mailId) => {
    setSelectedMails((prev) => {
      if (prev.includes(mailId)) {
        return prev.filter((id) => id !== mailId)
      } else {
        return [...prev, mailId]
      }
    })
  }

  // Sync Select All Checkbox
  useEffect(() => {
    if (filteredMails.length > 0 && selectedMails.length === filteredMails.length) {
      setSelectAll(true)
    } else {
      setSelectAll(false)
    }
  }, [selectedMails, filteredMails])

  // Handle Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedMails.length === 0 || !isMountedRef.current) return

    setDeleting(true)
    try {
      const promises = selectedMails.map((id) => api.delete(`/api/admin/user-mails/${id}`))
      await Promise.all(promises)

      if (isMountedRef.current) {
        addToast(`${selectedMails.length} mail berhasil dihapus`, "success")
        setSelectedMails([])
        setSelectAll(false)
        setShowDeleteModal(false)
        fetchMails(currentPage)
      }
    } catch (err) {
      if (isMountedRef.current) {
        addToast("Gagal menghapus beberapa mail", "error")
      }
    } finally {
      if (isMountedRef.current) {
        setDeleting(false)
      }
    }
  }

  // Toast utility
  const addToast = (message, type = "info") => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type, duration: 3000 }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }

  // Stats cards
  const statsCards = useMemo(
    () => [
      { title: "Total Mails", value: stats.total, icon: FaEnvelope, variant: "primary" },
      { title: "Belum Dibaca", value: stats.unread, icon: FaEye, variant: "warning" },
      { title: "Sudah Dibaca", value: stats.read, icon: FaCheck, variant: "success" },
      { title: "Archived", value: stats.archived, icon: FaArchive, variant: "info" },
    ],
    [stats],
  )

  const getConnectionStatusBadge = () => {
    if (connectionStatus === "connected") {
      return (
        <Badge bg="success" className="d-flex align-items-center">
          <FaWifi className="me-1" size={12} />
          Terhubung
        </Badge>
      )
    }
    return (
      <Badge bg="danger" className="d-flex align-items-center">
        <FaWifi className="me-1" size={12} />
        Terputus
      </Badge>
    )
  }

  const renderPagination = () => {
    if (totalPages <= 1) return null

    const items = []
    const startPage = Math.max(1, currentPage - 2)
    const endPage = Math.min(totalPages, currentPage + 2)

    if (startPage > 1) {
      items.push(<Pagination.First key="first" onClick={() => fetchMails(1)} disabled={loading} />)
      items.push(
        <Pagination.Prev
          key="prev"
          onClick={() => fetchMails(currentPage - 1)}
          disabled={currentPage === 1 || loading}
        />,
      )
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <Pagination.Item key={i} active={i === currentPage} onClick={() => fetchMails(i)} disabled={loading}>
          {i}
        </Pagination.Item>,
      )
    }

    if (endPage < totalPages) {
      items.push(
        <Pagination.Next
          key="next"
          onClick={() => fetchMails(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
        />,
      )
      items.push(<Pagination.Last key="last" onClick={() => fetchMails(totalPages)} disabled={loading} />)
    }

    return (
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="text-muted">
          Menampilkan {filteredMails.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} Mail
        </div>
        <Pagination size="sm" className="mb-0">
          {items}
        </Pagination>
      </div>
    )
  }

  if (!isClient) {
    return null
  }

  if (authError) {
    return (
      <div className="p-4">
        <Alert variant="danger">
          <FaExclamationTriangle className="me-2" />
          Anda tidak memiliki akses ke halaman ini
        </Alert>
      </div>
    )
  }

  return (
    <div className="adminpanelmanajemenusersmails">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Manajemen User Mails</h1>
        <div className="d-flex align-items-center gap-2">
          {getConnectionStatusBadge()}
          <Button variant="outline-primary" size="sm" onClick={() => fetchMails(currentPage)} disabled={loading}>
            <FaSync className={loading ? "fa-spin" : ""} />
          </Button>
        </div>
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

      {/* Main Mails Card */}
      <Card className="shadow-sm">
        <Card.Header>
          <Tabs
            activeKey={filterStatus}
            onSelect={(k) => handleFilterChange(k)}
            className="border-0"
            fill
          >
            <Tab
              eventKey="unread"
              title={
                <>
                  <FaEnvelope className="me-2 text-warning" />
                  Belum Dibaca
                  {stats.unread > 0 && (
                    <Badge bg="warning" className="ms-2" text="dark">
                      {stats.unread}
                    </Badge>
                  )}
                </>
              }
            />
            <Tab
              eventKey="read"
              title={
                <>
                  <FaCheck className="me-2 text-success" />
                  Sudah Dibaca
                </>
              }
            />
            <Tab
              eventKey="archived"
              title={
                <>
                  <FaArchive className="me-2 text-secondary" />
                  Arsip
                </>
              }
            />
            <Tab eventKey="all" title="Semua Mail" />
          </Tabs>
        </Card.Header>
        <Card.Body>
          <Row className="mb-3">
            <Col md={12}>
              <InputGroup>
                <InputGroup.Text>
                  <FaSearch />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Cari nama, email, atau subjek..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  disabled={loading || !dataLoaded}
                />
                {searchLoading && (
                  <InputGroup.Text>
                    <Spinner animation="border" size="sm" />
                  </InputGroup.Text>
                )}
                {searchTerm && (
                  <Button variant="outline-secondary" onClick={() => handleSearch("")}>
                    &times;
                  </Button>
                )}
              </InputGroup>
            </Col>
            {selectedMails.length > 0 && (
              <Col md={12} className="mb-2 mt-3">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setMailToDelete(null)
                    setShowDeleteModal(true)
                  }}
                >
                  <FaTrash className="me-2" />
                  Hapus {selectedMails.length} Terpilih
                </Button>
              </Col>
            )}
          </Row>

          {/* Mails Table */}
          <div className="table-responsive" style={{ maxHeight: "600px", overflowY: "auto" }}>
            <Table striped bordered hover responsive className="mb-0">
              <thead className="table-dark sticky-top">
                <tr>
                  <th style={{ width: "40px" }}>
                    <Form.Check
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      disabled={loading || filteredMails.length === 0}
                    />
                  </th>
                  <th style={{ width: "50px" }}>Status</th>
                  <th>Nama Pengirim</th>
                  <th>Email</th>
                  <th>Subjek</th>
                  <th>Tanggal</th>
                  <th style={{ width: "100px" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading && filteredMails.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : filteredMails.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      {searchTerm ? "Tidak ada mail yang sesuai dengan pencarian" : "Belum ada mail"}
                    </td>
                  </tr>
                ) : (
                  filteredMails.map((mail) => (
                    <tr key={mail._id} className={mail.read ? "table-light" : "table-active"}>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={selectedMails.includes(mail._id)}
                          onChange={() => handleSelectMail(mail._id)}
                        />
                      </td>
                      <td>
                        {!mail.read ? (
                          <Badge bg="warning">Baru</Badge>
                        ) : mail.archived ? (
                          <Badge bg="secondary">Archived</Badge>
                        ) : (
                          <Badge bg="info">Dibaca</Badge>
                        )}
                      </td>
                      <td>
                        <strong>{mail.name}</strong>
                      </td>
                      <td>{mail.email}</td>
                      <td>
                        <span className="text-truncate d-inline-block" style={{ maxWidth: "200px" }}>
                          {mail.subject}
                        </span>
                      </td>
                      <td>{new Date(mail.createdAt).toLocaleDateString("id-ID")}</td>
                      <td>
                        <div className="d-flex gap-1">
                          <OverlayTrigger placement="top" overlay={<Tooltip>Lihat Detail</Tooltip>}>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => {
                                setSelectedMailDetail(mail)
                                setShowDetailModal(true)
                              }}
                            >
                              <FaEye />
                            </Button>
                          </OverlayTrigger>
                          {!mail.read && (
                            <OverlayTrigger placement="top" overlay={<Tooltip>Tandai Dibaca</Tooltip>}>
                              <Button
                                variant="outline-success"
                                size="sm"
                                onClick={() => handleMarkAsRead(mail._id)}
                                disabled={marking}
                              >
                                <FaCheck />
                              </Button>
                            </OverlayTrigger>
                          )}
                          <OverlayTrigger
                            placement="top"
                            overlay={
                              <Tooltip>
                                {mail.archived ? "Kembalikan dari Arsip" : "Arsipkan"}
                              </Tooltip>
                            }
                          >
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handleArchiveMail(mail._id, mail.archived)}
                              disabled={marking}
                            >
                              {mail.archived ? <FaSync /> : <FaArchive />}
                            </Button>
                          </OverlayTrigger>
                          <OverlayTrigger placement="top" overlay={<Tooltip>Hapus</Tooltip>}>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => {
                                setMailToDelete(mail)
                                setShowDeleteModal(true)
                              }}
                              disabled={deleting}
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

          {/* Pagination */}
          {renderPagination()}
        </Card.Body>
      </Card>

      {/* Detail Modal */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Detail Mail</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedMailDetail && (
            <>
              <div className="mb-3">
                <strong>Nama:</strong>
                <p className="mt-1">{selectedMailDetail.name}</p>
              </div>
              <div className="mb-3">
                <strong>Email:</strong>
                <p className="mt-1">{selectedMailDetail.email}</p>
              </div>
              <div className="mb-3">
                <strong>Subjek:</strong>
                <p className="mt-1">{selectedMailDetail.subject}</p>
              </div>
              <div className="mb-3">
                <strong>Pesan:</strong>
                <div
                  className="border rounded p-3 mt-1"
                  style={{ maxHeight: "300px", overflow: "auto", backgroundColor: "#e9ecef" }}
                >
                  <p className="mb-0" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#212529" }}>
                    {selectedMailDetail.message}
                  </p>
                </div>
              </div>
              <div className="mb-3">
                <strong>Tanggal Dikirim:</strong>
                <p className="mt-1">{new Date(selectedMailDetail.createdAt).toLocaleString("id-ID")}</p>
              </div>
              <div className="mb-3">
                <strong>Status:</strong>
                <p className="mt-1">
                  {selectedMailDetail.read ? (
                    <Badge bg="info">Sudah Dibaca</Badge>
                  ) : (
                    <Badge bg="warning">Belum Dibaca</Badge>
                  )}
                </p>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Tutup
          </Button>
          {selectedMailDetail && !selectedMailDetail.read && (
            <Button
              variant="success"
              onClick={() => {
                handleMarkAsRead(selectedMailDetail._id)
                setShowDetailModal(false)
              }}
              disabled={marking}
            >
              <FaCheck className="me-2" />
              Tandai Dibaca
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Delete Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton={!deleting}>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" /> Konfirmasi Hapus
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menghapus{" "}
            {mailToDelete ? (
              <>
                mail dari <strong>{mailToDelete.name}</strong>
              </>
            ) : (
              <strong>{selectedMails.length} mail terpilih</strong>
            )}{" "}
            secara permanen dari database?
          </p>
          <Alert variant="warning" className="mb-0">
            <FaExclamationTriangle className="me-2" />
            Tindakan ini tidak dapat dibatalkan.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={mailToDelete ? handleDeleteMail : handleBulkDelete}
            disabled={deleting}
          >
            {deleting ? (
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

      {/* Toast Notifications */}
      <ToastContainer position="top-end" className="p-3">
        {toasts.map((toast) => (
          <Toast key={toast.id} bg={toast.type} show={true} onClose={() => {}} delay={toast.duration} autohide>
            <Toast.Header>
              <strong className="me-auto">Notifikasi</strong>
            </Toast.Header>
            <Toast.Body className={toast.type === "error" ? "text-white" : ""}>{toast.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </div>
  )
}

export default UsersMails
