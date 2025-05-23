"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Card, Table, Button, Alert, Row, Col, Spinner, Modal, Form, Pagination } from "react-bootstrap"
import axios from "axios"
import { FaSync, FaCheck, FaExclamationTriangle, FaCheckDouble, FaWifi, FaPause, FaPlay } from "react-icons/fa"
import { useRouter } from "next/navigation"
import "@/styles/adminstyles.css"
import {
  CACHE_KEYS,
  updatePendingCountInCaches,
  getPendingPinsCacheKey,
  getCacheItem,
  setCacheItem,
  formatTimeRemaining,
  getCacheTimeRemaining,
  onCacheInvalidated,
  onPinDataUpdated,
} from "@/lib/utils/cache-utils"

// Buat instance axios dengan konfigurasi default
const api = axios.create({
  timeout: 15000, // 15 seconds timeout
  headers: {
    "Content-Type": "application/json",
  },
})

// Fungsi untuk membatalkan request dengan aman
function safeAbort(controller) {
  try {
    if (controller) controller.abort()
  } catch (e) {
    console.warn("AbortController error:", e.message)
  }
}

// Custom hook untuk managing pending pins data
function usePendingPins() {
  // State untuk data pins
  const [pendingPins, setPendingPins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [nextAllowedFetchTime, setNextAllowedFetchTime] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  // State untuk pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  // State untuk selection
  const [selectedPins, setSelectedPins] = useState([])
  const [selectAll, setSelectAll] = useState(false)

  // State untuk processing
  const [processing, setProcessing] = useState(false)
  const [processingId, setProcessingId] = useState(null)
  const [batchProcessing, setBatchProcessing] = useState(false)

  // State untuk modal
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)
  const [showForceRefreshModal, setShowForceRefreshModal] = useState(false)
  const [showBatchProcessModal, setShowBatchProcessModal] = useState(false)

  // State untuk auth
  const [authError, setAuthError] = useState(false)

  // State untuk polling
  const [pollingActive, setPollingActive] = useState(false)
  const [lastEtag, setLastEtag] = useState(null)
  const [rateLimitHit, setRateLimitHit] = useState(false)
  const [consecutiveErrors, setConsecutiveErrors] = useState(0)
  const [countPollingActive, setCountPollingActive] = useState(false)
  const [lastCountEtag, setLastCountEtag] = useState(null)
  const [currentPollingInterval, setCurrentPollingInterval] = useState(0)

  // Refs untuk polling
  const pollingIntervalRef = useRef(null)
  const pollingTimeoutRef = useRef(null)
  const countPollingIntervalRef = useRef(null)
  const isMounted = useRef(true)
  const abortControllerRef = useRef(null)
  const timeoutRef = useRef(null)
  const requestInProgressRef = useRef(false)

  // Constants
  const BASE_POLLING_INTERVAL = 45000 // 45 seconds
  const COUNT_POLLING_INTERVAL = 30000 // 30 seconds
  const MAX_POLLING_INTERVAL = 300000 // 5 minutes
  const MIN_FETCH_INTERVAL = 10000 // 10 seconds

  // Router
  const router = useRouter()

  // Cleanup function untuk semua timers dan controllers
  const cleanupAllTimers = useCallback(() => {
    // Clear polling intervals
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    if (countPollingIntervalRef.current) {
      clearInterval(countPollingIntervalRef.current)
      countPollingIntervalRef.current = null
    }

    // Clear timeouts
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Abort any in-flight requests
    safeAbort(abortControllerRef.current)
    abortControllerRef.current = null
  }, [])

  // Check authentication dan get token
  const checkAuthAndGetToken = useCallback(() => {
    const token = typeof window !== "undefined" ? sessionStorage.getItem("adminToken") : null
    if (!token) {
      setAuthError(true)
      router.push("/admin/login")
      return null
    }
    return token
  }, [router])

  // Helper function untuk calculate exponential backoff interval
  const getBackoffInterval = useCallback((baseInterval, errorCount) => {
    const backoffMultiplier = Math.min(Math.pow(1.5, errorCount), 6) // Max 6x multiplier
    return Math.min(baseInterval * backoffMultiplier, MAX_POLLING_INTERVAL)
  }, [])

  // Helper function untuk fetch fresh data dari API
  const fetchFreshData = useCallback(async (token, page, limit, now, etag = null) => {
    // Prevent concurrent requests
    if (requestInProgressRef.current) {
      console.log("Request already in progress, skipping")
      return
    }

    requestInProgressRef.current = true

    try {
      // Set a timeout for the request (15 seconds)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Create new abort controller
      safeAbort(abortControllerRef.current)
      abortControllerRef.current = new AbortController()

      timeoutRef.current = setTimeout(() => {
        if (abortControllerRef.current && isMounted.current) {
          abortControllerRef.current.abort()
        }
      }, 15000)

      // Prepare headers with authentication
      const headers = {
        Authorization: `Bearer ${token}`,
      }

      // Add ETag header for conditional requests if available
      if (etag) {
        headers["If-None-Match"] = etag
      }

      // Use the dedicated endpoint for pending pins with pagination
      const response = await api.get(`/api/admin/pending-pins?page=${page}&limit=${limit}`, {
        headers,
        signal: abortControllerRef.current.signal,
        validateStatus: (status) => {
          // Accept 304 Not Modified as a valid status
          return (status >= 200 && status < 300) || status === 304
        },
      })

      // Only update state if component is still mounted
      if (!isMounted.current) return

      // Reset error count on successful request
      setConsecutiveErrors(0)
      setRateLimitHit(false)
      setCurrentPollingInterval(BASE_POLLING_INTERVAL)

      // If we got a 304 Not Modified, the data hasn't changed
      if (response.status === 304) {
        console.log("Data not modified, using cached version")
        setLoading(false)
        setIsRefreshing(false)

        // Update last fetch time but keep existing data
        setCacheItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, now)
        setLastFetchTime(now)

        return { notModified: true }
      }

      // Save the new ETag for future requests
      const newEtag = response.headers.etag
      if (newEtag) {
        setLastEtag(newEtag)
      }

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
      requestInProgressRef.current = false

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      // Pastikan loading state diatur false meskipun terjadi error
      if (isMounted.current) {
        setLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [])

  // Main function untuk fetch pending pins
  const fetchPendingPins = useCallback(
    async (force = false, page = currentPage, limit = itemsPerPage) => {
      // Set loading state immediately for better UX
      setLoading(true)
      setIsRefreshing(true)

      // Always force fetch on first load
      if (!initialLoadDone) {
        force = true
        console.log("First load detected, forcing data fetch")
      }

      const token = checkAuthAndGetToken()
      if (!token) {
        setLoading(false)
        setIsRefreshing(false)
        return
      }

      // Check if we're allowed to fetch based on time interval
      const now = Date.now()
      if (!force && lastFetchTime && now - lastFetchTime < MIN_FETCH_INTERVAL) {
        const timeRemaining = Math.ceil((lastFetchTime + MIN_FETCH_INTERVAL - now) / 1000)
        setError(`Untuk menghindari rate limit, tunggu ${timeRemaining} detik sebelum refresh data.`)
        setShowRateLimitModal(true)
        setLoading(false)
        setIsRefreshing(false)
        return
      }

      // Prevent concurrent requests
      if (requestInProgressRef.current) {
        console.log("Request already in progress, skipping")
        setLoading(false)
        setIsRefreshing(false)
        return
      }

      safeAbort(abortControllerRef.current)
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
                    fetchFreshData(token, page, limit, now, lastEtag).catch((error) => {
                      console.error("Background fetch error:", error)
                    })
                  }
                }, 2000)

                return
              }
            }
          }
        }

        // Jika tidak ada cache atau force refresh, langsung ambil data baru
        await fetchFreshData(token, page, limit, now, force ? null : lastEtag)
      } catch (error) {
        if (!isMounted.current) return

        if (error.name === "AbortError" || error.message === "canceled" || error.name === "CanceledError") {
          console.log("Fetch dibatalkan karena timeout atau perubahan halaman.")
        } else {
          console.error("Error fetching pending pins:", error)

          if (error.response?.status === 401) {
            sessionStorage.removeItem("adminToken")
            setAuthError(true)
            router.push("/admin/login")
          } else if (error.response?.status === 429) {
            setRateLimitHit(true)
            setConsecutiveErrors((prev) => prev + 1)

            // Get reset time from response headers if available
            const retryAfter =
              error.response.headers["retry-after"] || error.response.headers["x-ratelimit-reset"] || 60
            const resetTime = Number.parseInt(retryAfter) * 1000

            // Increase polling interval with exponential backoff
            const newInterval = Math.max(resetTime, getBackoffInterval(BASE_POLLING_INTERVAL, consecutiveErrors + 1))
            setCurrentPollingInterval(newInterval)

            setError(
              `Rate limit tercapai. Auto-refresh dihentikan sementara. Coba lagi dalam ${Math.ceil(retryAfter)} detik.`,
            )
            setShowRateLimitModal(true)

            // Update last fetch time to prevent spam requests
            const cooldownTime = Date.now() + resetTime
            setCacheItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, cooldownTime)
            setLastFetchTime(cooldownTime)
            setNextAllowedFetchTime(cooldownTime)
          } else {
            setConsecutiveErrors((prev) => prev + 1)
            setError(
              "Gagal mengambil data PIN pending: " +
                (error.response?.data?.error || error.message || "Terjadi kesalahan"),
            )

            // Jika data sudah ada sebelumnya, tetap tampilkan
            if (pendingPins.length === 0) {
              // Coba ambil dari cache jika ada
              const cacheKey = getPendingPinsCacheKey(currentPage, itemsPerPage)
              const cachedData = getCacheItem(cacheKey)
              if (cachedData && cachedData.length > 0) {
                setPendingPins(cachedData)
              }
            }
          }
        }
      } finally {
        // Pastikan loading state diatur false
        if (isMounted.current) {
          setLoading(false)
          setIsRefreshing(false)
          requestInProgressRef.current = false
        }
      }
    },
    [
      checkAuthAndGetToken,
      currentPage,
      fetchFreshData,
      initialLoadDone,
      itemsPerPage,
      lastFetchTime,
      router,
      lastEtag,
      consecutiveErrors,
      getBackoffInterval,
      pendingPins.length,
    ],
  )

  // Function untuk handle page changes
  const handlePageChange = useCallback(
    (page) => {
      setCurrentPage(page)
      fetchPendingPins(false, page, itemsPerPage)
    },
    [fetchPendingPins, itemsPerPage],
  )

  // Function untuk handle items per page changes
  const handleItemsPerPageChange = useCallback(
    (e) => {
      const newItemsPerPage = Number.parseInt(e.target.value, 10)
      setItemsPerPage(newItemsPerPage)
      setCurrentPage(1) // Reset to first page
      fetchPendingPins(false, 1, newItemsPerPage)
    },
    [fetchPendingPins],
  )

  // Function untuk mark a pin as processed
  const handleMarkAsProcessed = useCallback(
    async (pin) => {
      if (processing) return // Prevent multiple clicks

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
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

        // Use the optimized process-pin endpoint
        await api.post(
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

        if (error.name === "AbortError" || error.message === "canceled" || error.name === "CanceledError") {
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
    [currentPage, fetchPendingPins, handlePageChange, itemsPerPage, pendingPins, router, selectedPins, processing],
  )

  // Function untuk process multiple pins in batch
  const handleBatchProcess = useCallback(async () => {
    if (selectedPins.length === 0 || batchProcessing) return

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
      const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 second timeout

      const response = await api.post(
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
  }, [
    currentPage,
    fetchPendingPins,
    handlePageChange,
    itemsPerPage,
    pendingPins,
    router,
    selectedPins,
    batchProcessing,
  ])

  // Function untuk handle refresh button click
  const handleRefresh = useCallback(() => {
    const now = Date.now()
    if (isRefreshing) return // prevent spam klik

    if (lastFetchTime && now - lastFetchTime < MIN_FETCH_INTERVAL) {
      setShowForceRefreshModal(true)
    } else {
      fetchPendingPins(true)
    }
  }, [fetchPendingPins, lastFetchTime, isRefreshing])

  // Function untuk handle force refresh
  const handleForceRefresh = useCallback(() => {
    setShowForceRefreshModal(false)
    fetchPendingPins(true)
  }, [fetchPendingPins])

  // Function untuk handle select all pins
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

  // Function untuk handle select individual pin
  const handleSelectPin = useCallback((pinId, isChecked) => {
    if (isChecked) {
      setSelectedPins((prev) => [...prev, pinId])
    } else {
      setSelectedPins((prev) => prev.filter((id) => id !== pinId))
      setSelectAll(false)
    }
  }, [])

  // Start/stop count polling function
  const toggleCountPolling = useCallback(
    (active = true) => {
      if (active && !countPollingActive && !rateLimitHit) {
        setCountPollingActive(true)
        console.log("Starting polling for count updates")
      } else if (!active && countPollingActive) {
        setCountPollingActive(false)
        console.log("Stopping polling for count updates")
      }
    },
    [countPollingActive, rateLimitHit],
  )

  // Start/stop polling function
  const togglePolling = useCallback(
    (active = true) => {
      if (active && !pollingActive && !rateLimitHit) {
        setPollingActive(true)
        // Start count polling when main polling is started
        setCountPollingActive(true)
        console.log("Starting polling for data updates")
      } else if (!active && pollingActive) {
        setPollingActive(false)
        // Stop count polling when main polling is stopped
        setCountPollingActive(false)
        console.log("Stopping polling for data updates")
      }
    },
    [pollingActive, countPollingActive, rateLimitHit],
  )

  // Function untuk poll just for count updates (lighter weight)
  const pollForCountUpdates = useCallback(() => {
    if (!countPollingActive || !initialLoadDone || rateLimitHit) return
    if (requestInProgressRef.current) return // Skip if another request is in progress

    const token = sessionStorage.getItem("adminToken")
    if (!token) return

    console.log("Polling for count updates with ETag:", lastCountEtag)

    // Create new abort controller
    const controller = new AbortController()

    // Set timeout for the polling request
    const timeoutId = setTimeout(() => {
      controller.abort()
      console.log("Count polling request timed out")
    }, 5000)

    // Make a lightweight request with the ETag to the count endpoint
    api
      .get(`/api/admin/pending-pins-count`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "If-None-Match": lastCountEtag || "",
        },
        signal: controller.signal,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
      })
      .then((response) => {
        // Reset error count on successful request
        setConsecutiveErrors(0)
        setRateLimitHit(false)

        // If we got a 304 Not Modified, the count hasn't changed
        if (response.status === 304) {
          console.log("Count not modified since last poll")
          return
        }

        // If we got a 200 OK, the count has changed
        if (response.status === 200) {
          console.log("Count changed, updating...")

          // Save the new ETag
          const newEtag = response.headers.etag
          if (newEtag) {
            setLastCountEtag(newEtag)
          }

          // Update just the total count
          const newCount = response.data.count
          if (newCount !== totalItems) {
            setTotalItems(newCount)

            // If count changed but we're still showing the same page,
            // trigger a full data refresh to get updated items
            if (pendingPins.length > 0) {
              console.log("Count changed, refreshing full data")
              fetchPendingPins(true)
            }
          }
        }
      })
      .catch((error) => {
        if (error.name === "AbortError" || error.message === "canceled" || error.name === "CanceledError") {
          console.log("Count polling request was aborted")
          return
        }

        console.error("Error during count polling:", error)

        // Handle rate limit errors
        if (error.response?.status === 429) {
          setRateLimitHit(true)
          setConsecutiveErrors((prev) => prev + 1)
          toggleCountPolling(false)
          console.log("Rate limit hit, stopping count polling")
        } else if (error.response?.status === 401) {
          toggleCountPolling(false)
        }
      })
      .finally(() => {
        clearTimeout(timeoutId)
      })
  }, [
    countPollingActive,
    initialLoadDone,
    lastCountEtag,
    totalItems,
    pendingPins.length,
    fetchPendingPins,
    rateLimitHit,
    toggleCountPolling,
  ])

  // Enhance the pollForUpdates function to better handle ETags
  const pollForUpdates = useCallback(() => {
    if (!pollingActive || !initialLoadDone || rateLimitHit) return
    if (requestInProgressRef.current) return // Skip if another request is in progress

    const token = sessionStorage.getItem("adminToken")
    if (!token) return

    console.log("Polling for updates with ETag:", lastEtag)

    // Create new abort controller
    const controller = new AbortController()

    // Set timeout for the polling request
    const timeoutId = setTimeout(() => {
      controller.abort()
      console.log("Polling request timed out")
    }, 8000)

    // Make a request with the ETag
    api
      .get(`/api/admin/pending-pins?page=${currentPage}&limit=${itemsPerPage}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "If-None-Match": lastEtag || "",
        },
        signal: controller.signal,
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
      })
      .then((response) => {
        // Reset error count on successful request
        setConsecutiveErrors(0)
        setRateLimitHit(false)
        setCurrentPollingInterval(BASE_POLLING_INTERVAL)

        // If we got a 304 Not Modified, the data hasn't changed
        if (response.status === 304) {
          console.log("Data not modified since last poll")
          return
        }

        // If we got a 200 OK, the data has changed
        if (response.status === 200) {
          console.log("Data changed, updating...")

          // Save the new ETag
          const newEtag = response.headers.etag
          if (newEtag) {
            setLastEtag(newEtag)
          }

          // Update the data
          setPendingPins(response.data.pins || [])
          setTotalPages(response.data.totalPages || 1)
          setTotalItems(response.data.total || 0)

          // Update cache
          const cacheKey = getPendingPinsCacheKey(currentPage, itemsPerPage)
          setCacheItem(cacheKey, response.data.pins || [])
          setCacheItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, Date.now())
          setLastFetchTime(Date.now())

          // Show a success message when data is updated via polling
          setSuccessMessage("Data telah diperbarui secara otomatis")

          // Clear the message after 3 seconds
          setTimeout(() => {
            if (isMounted.current) {
              setSuccessMessage("")
            }
          }, 3000)
        }
      })
      .catch((error) => {
        if (error.name === "AbortError" || error.message === "canceled" || error.name === "CanceledError") {
          console.log("Polling request was aborted")
          return
        }

        console.error("Error during polling:", error)

        // Handle rate limit errors
        if (error.response?.status === 429) {
          setRateLimitHit(true)
          setConsecutiveErrors((prev) => prev + 1)

          // Increase polling interval with exponential backoff
          const newInterval = getBackoffInterval(BASE_POLLING_INTERVAL, consecutiveErrors + 1)
          setCurrentPollingInterval(newInterval)

          console.log(`Rate limit hit, increasing polling interval to ${newInterval}ms`)
        } else if (error.response?.status === 401) {
          togglePolling(false)
        } else {
          setConsecutiveErrors((prev) => prev + 1)
        }
      })
      .finally(() => {
        clearTimeout(timeoutId)
      })
  }, [
    pollingActive,
    initialLoadDone,
    lastEtag,
    currentPage,
    itemsPerPage,
    togglePolling,
    rateLimitHit,
    consecutiveErrors,
    getBackoffInterval,
  ])

  // Setup polling interval with dynamic interval based on errors
  useEffect(() => {
    // Set initial polling interval
    if (!currentPollingInterval) {
      setCurrentPollingInterval(BASE_POLLING_INTERVAL)
    }

    if (pollingActive && !rateLimitHit) {
      // Clear any existing interval
      cleanupAllTimers()

      // Set up new polling interval with current interval (includes backoff)
      pollingIntervalRef.current = setInterval(() => {
        pollForUpdates()
      }, currentPollingInterval)

      // Initial poll after a delay
      pollingTimeoutRef.current = setTimeout(() => {
        pollForUpdates()
      }, 3000)

      console.log(`Polling started with ${currentPollingInterval}ms interval`)
    } else {
      // Clear interval when polling is inactive
      cleanupAllTimers()

      // Also stop count polling when main polling is stopped
      toggleCountPolling(false)
    }

    // Cleanup on unmount or when dependencies change
    return cleanupAllTimers
  }, [pollingActive, pollForUpdates, toggleCountPolling, currentPollingInterval, rateLimitHit, cleanupAllTimers])

  // Setup count polling interval
  useEffect(() => {
    if (countPollingActive && !rateLimitHit) {
      // Clear any existing interval
      if (countPollingIntervalRef.current) {
        clearInterval(countPollingIntervalRef.current)
      }

      // Set up new polling interval
      countPollingIntervalRef.current = setInterval(() => {
        pollForCountUpdates()
      }, COUNT_POLLING_INTERVAL)

      // Initial poll after a delay
      setTimeout(() => {
        pollForCountUpdates()
      }, 2000)

      console.log(`Count polling started with ${COUNT_POLLING_INTERVAL}ms interval`)
    } else {
      // Clear interval when polling is inactive
      if (countPollingIntervalRef.current) {
        clearInterval(countPollingIntervalRef.current)
        countPollingIntervalRef.current = null
      }
    }

    // Cleanup on unmount
    return () => {
      if (countPollingIntervalRef.current) {
        clearInterval(countPollingIntervalRef.current)
        countPollingIntervalRef.current = null
      }
    }
  }, [countPollingActive, pollForCountUpdates, rateLimitHit])

  // Set isClient to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false
      cleanupAllTimers()
    }
  }, [cleanupAllTimers])

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
    pollingActive,
    countPollingActive,
    lastCountEtag,
    rateLimitHit,
    currentPollingInterval,
    consecutiveErrors,

    // Actions
    setPendingPins,
    setError,
    setSuccessMessage,
    setShowRateLimitModal,
    setShowForceRefreshModal,
    setShowBatchProcessModal,
    togglePolling,
    toggleCountPolling,

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
    BASE_POLLING_INTERVAL,
  }
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

    // Register cache invalidation listener using the new utility
    const unsubscribeCache = onCacheInvalidated(handleDataUpdate)

    // Register pin data update listener using the new utility
    const unsubscribePinData = onPinDataUpdated(handleDataUpdate)

    return () => {
      // Remove event listeners
      window.removeEventListener("pin-data-updated", handleDataUpdate)
      window.removeEventListener("cache-invalidated", handleDataUpdate)

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
    pollingActive,
    countPollingActive,
    rateLimitHit,
    currentPollingInterval,
    consecutiveErrors,

    setShowRateLimitModal,
    setShowForceRefreshModal,
    setShowBatchProcessModal,
    togglePolling,

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
    BASE_POLLING_INTERVAL,
    isMounted,
  } = pendingPinsState

  // Use event listeners hook
  useEventListeners(pendingPinsState)

  // Set isClient on mount and start polling
  useEffect(() => {
    setIsClient(true)

    // Check authentication on component mount
    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      window.location.href = "/admin/login"
      return
    }

    // Always force a fresh load on initial render with retry
    const loadInitialData = () => {
      console.log("Starting initial data load...")
      fetchPendingPins(true).catch((error) => {
        console.error("Initial data load failed:", error)
        // Retry after 3 seconds if failed
        setTimeout(() => {
          if (isMounted && isMounted.current) {
            console.log("Retrying initial data load...")
            fetchPendingPins(true)
          }
        }, 3000)
      })
    }

    loadInitialData()

    // Start polling after initial load with a longer delay
    const pollingTimer = setTimeout(() => {
      if (!rateLimitHit && isMounted && isMounted.current) {
        togglePolling(true)
      }
    }, 5000) // Wait 5 seconds before starting polling

    // Add a safety timeout to stop loading if it takes too long
    const safetyTimer = setTimeout(() => {
      console.log("Safety timeout triggered - data should have loaded by now")
      // The loading state is managed by the custom hook, so we don't need to set it here
    }, 15000) // 15 seconds safety timeout

    return () => {
      // Stop polling when component unmounts
      togglePolling(false)
      clearTimeout(pollingTimer)
      clearTimeout(safetyTimer)
    }
  }, [fetchPendingPins, togglePolling, rateLimitHit, isMounted])

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
              <div className="d-flex justify-content-center align-items-center mt-2">
                <small className="me-2">
                  Terakhir diperbarui: {lastFetchTime > 0 ? new Date(lastFetchTime).toLocaleTimeString() : "-"}
                </small>
                {pollingActive && !rateLimitHit && (
                  <div className="d-flex align-items-center">
                    <span className="badge bg-success d-flex align-items-center">
                      <FaWifi className="me-1" size={10} /> Auto-refresh
                    </span>
                    <span className="ms-1 text-white-50" style={{ fontSize: "0.7rem" }}>
                      ({Math.round(currentPollingInterval / 1000)}s)
                    </span>
                  </div>
                )}
                {rateLimitHit && (
                  <span className="badge bg-danger d-flex align-items-center">
                    <FaPause className="me-1" size={10} /> Rate Limited
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
            <Button
              variant={
                pollingActive && !rateLimitHit
                  ? "outline-success"
                  : rateLimitHit
                    ? "outline-danger"
                    : "outline-secondary"
              }
              size="sm"
              className="me-2"
              onClick={() => togglePolling(!pollingActive)}
              title={
                rateLimitHit
                  ? "Rate limit tercapai - polling dihentikan"
                  : pollingActive
                    ? "Nonaktifkan auto-refresh"
                    : "Aktifkan auto-refresh"
              }
              disabled={rateLimitHit}
            >
              {rateLimitHit ? (
                <>
                  <FaPause className="me-1" />
                  Rate Limited
                </>
              ) : pollingActive ? (
                <>
                  <FaWifi className="me-1" />
                  Auto ON
                </>
              ) : (
                <>
                  <FaPlay className="me-1" />
                  Auto OFF
                </>
              )}
            </Button>
            <Button variant="outline-primary" size="sm" onClick={handleRefresh} disabled={loading || isRefreshing}>
              <FaSync className={`me-1 ${isRefreshing ? "fa-spin" : ""}`} />
              {isRefreshing ? "Memuat..." : "Refresh"}
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          {rateLimitHit && (
            <Alert variant="warning" className="mb-3">
              <strong>Rate Limit Tercapai!</strong> Auto-refresh telah dihentikan untuk mencegah spam request. Gunakan
              tombol refresh manual jika diperlukan. Polling akan otomatis aktif kembali setelah beberapa saat.
              {consecutiveErrors > 0 && (
                <div className="mt-1">
                  <small>Consecutive errors: {consecutiveErrors}</small>
                </div>
              )}
            </Alert>
          )}

          {loading && pendingPins.length === 0 ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <p className="mt-2">Memuat data PIN pending...</p>
              <Button
                variant="outline-secondary"
                size="sm"
                className="mt-3"
                onClick={() => fetchPendingPins(true)}
                disabled={isRefreshing}
              >
                {isRefreshing ? "Memuat ulang..." : "Muat Ulang Data"}
              </Button>
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
          {rateLimitHit ? (
            <Alert variant="danger">
              <strong>Rate limit tercapai!</strong> Auto-refresh telah dihentikan sementara. Interval polling telah
              diperlambat ke {Math.round(currentPollingInterval / 1000)} detik.
            </Alert>
          ) : (
            <p>
              Anda dapat melakukan refresh data lagi dalam: <strong>{timeRemainingFormatted}</strong>
            </p>
          )}
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
