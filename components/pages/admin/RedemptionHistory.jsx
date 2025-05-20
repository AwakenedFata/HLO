"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, Table, Form, Button, Row, Col } from "react-bootstrap"
import axios from "axios"
import { FaSearch, FaFileDownload } from "react-icons/fa"
import { useRouter } from "next/navigation"
import "@/styles/adminstyles.css"

function RedemptionHistory() {
  const [redemptions, setRedemptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  })
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

  // Tandai bahwa kita sudah di client-side
  useEffect(() => {
    setIsClient(true)
  }, [])

  const fetchRedemptions = useCallback(async () => {
    if (!isClient) return

    setLoading(true)
    setError("")
    try {
      const token = sessionStorage.getItem("adminToken")

      if (!token) {
        router.push("/admin/login")
        return
      }

      const response = await axios.get(`/api/admin/redemptions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setRedemptions(response.data.redemptions)
    } catch (error) {
      console.error("Error fetching redemptions:", error)
      if (error.response?.status === 401) {
        sessionStorage.removeItem("adminToken")
        router.push("/admin/login")
      }
      setError("Gagal mengambil data riwayat redemption")
    } finally {
      setLoading(false)
    }
  }, [router, isClient]) // Tambahkan isClient sebagai dependensi

  useEffect(() => {
    if (!isClient) return

    fetchRedemptions()
  }, [fetchRedemptions, isClient])

  const handleSearch = (e) => {
    if (!isClient) return
    e.preventDefault()
    // Filter akan diterapkan di frontend
    // Dalam implementasi sebenarnya, lebih baik melakukan filter di backend
  }

  const handleExportCSV = () => {
    if (!isClient) return

    // Filter redemptions berdasarkan pencarian dan tanggal
    const filteredRedemptions = filterRedemptions()

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
    if (!isClient) return []

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

  // Hanya filter redemptions jika sudah di client-side
  const filteredRedemptions = isClient ? filterRedemptions() : []

  // Jika belum client-side, tampilkan placeholder atau loading
  if (!isClient) {
    return (
      <div className="adminpanelredemptionpage">
        <h1 className="mb-4">Riwayat Redemption</h1>
        <div className="text-center my-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
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
        </Card.Body>
      </Card>
    </div>
  )
}

export default RedemptionHistory
