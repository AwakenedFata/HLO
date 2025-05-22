"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Card,
  Table,
  Form,
  Button,
  Row,
  Col,
  Alert,
  Spinner,
  Pagination,
  Badge,
  InputGroup,
  Dropdown,
  DropdownButton,
} from "react-bootstrap"
import axios from "axios"
import { FaSearch, FaFileDownload, FaSync, FaFilter, FaCalendarAlt, FaExclamationTriangle } from "react-icons/fa"
import { useRouter } from "next/navigation"
import "@/styles/adminstyles.css"
import { CACHE_KEYS, getCacheItem, setCacheItem, isCacheStale } from "@/lib/utils/cache-utils"

// Custom hook for managing redemption history
function useRedemptionHistory() {
  // State for redemptions data
  const [redemptions, setRedemptions] = useState([])
  const [filteredRedemptions, setFilteredRedemptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [totalItems, setTotalItems] = useState(0)

  // Sorting state
  const [sortField, setSortField] = useState("redeemedAt")
  const [sortDirection, setSortDirection] = useState("desc")

  // Router
  const router = useRouter()

  // Refs
  const isMounted = useRef(true)
  const searchDebounceTimeout = useRef(null)
  const abortControllerRef = useRef(null)

  // Constants
  const CACHE_EXPIRATION = 5 * 60 * 1000 // 5 minutes

  // Check authentication and get token
  const checkAuthAndGetToken = useCallback(() => {
    const token = typeof window !== "undefined" ? sessionStorage.getItem("adminToken") : null
    if (!token) {
      return null
    }
    return token
  }, [])

  // Function to fetch redemptions with pagination and server-side filtering
  const fetchRedemptions = useCallback(
    async (page = currentPage, limit = itemsPerPage, force = false) => {
      if (typeof window === "undefined") return

      const token = checkAuthAndGetToken()
      if (!token) {
        router.push("/admin/login")
        return
      }

      // Check cache first if not forcing refresh
      if (!force) {
        const cacheKey = `${CACHE_KEYS.REDEMPTION_HISTORY}_page_${page}_limit_${limit}_sort_${sortField}_${sortDirection}`
        const cachedData = getCacheItem(cacheKey)
        const lastFetch = getCacheItem(`${cacheKey}_last_fetch`)

        if (cachedData && lastFetch && !isCacheStale(`${cacheKey}_last_fetch`, CACHE_EXPIRATION)) {
          setRedemptions(cachedData.redemptions || [])
          setFilteredRedemptions(cachedData.redemptions || [])
          setTotalPages(cachedData.totalPages || 1)
          setTotalItems(cachedData.total || 0)
          setLoading(false)
          setInitialLoadDone(true)
          return
        }
      }

      setLoading(true)
      setError("")
      setIsRefreshing(force)

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create a new AbortController
      abortControllerRef.current = new AbortController()

      try {
        // Build query parameters
        let queryParams = `?page=${page}&limit=${limit}&sort=${sortField}&direction=${sortDirection}`

        if (searchTerm) {
          queryParams += `&search=${encodeURIComponent(searchTerm)}`
        }

        if (dateRange.startDate) {
          queryParams += `&startDate=${encodeURIComponent(dateRange.startDate)}`
        }

        if (dateRange.endDate) {
          queryParams += `&endDate=${encodeURIComponent(dateRange.endDate)}`
        }

        const response = await axios.get(`/api/admin/redemptions${queryParams}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: abortControllerRef.current.signal,
        })

        // Only update state if component is still mounted
        if (!isMounted.current) return

        const now = Date.now()
        setRedemptions(response.data.redemptions || [])
        setFilteredRedemptions(response.data.redemptions || [])
        setTotalPages(response.data.totalPages || 1)
        setTotalItems(response.data.total || 0)
        setLastFetchTime(now)
        setLoading(false)
        setIsRefreshing(false)
        setInitialLoadDone(true)

        // Cache the results
        const cacheKey = `${CACHE_KEYS.REDEMPTION_HISTORY}_page_${page}_limit_${limit}_sort_${sortField}_${sortDirection}`
        setCacheItem(cacheKey, {
          redemptions: response.data.redemptions || [],
          totalPages: response.data.totalPages || 1,
          total: response.data.total || 0,
        })
        setCacheItem(`${cacheKey}_last_fetch`, now)
      } catch (error) {
        console.error("Error fetching redemptions:", error)

        if (!isMounted.current) return

        // Don't set error state for intentionally canceled requests
        if (error.name === "CanceledError" || error.name === "AbortError") {
          console.log("Request was canceled", error.message)
          // Just set loading to false without showing an error message
          setLoading(false)
          setIsRefreshing(false)
          return
        }

        if (error.response?.status === 401) {
          sessionStorage.removeItem("adminToken")
          router.push("/admin/login")
        } else if (error.response?.status === 429) {
          setError("Terlalu banyak permintaan ke server. Coba lagi dalam beberapa menit.")
        } else {
          setError("Gagal mengambil data riwayat redemption: " + (error.response?.data?.error || "Terjadi kesalahan"))
        }

        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [checkAuthAndGetToken, currentPage, dateRange, itemsPerPage, router, searchTerm, sortDirection, sortField],
  )

  // Function to handle search with debounce
  const handleSearch = useCallback(
    (e) => {
      e.preventDefault()

      if (searchDebounceTimeout.current) {
        clearTimeout(searchDebounceTimeout.current)
      }

      searchDebounceTimeout.current = setTimeout(() => {
        setCurrentPage(1) // Reset to first page when searching
        fetchRedemptions(1, itemsPerPage, true)
      }, 500)
    },
    [fetchRedemptions, itemsPerPage],
  )

  // Function to handle date range change
  const handleDateRangeChange = useCallback(
    (field, value) => {
      setDateRange((prev) => ({ ...prev, [field]: value }))

      if (searchDebounceTimeout.current) {
        clearTimeout(searchDebounceTimeout.current)
      }

      searchDebounceTimeout.current = setTimeout(() => {
        setCurrentPage(1) // Reset to first page when changing date range
        fetchRedemptions(1, itemsPerPage, true)
      }, 500)
    },
    [fetchRedemptions, itemsPerPage],
  )

  // Function to handle refresh
  const handleRefresh = useCallback(() => {
    fetchRedemptions(currentPage, itemsPerPage, true)
  }, [currentPage, fetchRedemptions, itemsPerPage])

  // Function to handle page change
  const handlePageChange = useCallback(
    (page) => {
      setCurrentPage(page)
      fetchRedemptions(page, itemsPerPage)
    },
    [fetchRedemptions, itemsPerPage],
  )

  // Function to handle items per page change
  const handleItemsPerPageChange = useCallback(
    (e) => {
      const newItemsPerPage = Number.parseInt(e.target.value, 10)
      setItemsPerPage(newItemsPerPage)
      setCurrentPage(1) // Reset to first page
      fetchRedemptions(1, newItemsPerPage, true)
    },
    [fetchRedemptions],
  )

  // Function to handle sort change
  const handleSortChange = useCallback(
    (field) => {
      // If clicking the same field, toggle direction
      if (field === sortField) {
        const newDirection = sortDirection === "asc" ? "desc" : "asc"
        setSortDirection(newDirection)
        fetchRedemptions(currentPage, itemsPerPage, true)
      } else {
        // If clicking a new field, set it as the sort field with default desc direction
        setSortField(field)
        setSortDirection("desc")
        fetchRedemptions(currentPage, itemsPerPage, true)
      }
    },
    [currentPage, fetchRedemptions, itemsPerPage, sortDirection, sortField],
  )

  // Function to export data to CSV
  const handleExportCSV = useCallback(() => {
    if (typeof window === "undefined" || redemptions.length === 0) return

    // Prepare data for export
    const csvContent = [
      ["PIN Code", "Nama", "ID Game", "Waktu Redeem", "Status"],
      ...redemptions.map((redemption) => [
        redemption.code,
        redemption.redeemedBy?.nama || "",
        redemption.redeemedBy?.idGame || "",
        redemption.redeemedBy?.redeemedAt ? new Date(redemption.redeemedBy.redeemedAt).toLocaleString() : "",
        redemption.processed ? "Diproses" : "Pending",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    // Create file and download
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `redemption-history-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [redemptions])

  // Function to clear filters
  const clearFilters = useCallback(() => {
    // Cancel any existing request first
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    setSearchTerm("")
    setDateRange({ startDate: "", endDate: "" })
    setCurrentPage(1)
    setSortField("redeemedAt")
    setSortDirection("desc")

    // Small delay to ensure state updates before fetching
    setTimeout(() => {
      if (isMounted.current) {
        fetchRedemptions(1, itemsPerPage, true)
      }
    }, 0)
  }, [fetchRedemptions, itemsPerPage])

  return {
    // State
    redemptions,
    filteredRedemptions,
    loading,
    error,
    searchTerm,
    dateRange,
    isRefreshing,
    lastFetchTime,
    currentPage,
    totalPages,
    itemsPerPage,
    totalItems,
    sortField,
    sortDirection,
    initialLoadDone,

    // Setters
    setSearchTerm,
    setError,

    // Actions
    fetchRedemptions,
    handleSearch,
    handleDateRangeChange,
    handleRefresh,
    handlePageChange,
    handleItemsPerPageChange,
    handleSortChange,
    handleExportCSV,
    clearFilters,

    // Refs
    isMounted,
    abortControllerRef,
  }
}

function RedemptionHistory() {
  const [isClient, setIsClient] = useState(false)
  const router = useRouter()

  // Use custom hook for redemption history
  const redemptionHistory = useRedemptionHistory()

  // Destructure state and methods from the hook
  const {
    redemptions,
    filteredRedemptions,
    loading,
    error,
    searchTerm,
    dateRange,
    isRefreshing,
    currentPage,
    totalPages,
    itemsPerPage,
    totalItems,
    sortField,
    sortDirection,
    initialLoadDone,

    setSearchTerm,
    setError,

    fetchRedemptions,
    handleSearch,
    handleDateRangeChange,
    handleRefresh,
    handlePageChange,
    handleItemsPerPageChange,
    handleSortChange,
    handleExportCSV,
    clearFilters,

    isMounted,
    abortControllerRef,
  } = redemptionHistory

  // Tandai bahwa kita sudah di client-side
  useEffect(() => {
    setIsClient(true)

    // Add event listener for cache invalidation
    const handleCacheInvalidated = (event) => {
      if (isMounted.current && event.detail?.keys?.includes("redemption-history")) {
        fetchRedemptions(currentPage, itemsPerPage, true)
      }
    }

    window.addEventListener("cache-invalidated", handleCacheInvalidated)

    return () => {
      isMounted.current = false
      window.removeEventListener("cache-invalidated", handleCacheInvalidated)

      // Only abort if there's an active controller and we're unmounting
      if (abortControllerRef.current) {
        console.log("Aborting request on cleanup")
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [currentPage, fetchRedemptions, itemsPerPage, abortControllerRef])

  // Fetch redemptions on component mount
  useEffect(() => {
    if (!isClient) return

    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      router.push("/admin/login")
    } else {
      fetchRedemptions()
    }
  }, [fetchRedemptions, isClient, router])

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
      <Pagination.Prev key="prev" disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)}>
        <span className="sr-only">Previous</span>
      </Pagination.Prev>,
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
      >
        <span className="sr-only">Next</span>
      </Pagination.Next>,
    )

    return (
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="d-flex align-items-center">
          <span className="me-2">Items per page:</span>
          <Form.Select
            size="sm"
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
            style={{ width: "80px" }}
            aria-label="Items per page"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Form.Select>
          <span className="ms-3">
            Showing {filteredRedemptions.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{" "}
            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
          </span>
        </div>
        <Pagination size="sm" className="mb-0" aria-label="Pagination">
          {items}
        </Pagination>
      </div>
    )
  }

  // Render sort indicator
  const renderSortIndicator = (field) => {
    if (sortField !== field) return null
    return sortDirection === "asc" ? " ▲" : " ▼"
  }

  // If not client-side, show loading
  if (!isClient) {
    return (
      <div className="adminpanelredemptionpage">
        <h1 className="mb-4">Riwayat Redemption</h1>
        <div className="text-center my-5" aria-live="polite" aria-busy="true">
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

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Body>
          <Form onSubmit={handleSearch}>
            <Row>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label htmlFor="searchInput">Cari</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>
                      <FaSearch />
                    </InputGroup.Text>
                    <Form.Control
                      id="searchInput"
                      type="text"
                      placeholder="PIN, Nama, atau ID Game"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      aria-label="Search term"
                    />
                    {searchTerm && (
                      <Button variant="outline-secondary" onClick={() => setSearchTerm("")} aria-label="Clear search">
                        &times;
                      </Button>
                    )}
                  </InputGroup>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label htmlFor="startDate">
                    <FaCalendarAlt className="me-1" /> Tanggal Mulai
                  </Form.Label>
                  <Form.Control
                    id="startDate"
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => handleDateRangeChange("startDate", e.target.value)}
                    aria-label="Start date"
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label htmlFor="endDate">
                    <FaCalendarAlt className="me-1" /> Tanggal Akhir
                  </Form.Label>
                  <Form.Control
                    id="endDate"
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => handleDateRangeChange("endDate", e.target.value)}
                    aria-label="End date"
                  />
                </Form.Group>
              </Col>
              <Col md={3} className="d-flex align-items-end">
                <div className="d-flex flex-column w-100">
                  <Button
                    type="submit"
                    variant="primary"
                    className="mb-2 w-100"
                    disabled={loading}
                    aria-label="Filter results"
                  >
                    <FaFilter className="me-1" /> Filter
                  </Button>
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-secondary"
                      className="flex-grow-1"
                      onClick={clearFilters}
                      disabled={loading}
                      aria-label="Clear filters"
                    >
                      Clear
                    </Button>
                    <DropdownButton
                      variant="outline-primary"
                      title={
                        <>
                          <FaSync className={isRefreshing ? "fa-spin me-1" : "me-1"} /> Actions
                        </>
                      }
                      disabled={loading}
                      id="action-dropdown"
                    >
                      <Dropdown.Item onClick={handleRefresh} disabled={loading || isRefreshing}>
                        <FaSync className={`me-1 ${isRefreshing ? "fa-spin" : ""}`} /> Refresh
                      </Dropdown.Item>
                      <Dropdown.Item onClick={handleExportCSV} disabled={loading || redemptions.length === 0}>
                        <FaFileDownload className="me-1" /> Export CSV
                      </Dropdown.Item>
                    </DropdownButton>
                  </div>
                </div>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Daftar Redemption</span>
          <div>
            {initialLoadDone && (
              <Badge bg="info" className="me-2">
                Total: {totalItems}
              </Badge>
            )}
            <Button
              variant="outline-success"
              size="sm"
              onClick={handleExportCSV}
              disabled={loading || redemptions.length === 0}
              aria-label="Export to CSV"
            >
              <FaFileDownload className="me-1" /> Export CSV
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="table-responsive" style={{ maxHeight: "600px", overflowY: "auto" }}>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th
                    className="sortable-header"
                    onClick={() => handleSortChange("code")}
                    style={{ cursor: "pointer" }}
                  >
                    PIN Code{renderSortIndicator("code")}
                  </th>
                  <th
                    className="sortable-header"
                    onClick={() => handleSortChange("nama")}
                    style={{ cursor: "pointer" }}
                  >
                    Nama{renderSortIndicator("nama")}
                  </th>
                  <th
                    className="sortable-header"
                    onClick={() => handleSortChange("idGame")}
                    style={{ cursor: "pointer" }}
                  >
                    ID Game{renderSortIndicator("idGame")}
                  </th>
                  <th
                    className="sortable-header"
                    onClick={() => handleSortChange("redeemedAt")}
                    style={{ cursor: "pointer" }}
                  >
                    Waktu Redeem{renderSortIndicator("redeemedAt")}
                  </th>
                  <th
                    className="sortable-header"
                    onClick={() => handleSortChange("processed")}
                    style={{ cursor: "pointer" }}
                  >
                    Status{renderSortIndicator("processed")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4">
                      <Spinner animation="border" role="status" className="me-2" />
                      <span>Loading...</span>
                    </td>
                  </tr>
                ) : filteredRedemptions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4">
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
                      <td>{redemption.redeemedBy?.nama || "-"}</td>
                      <td>{redemption.redeemedBy?.idGame || "-"}</td>
                      <td>
                        {redemption.redeemedBy?.redeemedAt
                          ? new Date(redemption.redeemedBy.redeemedAt).toLocaleString()
                          : "-"}
                      </td>
                      <td>
                        {redemption.processed ? (
                          <Badge bg="success">Diproses</Badge>
                        ) : (
                          <Badge bg="warning">Pending</Badge>
                        )}
                      </td>
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
