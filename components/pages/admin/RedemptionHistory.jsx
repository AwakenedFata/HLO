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
    async (
      page = 1,
      limit = 50,
      force = false,
      currentSearchTerm = "",
      currentDateRange = {},
      currentSortField = "redeemedAt",
      currentSortDirection = "desc",
    ) => {
      if (typeof window === "undefined") return

      console.log("fetchRedemptions called with:", {
        page,
        limit,
        force,
        currentSearchTerm,
        currentDateRange,
        currentSortField,
        currentSortDirection,
      })

      const token = checkAuthAndGetToken()
      if (!token) {
        console.log("No token found, redirecting to login")
        router.push("/admin/login")
        return
      }

      // Always force fetch on first load
      if (!initialLoadDone) {
        force = true
        console.log("First load detected, forcing data fetch")
      }

      // Check cache first if not forcing refresh and not first load
      if (!force && initialLoadDone) {
        const cacheKey = `${CACHE_KEYS.REDEMPTION_HISTORY}_page_${page}_limit_${limit}_sort_${currentSortField}_${currentSortDirection}`
        const cachedData = getCacheItem(cacheKey)
        const lastFetch = getCacheItem(`${cacheKey}_last_fetch`)

        if (cachedData && lastFetch && !isCacheStale(`${cacheKey}_last_fetch`, CACHE_EXPIRATION)) {
          console.log("Using cached data")
          if (isMounted.current) {
            setRedemptions(cachedData.redemptions || [])
            setFilteredRedemptions(cachedData.redemptions || [])
            setTotalPages(cachedData.totalPages || 1)
            setTotalItems(cachedData.total || 0)
            setLoading(false)
            setIsRefreshing(false)
          }
          return
        }
      }

      console.log("Fetching fresh data from API")
      setLoading(true)
      setError("")
      if (force) setIsRefreshing(true)

      // Cancel any existing request
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort()
          console.log("Aborted previous request")
        } catch (abortError) {
          console.error("Error aborting previous request:", abortError)
        }
        abortControllerRef.current = null
      }

      // Create a new AbortController
      abortControllerRef.current = new AbortController()

      try {
        // Build query parameters
        let queryParams = `?page=${page}&limit=${limit}&sort=${currentSortField}&direction=${currentSortDirection}`

        if (currentSearchTerm) {
          queryParams += `&search=${encodeURIComponent(currentSearchTerm)}`
        }

        if (currentDateRange.startDate) {
          queryParams += `&startDate=${encodeURIComponent(currentDateRange.startDate)}`
        }

        if (currentDateRange.endDate) {
          queryParams += `&endDate=${encodeURIComponent(currentDateRange.endDate)}`
        }

        console.log("Making API request to:", `/api/admin/redemptions${queryParams}`)

        const response = await axios.get(`/api/admin/redemptions${queryParams}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: abortControllerRef.current.signal,
          timeout: 15000, // 15 second timeout
        })

        console.log("API response received:", response.data)

        // Only update state if component is still mounted
        if (!isMounted.current) {
          console.log("Component unmounted, skipping state update")
          return
        }

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
        const cacheKey = `${CACHE_KEYS.REDEMPTION_HISTORY}_page_${page}_limit_${limit}_sort_${currentSortField}_${currentSortDirection}`
        setCacheItem(cacheKey, {
          redemptions: response.data.redemptions || [],
          totalPages: response.data.totalPages || 1,
          total: response.data.total || 0,
        })
        setCacheItem(`${cacheKey}_last_fetch`, now)

        console.log("Data fetch completed successfully")
      } catch (error) {
        console.error("Error fetching redemptions:", error)

        if (!isMounted.current) return

        // Don't set error state for intentionally canceled requests
        if (error.name === "CanceledError" || error.name === "AbortError") {
          console.log("Request was canceled", error.message)
          setLoading(false)
          setIsRefreshing(false)
          return
        }

        if (error.response?.status === 401) {
          console.log("Unauthorized, redirecting to login")
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
    [checkAuthAndGetToken, router, initialLoadDone],
  )

  // Simplified fetch function that uses current state
  const fetchWithCurrentState = useCallback(
    (page = currentPage, limit = itemsPerPage, force = false) => {
      return fetchRedemptions(page, limit, force, searchTerm, dateRange, sortField, sortDirection)
    },
    [fetchRedemptions, currentPage, itemsPerPage, searchTerm, dateRange, sortField, sortDirection],
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
        fetchRedemptions(1, itemsPerPage, true, searchTerm, dateRange, sortField, sortDirection)
      }, 500)
    },
    [fetchRedemptions, itemsPerPage, searchTerm, dateRange, sortField, sortDirection],
  )

  // Function to handle date range change
  const handleDateRangeChange = useCallback(
    (field, value) => {
      const newDateRange = { ...dateRange, [field]: value }
      setDateRange(newDateRange)

      if (searchDebounceTimeout.current) {
        clearTimeout(searchDebounceTimeout.current)
      }

      searchDebounceTimeout.current = setTimeout(() => {
        setCurrentPage(1) // Reset to first page when changing date range
        fetchRedemptions(1, itemsPerPage, true, searchTerm, newDateRange, sortField, sortDirection)
      }, 500)
    },
    [fetchRedemptions, itemsPerPage, searchTerm, dateRange, sortField, sortDirection],
  )

  // Function to handle refresh
  const handleRefresh = useCallback(() => {
    fetchWithCurrentState(currentPage, itemsPerPage, true)
  }, [fetchWithCurrentState, currentPage, itemsPerPage])

  // Function to handle page change
  const handlePageChange = useCallback(
    (page) => {
      setCurrentPage(page)
      fetchRedemptions(page, itemsPerPage, false, searchTerm, dateRange, sortField, sortDirection)
    },
    [fetchRedemptions, itemsPerPage, searchTerm, dateRange, sortField, sortDirection],
  )

  // Function to handle items per page change
  const handleItemsPerPageChange = useCallback(
    (e) => {
      const newItemsPerPage = Number.parseInt(e.target.value, 10)
      setItemsPerPage(newItemsPerPage)
      setCurrentPage(1) // Reset to first page
      fetchRedemptions(1, newItemsPerPage, true, searchTerm, dateRange, sortField, sortDirection)
    },
    [fetchRedemptions, searchTerm, dateRange, sortField, sortDirection],
  )

  // Function to handle sort change
  const handleSortChange = useCallback(
    (field) => {
      let newDirection = "desc"
      const newField = field

      // If clicking the same field, toggle direction
      if (field === sortField) {
        newDirection = sortDirection === "asc" ? "desc" : "asc"
      }

      setSortField(newField)
      setSortDirection(newDirection)
      fetchRedemptions(currentPage, itemsPerPage, true, searchTerm, dateRange, newField, newDirection)
    },
    [fetchRedemptions, currentPage, itemsPerPage, searchTerm, dateRange, sortField, sortDirection],
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
      try {
        abortControllerRef.current.abort()
        console.log("Aborted request for clear filters")
      } catch (abortError) {
        console.error("Error aborting request:", abortError)
      }
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
        fetchRedemptions(1, itemsPerPage, true, "", { startDate: "", endDate: "" }, "redeemedAt", "desc")
      }
    }, 100)
  }, [fetchRedemptions, itemsPerPage])

  // Initial data fetch
  useEffect(() => {
    console.log("Initial useEffect triggered, initialLoadDone:", initialLoadDone)

    if (!initialLoadDone) {
      // Add a small delay to ensure component is fully mounted
      const timeoutId = setTimeout(() => {
        if (isMounted.current) {
          console.log("Triggering initial data fetch")
          fetchRedemptions(1, 50, true, "", { startDate: "", endDate: "" }, "redeemedAt", "desc")
        }
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, []) // Remove fetchRedemptions from dependencies to prevent infinite loop

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
    fetchRedemptions: fetchWithCurrentState,
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

    console.log("Main component useEffect triggered")

    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      console.log("No token found, redirecting to login")
      router.push("/admin/login")
    } else {
      console.log("Token found, component ready for data fetching")
      // The initial fetch will be handled by the custom hook
    }
  }, [isClient, router])

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
