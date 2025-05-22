"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Card, Table, Button, Alert, Row, Col, Spinner, Modal, Form, Pagination } from "react-bootstrap"
import axios from "axios"
import { FaSync, FaCheck, FaExclamationTriangle, FaCheckDouble, FaWifi } from "react-icons/fa"
import { useRouter } from "next/navigation"
import "@/styles/adminstyles.css"
import {
  CACHE_KEYS,
  CACHE_EXPIRATION,
  updatePendingCountInCaches,
  getPendingPinsCacheKey,
  getCacheItem,
  setCacheItem,
  formatTimeRemaining,
  getCacheTimeRemaining,
  onCacheInvalidated,
  onPinDataUpdated,
} from "@/lib/utils/cache-utils"
import getAdminSSEClient from "@/lib/utils/sse-client"

// Custom hook for managing pending pins data
function usePendingPins() {
  // State for pins data
  const [pendingPins, setPendingPins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [nextAllowedFetchTime, setNextAllowedFetchTime] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  // Selection state
  const [selectedPins, setSelectedPins] = useState([])
  const [selectAll, setSelectAll] = useState(false)

  // Processing state
  const [processing, setProcessing] = useState(false)
  const [processingId, setProcessingId] = useState(null)
  const [batchProcessing, setBatchProcessing] = useState(false)

  // Modal state
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)
  const [showForceRefreshModal, setShowForceRefreshModal] = useState(false)
  const [showBatchProcessModal, setShowBatchProcessModal] = useState(false)

  // Auth state
  const [authError, setAuthError] = useState(false)

  // SSE state
  const [sseConnected, setSSEConnected] = useState(false)
  const [sseError, setSSEError] = useState(null)

  // Router
  const router = useRouter()

  // Refs
  const isMounted = useRef(true)
  const abortControllerRef = useRef(null)
  const timeoutRef = useRef(null)

  // Constants
  const MIN_FETCH_INTERVAL = CACHE_EXPIRATION.MEDIUM // 5 minutes

  // Check authentication and get token
  const checkAuthAndGetToken = useCallback(() => {
    const token = typeof window !== "undefined" ? sessionStorage.getItem("adminToken") : null
    if (!token) {
      setAuthError(true)
      router.push("/admin/login")
      return null
    }
    return token
  }, [router])

  // Helper function to fetch fresh data from API
  const fetchFreshData = useCallback(async (token, page, limit, now) => {
    try {
      // Set a timeout for the request (10 seconds)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        if (abortControllerRef.current && isMounted.current) {
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

      // Only update state if component is still mounted
      if (!isMounted.current) return

      // Update state with pins from the dedicated endpoint
      setPendingPins(response.data.pins || [])
      setTotalPages(response.data.totalPages || 1)
      setTotalItems(response.data.total || 0)

      // Update cache with the current page data
      const cacheKey = getPendingPinsCacheKey(page, limit)
      setCacheItem(cacheKey, response.data.pins || [])
      setCacheItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, now)
      setLastFetchTime(now)
      setNextAllowedFetchTime(now + MIN_FETCH_INTERVAL)
      setInitialLoadDone(true)

      // Clear any error messages
      setError("")

      // Reset selection state
      setSelectedPins([])
      setSelectAll(false)

      // Set loading to false explicitly
      setLoading(false)
      setIsRefreshing(false)

      return response.data
    } catch (error) {
      // Re-throw error to be handled by the parent function
      throw error
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  // Main function to fetch pending pins
  const fetchPendingPins = useCallback(
    async (force = false, page = currentPage, limit = itemsPerPage) => {
      // Always force fetch on first load
      if (!initialLoadDone) {
        force = true
        console.log("First load detected, forcing data fetch")
      }

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
      setError("")

      try {
        // Cek cache terlebih dahulu jika tidak force refresh
        if (!force) {
          const cacheKey = getPendingPinsCacheKey(page, limit)
          const cachedData = getCacheItem(cacheKey)
          const lastFetch = getCacheItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH)

          if (cachedData && lastFetch) {
            // Jika cache masih valid (kurang dari interval minimum)
            if (now - lastFetch < MIN_FETCH_INTERVAL) {
              if (isMounted.current) {
                setPendingPins(cachedData)
                setLoading(false)
                setIsRefreshing(false)
                setInitialLoadDone(true)

                // Tetap ambil data baru di background setelah delay singkat
                setTimeout(() => {
                  if (isMounted.current) {
                    fetchFreshData(token, page, limit, now).catch((error) => {
                      console.error("Background fetch error:", error)
                    })
                  }
                }, 1000)

                return
              }
            }
          }
        }

        // Jika tidak ada cache atau force refresh, langsung ambil data baru
        await fetchFreshData(token, page, limit, now)
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
          setCacheItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, now)
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
    },
    [checkAuthAndGetToken, currentPage, fetchFreshData, initialLoadDone, itemsPerPage, lastFetchTime, router],
  )

  // Function to handle page changes
  const handlePageChange = useCallback(
    (page) => {
      setCurrentPage(page)
      fetchPendingPins(false, page, itemsPerPage)
    },
    [fetchPendingPins, itemsPerPage],
  )

  // Function to handle items per page changes
  const handleItemsPerPageChange = useCallback(
    (e) => {
      const newItemsPerPage = Number.parseInt(e.target.value, 10)
      setItemsPerPage(newItemsPerPage)
      setCurrentPage(1) // Reset to first page
      fetchPendingPins(false, 1, newItemsPerPage)
    },
    [fetchPendingPins],
  )

  // Function to mark a pin as processed
  const handleMarkAsProcessed = useCallback(
    async (pin) => {
      setProcessing(true)
      setProcessingId(pin._id)
      setError("")
      setSuccessMessage("")

      try {
        const token = sessionStorage.getItem("adminToken")
        if (!token) {
          setAuthError(true)
          router.push("/admin/login")
          return
        }

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
        const cacheKey = getPendingPinsCacheKey(currentPage, itemsPerPage)
        setCacheItem(cacheKey, updatedPins)

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

        // Broadcast event untuk memberi tahu komponen lain
        window.dispatchEvent(
          new CustomEvent("pin-data-updated", {
            detail: { processedCount: 1 },
          }),
        )

        // Force refresh UI
        router.refresh()
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
    },
    [currentPage, fetchPendingPins, handlePageChange, itemsPerPage, pendingPins, router, selectedPins],
  )

  // Function to process multiple pins in batch
  const handleBatchProcess = useCallback(async () => {
    if (selectedPins.length === 0) return

    setBatchProcessing(true)
    setError("")
    setSuccessMessage("")

    try {
      const token = sessionStorage.getItem("adminToken")
      if (!token) {
        setAuthError(true)
        router.push("/admin/login")
        return
      }

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
      setSuccessMessage(`${processedCount} PIN berhasil ditandai sebagai sudah diproses`)

      // Remove the processed pins from the list
      const updatedPins = pendingPins.filter((p) => !selectedPins.includes(p._id))
      setPendingPins(updatedPins)

      // Update the cache for the current page
      const cacheKey = getPendingPinsCacheKey(currentPage, itemsPerPage)
      setCacheItem(cacheKey, updatedPins)

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

      // Broadcast event untuk memberi tahu komponen lain
      window.dispatchEvent(
        new CustomEvent("pin-data-updated", {
          detail: { processedCount },
        }),
      )

      // Force refresh UI
      router.refresh()
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
  }, [currentPage, fetchPendingPins, handlePageChange, itemsPerPage, pendingPins, router, selectedPins])

  // Function to handle refresh button click
  const handleRefresh = useCallback(() => {
    const now = Date.now()
    if (lastFetchTime && now - lastFetchTime < MIN_FETCH_INTERVAL) {
      setShowForceRefreshModal(true)
    } else {
      fetchPendingPins(true)
    }
  }, [fetchPendingPins, lastFetchTime])

  // Function to handle force refresh
  const handleForceRefresh = useCallback(() => {
    setShowForceRefreshModal(false)
    fetchPendingPins(true)
  }, [fetchPendingPins])

  // Function to handle select all pins
  const handleSelectAll = useCallback(
    (e) => {
      const isChecked = e.target.checked
      setSelectAll(isChecked)
      if (isChecked) {
        setSelectedPins(pendingPins.map((pin) => pin._id))
      } else {
        setSelectedPins([])
      }
    },
    [pendingPins],
  )

  // Function to handle select individual pin
  const handleSelectPin = useCallback((pinId, isChecked) => {
    if (isChecked) {
      setSelectedPins((prev) => [...prev, pinId])
    } else {
      setSelectedPins((prev) => prev.filter((id) => id !== pinId))
      setSelectAll(false)
    }
  }, [])

  // Calculate time remaining until next allowed fetch
  const timeRemainingFormatted = useMemo(() => {
    const timeRemaining = getCacheTimeRemaining(CACHE_KEYS.PENDING_PINS_LAST_FETCH, MIN_FETCH_INTERVAL)
    return formatTimeRemaining(timeRemaining)
  }, [nextAllowedFetchTime])

  return {
    // State
    pendingPins,
    loading,
    error,
    successMessage,
    isRefreshing,
    lastFetchTime,
    totalItems,
    currentPage,
    totalPages,
    itemsPerPage,
    selectedPins,
    selectAll,
    processing,
    processingId,
    batchProcessing,
    showRateLimitModal,
    showForceRefreshModal,
    showBatchProcessModal,
    authError,
    sseConnected,
    sseError,

    // Actions
    setPendingPins,
    setError,
    setSuccessMessage,
    setShowRateLimitModal,
    setShowForceRefreshModal,
    setShowBatchProcessModal,
    setSSEConnected,
    setSSEError,

    // Methods
    fetchPendingPins,
    handlePageChange,
    handleItemsPerPageChange,
    handleMarkAsProcessed,
    handleBatchProcess,
    handleRefresh,
    handleForceRefresh,
    handleSelectAll,
    handleSelectPin,

    // Computed
    timeRemainingFormatted,

    // Refs
    isMounted,

    // Constants
    MIN_FETCH_INTERVAL,
  }
}

// Custom hook for SSE connection
function useSSEConnection(pendingPinsState) {
  const {
    setPendingPins,
    setSuccessMessage,
    setSSEConnected,
    setSSEError,
    fetchPendingPins,
    currentPage,
    itemsPerPage,
    pendingPins,
    isMounted,
    initialLoadDone,
  } = pendingPinsState

  const router = useRouter()

  useEffect(() => {
    // Inisialisasi SSE hanya jika token tersedia
    const token = sessionStorage.getItem("adminToken")

    if (token && token.length > 10) {
      // Variabel untuk menyimpan fungsi cleanup
      let sseCleanup = () => {}

      // Fungsi untuk inisialisasi SSE
      const initializeSSE = async () => {
        try {
          // Inisialisasi SSE client
          const sseClient = getAdminSSEClient()

          // Handler untuk event SSE
          const handlePinProcessed = (data) => {
            console.log("SSE: Pin processed:", data)

            // Jika pin yang diproses ada di halaman ini, hapus dari daftar
            if (pendingPins.some((pin) => pin._id === data.pinId)) {
              if (isMounted.current) {
                // Update daftar pin
                const updatedPins = pendingPins.filter((pin) => pin._id !== data.pinId)
                setPendingPins(updatedPins)

                // Update cache
                const cacheKey = getPendingPinsCacheKey(currentPage, itemsPerPage)
                setCacheItem(cacheKey, updatedPins)

                // Update counter
                updatePendingCountInCaches(1)

                // Tampilkan notifikasi
                setSuccessMessage(`PIN telah diproses oleh ${data.processedBy?.username || "admin lain"}`)

                // Force refresh UI
                router.refresh()
              }
            }
          }

          const handleBatchProcessed = (data) => {
            console.log("SSE: Batch processed:", data)

            // Jika ada pin yang diproses di halaman ini, refresh data
            const processedCount = data.count || 0

            if (processedCount > 0) {
              if (isMounted.current) {
                setSuccessMessage(
                  `${processedCount} PIN telah diproses oleh ${data.processedBy?.username || "admin lain"}`,
                )

                // Refresh data untuk mendapatkan daftar terbaru
                fetchPendingPins(true)

                // Update counter
                updatePendingCountInCaches(processedCount)

                // Force refresh UI
                router.refresh()
              }
            }
          }

          const handleSSEConnected = (data) => {
            console.log("SSE connected:", data)
            setSSEConnected(true)
            setSSEError(null)

            // Force refresh data when SSE connects
            if (initialLoadDone) {
              fetchPendingPins(true)
            }
          }

          const handleSSEDisconnected = (data) => {
            console.log("SSE disconnected:", data)
            setSSEConnected(false)
          }

          const handleSSEError = (data) => {
            console.error("SSE error:", data)
            setSSEConnected(false)
            setSSEError(data.message)
          }

          // Daftarkan event listeners SSE
          sseClient.on("pin-processed", handlePinProcessed)
          sseClient.on("pins-batch-processed", handleBatchProcessed)
          sseClient.on("connected", handleSSEConnected)
          sseClient.on("disconnected", handleSSEDisconnected)
          sseClient.on("error", handleSSEError)

          // Connect ke SSE server
          await sseClient.connect()

          // Definisikan fungsi cleanup
          sseCleanup = () => {
            console.log("Cleaning up SSE event listeners")
            // Remove SSE event listeners
            sseClient.off("pin-processed", handlePinProcessed)
            sseClient.off("pins-batch-processed", handleBatchProcessed)
            sseClient.off("connected", handleSSEConnected)
            sseClient.off("disconnected", handleSSEDisconnected)
            sseClient.off("error", handleSSEError)

            // Disconnect SSE
            sseClient.disconnect()
          }
        } catch (error) {
          console.error("Failed to initialize SSE:", error)
          setSSEError(error.message)
        }
      }

      // Start initialization
      initializeSSE()

      // Cleanup function
      return () => {
        // Execute SSE cleanup
        sseCleanup()
      }
    } else {
      console.warn("Token belum tersedia atau tidak valid. SSE tidak dijalankan.")
    }
  }, [
    currentPage,
    fetchPendingPins,
    isMounted,
    initialLoadDone,
    itemsPerPage,
    pendingPins,
    router,
    setSSEConnected,
    setSSEError,
    setSuccessMessage,
    setPendingPins,
  ])
}

// Custom hook for event listeners
function useEventListeners(pendingPinsState) {
  const { fetchPendingPins, isMounted } = pendingPinsState

  useEffect(() => {
    // Tambahkan event listener untuk update data
    const handleDataUpdate = () => {
      if (isMounted.current) {
        fetchPendingPins(true)
      }
    }

    window.addEventListener("pin-data-updated", handleDataUpdate)
    window.addEventListener("cache-invalidated", handleDataUpdate)
    window.addEventListener("sse-pin-processed", handleDataUpdate)
    window.addEventListener("sse-pins-batch-processed", handleDataUpdate)

    // Register cache invalidation listener using the new utility
    const unsubscribeCache = onCacheInvalidated(handleDataUpdate)

    // Register pin data update listener using the new utility
    const unsubscribePinData = onPinDataUpdated(handleDataUpdate)

    return () => {
      // Remove event listeners
      window.removeEventListener("pin-data-updated", handleDataUpdate)
      window.removeEventListener("cache-invalidated", handleDataUpdate)
      window.removeEventListener("sse-pin-processed", handleDataUpdate)
      window.removeEventListener("sse-pins-batch-processed", handleDataUpdate)

      // Unsubscribe from cache utilities
      unsubscribeCache()
      unsubscribePinData()
    }
  }, [fetchPendingPins, isMounted])
}

// Render pagination controls
function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  pendingPins,
  handlePageChange,
  handleItemsPerPageChange,
}) {
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

// Main component
const PendingPins = () => {
  const [isClient, setIsClient] = useState(false)

  // Use custom hooks
  const pendingPinsState = usePendingPins()

  // Destructure state and methods from the hook
  const {
    pendingPins,
    loading,
    error,
    successMessage,
    isRefreshing,
    lastFetchTime,
    totalItems,
    currentPage,
    totalPages,
    itemsPerPage,
    selectedPins,
    selectAll,
    processing,
    processingId,
    batchProcessing,
    showRateLimitModal,
    showForceRefreshModal,
    showBatchProcessModal,
    authError,
    sseConnected,
    sseError,

    setShowRateLimitModal,
    setShowForceRefreshModal,
    setShowBatchProcessModal,

    fetchPendingPins,
    handlePageChange,
    handleItemsPerPageChange,
    handleMarkAsProcessed,
    handleBatchProcess,
    handleRefresh,
    handleForceRefresh,
    handleSelectAll,
    handleSelectPin,

    timeRemainingFormatted,
  } = pendingPinsState

  // Use SSE connection hook
  useSSEConnection(pendingPinsState)

  // Use event listeners hook
  useEventListeners(pendingPinsState)

  // Set isClient on mount
  useEffect(() => {
    setIsClient(true)

    // Check authentication on component mount
    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      window.location.href = "/admin/login"
    } else {
      // Always force a fresh load on initial render
      fetchPendingPins(true)
    }
  }, [fetchPendingPins])

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
      {sseError && <Alert variant="warning">Error koneksi: {sseError}. Mencoba menghubungkan kembali...</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <Row className="mb-4">
        <Col>
          <Card className="text-center bg-warning text-white">
            <Card.Body>
              <h3>{totalItems}</h3>
              <p className="mb-0">Total PIN Pending</p>
              <div className="d-flex justify-content-center align-items-center mt-2">
                <small className="me-2">
                  Terakhir diperbarui: {lastFetchTime > 0 ? new Date(lastFetchTime).toLocaleTimeString() : "-"}
                </small>
                {sseConnected && (
                  <span className="badge bg-success d-flex align-items-center">
                    <FaWifi className="me-1" size={10} /> Live
                  </span>
                )}
              </div>
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
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            pendingPins={pendingPins}
            handlePageChange={handlePageChange}
            handleItemsPerPageChange={handleItemsPerPageChange}
          />
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
            Anda dapat melakukan refresh data lagi dalam: <strong>{timeRemainingFormatted}</strong>
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
            Waktu yang disarankan untuk refresh berikutnya: <strong>{timeRemainingFormatted}</strong>
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
