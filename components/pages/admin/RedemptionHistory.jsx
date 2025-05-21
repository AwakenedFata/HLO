"use client"

import { useState, useEffect } from "react"
import { Card, Table, Form, Button, Row, Col, Spinner, Pagination } from "react-bootstrap"
import { FaSearch, FaFileDownload } from "react-icons/fa"
import "@/styles/adminstyles.css"
import useApiWithCache from "@/hooks/use-api-with-cache"
import useAuth from "@/hooks/use-auth"
import { CACHE_KEYS, CACHE_EXPIRATION, EVENT_TYPES } from "@/lib/utils/cache-utils"

function RedemptionHistory() {
  const [searchTerm, setSearchTerm] = useState("")
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  })
  const [filteredRedemptions, setFilteredRedemptions] = useState([])
  const [isClient, setIsClient] = useState(false)

  // Use auth hook
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  // Use API with cache hook for redemption history
  const {
    data: apiData,
    loading,
    error,
    isRefreshing,
    mutate,
    page,
    totalPages,
    totalItems,
    changePage,
  } = useApiWithCache(
    "/api/admin/redemptions",
    CACHE_KEYS.REDEMPTION_HISTORY,
    CACHE_KEYS.REDEMPTION_HISTORY_LAST_FETCH,
    CACHE_EXPIRATION.REDEMPTION_HISTORY,
    [], // dependencies
    [EVENT_TYPES.PIN_PROCESSED], // invalidate on these events
    {
      initialData: { redemptions: [], total: 0, totalPages: 1 },
      withPagination: true,
      pageSize: 50,
      transformResponse: (data) => data,
    },
  )

  // Extract redemptions from API data
  const redemptions = apiData?.redemptions || []

  // Set client-side state
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Apply filters when search term or date range changes
  useEffect(() => {
    if (redemptions.length > 0) {
      const filtered = filterRedemptions()
      setFilteredRedemptions(filtered)
    }
  }, [searchTerm, dateRange, redemptions])

  const handleSearch = (e) => {
    e.preventDefault()
    // Filter is applied in the useEffect
  }

  const handleExportCSV = () => {
    if (!isClient) return

    // Buat CSV string
    const csvContent = [
      ["PIN Code", "Nama", "ID Game", "Waktu Redeem"],
      ...filteredRedemptions.map((redemption) => [
        redemption.code,
        redemption.redeemedBy.nama,
        redemption.redeemedBy.idGame,
        new Date(redemption.redeemedBy.redeemedAt).toLocaleString(),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    // Buat file dan download
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `redemption-history-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filterRedemptions = () => {
    if (!isClient || !redemptions) return []

    return redemptions
      .filter((redemption) => redemption.redeemedBy) // Hanya yang sudah di-redeem
      .filter((redemption) => {
        // Filter berdasarkan search term
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase()
          return (
            redemption.code.toLowerCase().includes(searchLower) ||
            redemption.redeemedBy.nama.toLowerCase().includes(searchLower) ||
            redemption.redeemedBy.idGame.toLowerCase().includes(searchLower)
          )
        }
        return true
      })
      .filter((redemption) => {
        // Filter berdasarkan date range
        if (dateRange.startDate && dateRange.endDate) {
          const redemptionDate = new Date(redemption.redeemedBy.redeemedAt)
          const startDate = new Date(dateRange.startDate)
          const endDate = new Date(dateRange.endDate)
          endDate.setHours(23, 59, 59, 999) // Set end date to end of day
          return redemptionDate >= startDate && redemptionDate <= endDate
        }
        return true
      })
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
      <div className="adminpanelredemptionpage">
        <h1 className="mb-4">Riwayat Redemption</h1>
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
      <div className="adminpanelredemptionpage">
        <h1 className="mb-4">Riwayat Redemption</h1>
        <div className="text-center my-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-2">Loading redemption history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="adminpanelredemptionpage">
      <h1 className="mb-4">Riwayat Redemption</h1>

      {error && <div className="alert alert-danger">{error}</div>}

      <Card className="mb-4">
        <Card.Body>
          <Form onSubmit={handleSearch}>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Cari</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="PIN, Nama, atau ID Game"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Tanggal Mulai</Form.Label>
                  <Form.Control
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Tanggal Akhir</Form.Label>
                  <Form.Control
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={2} className="d-flex align-items-end">
                <div className="d-flex flex-column w-100">
                  <Button type="submit" variant="primary" className="mb-2 w-100">
                    <FaSearch className="me-1" /> Filter
                  </Button>
                  <Button variant="success" className="w-100" onClick={handleExportCSV}>
                    <FaFileDownload className="me-1" /> Export
                  </Button>
                </div>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <div style={{ maxHeight: "600px", overflowY: "auto" }}>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>PIN Code</th>
                  <th>Nama</th>
                  <th>ID Game</th>
                  <th>Waktu Redeem</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="text-center">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : filteredRedemptions.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center">
                      {redemptions.length === 0
                        ? "Belum ada data redemption"
                        : "Tidak ada data yang sesuai dengan filter"}
                    </td>
                  </tr>
                ) : (
                  filteredRedemptions.map((redemption) => (
                    <tr key={redemption._id}>
                      <td>
                        <code>{redemption.code}</code>
                      </td>
                      <td>{redemption.redeemedBy.nama}</td>
                      <td>{redemption.redeemedBy.idGame}</td>
                      <td>{new Date(redemption.redeemedBy.redeemedAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          {/* Pagination controls */}
          {renderPagination()}
        </Card.Body>
      </Card>
    </div>
  )
}

export default RedemptionHistory
