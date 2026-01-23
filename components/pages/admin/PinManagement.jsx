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
import { useRouter } from "next/navigation"
import axios from "axios"
import {
  FaFileUpload,
  FaFileDownload,
  FaPlus,
  FaSync,
  FaTrash,
  FaCheck,
  FaFilter,
  FaSearch,
  FaExclamationTriangle,
  FaWifi,
  FaPlay,
  FaEye,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
} from "react-icons/fa"
import Papa from "papaparse"

// Cache utilities - Improved
const CACHE_KEYS = {
  DASHBOARD_STATS: "dashboard_stats",
  DASHBOARD_STATS_LAST_FETCH: "dashboard_stats_last_fetch",
  PIN_MANAGEMENT_LAST_FETCH: "pin_management_last_fetch",
  PIN_MANAGEMENT_DATA: "pin_management_data",
}

const invalidateAllCaches = () => {
  Object.values(CACHE_KEYS).forEach((key) => {
    localStorage.removeItem(key)
  })
  // Also clear any ETag related cache
  sessionStorage.removeItem("pin_etag")
  sessionStorage.removeItem("stats_etag")
}

// Force refresh function that bypasses all caches
const forceRefreshData = async (fetchFunction, ...args) => {
  // Clear all cache indicators
  invalidateAllCaches()

  // Add cache-busting parameter
  const timestamp = Date.now()
  return await fetchFunction(...args, {
    force: true,
    bypassCache: true,
    cacheBuster: timestamp,
  })
}

// Create axios instance with improved cache handling
const api = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
})

// Add request interceptor to handle cache busting
api.interceptors.request.use((config) => {
  // Add cache busting for critical operations
  if (config.method === "post" || config.method === "delete" || config.method === "patch") {
    config.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    config.headers["Pragma"] = "no-cache"
    config.headers["Expires"] = "0"
  }

  // Remove ETag for force refresh
  if (config.bypassCache) {
    delete config.headers["If-None-Match"]
    config.params = { ...config.params, _t: Date.now() }
  }

  return config
})

function PinManagement() {
  const router = useRouter()
  const { status } = useSession()
  const fileInputRef = useRef(null)
  const isMountedRef = useRef(false)
  const pollingIntervalRef = useRef(null)
  const requestInProgressRef = useRef(null)
  const componentIdRef = useRef(Math.random().toString(36).substr(2, 9))
  const abortControllerRef = useRef(null)
  const searchTimeoutRef = useRef(null)
  const refreshTimeoutRef = useRef(null)

  // Basic state
  const [isClient, setIsClient] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [pins, setPins] = useState([])
  const [filteredPins, setFilteredPins] = useState([])
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [error, setError] = useState("")

  // Toast notifications
  const [toasts, setToasts] = useState([])

  // PIN generation state
  const [pinCount, setPinCount] = useState(10)
  const [pinPrefix, setPinPrefix] = useState("")
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState("generate")

  // Import state
  const [importError, setImportError] = useState("")
  const [importSuccess, setImportSuccess] = useState("")
  const [importPreview, setImportPreview] = useState([])
  const [isImporting, setIsImporting] = useState(false)

  // Stats with immediate update capability
  const [stats, setStats] = useState({
    total: 0,
    used: 0,
    available: 0,
    pending: 0,
    processed: 0,
  })

  // Selection and modals
  const [selectedPins, setSelectedPins] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false)
  const [deletingMultiple, setDeletingMultiple] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [pinToDelete, setPinToDelete] = useState(null)
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [pinToProcess, setPinToProcess] = useState(null)
  const [processing, setProcessing] = useState(false)

  // Filtering and search
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(100)
  const [totalItems, setTotalItems] = useState(0)

  // Polling
  const [pollingActive, setPollingActive] = useState(false)
  const [lastEtag, setLastEtag] = useState(null)
  const [lastRefreshTime, setLastRefreshTime] = useState(0)
  const [rateLimitHit, setRateLimitHit] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("connected")

  // Constants
  const MIN_REFRESH_INTERVAL = 1000 // Reduced for better responsiveness
  const POLLING_INTERVAL = 10000 // Reduced for more frequent updates
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

  // Toast helper
  const addToast = useCallback((message, type = "success", duration = 5000) => {
    const id = Date.now()
    const toast = { id, message, type, duration }
    setToasts((prev) => [...prev, toast])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  // Safe state update function
  const safeSetState = useCallback((updateFn) => {
    if (isMountedRef.current) {
      updateFn()
    }
  }, [])

  // Check authentication
  const checkAuth = useCallback(() => {
    if (status !== "authenticated") {
      console.log("⏳ Waiting for authentication..., current status:", status)
      if (status === "unauthenticated") {
        safeSetState(() => {
          setAuthError(true)
        })
        router.push("/admin/login")
      }
      return null
    }
    return true
  }, [status, router, safeSetState])

  // Immediate stats update function
  const updateStatsImmediately = useCallback((operation, count = 1) => {
    setStats((prevStats) => {
      const newStats = { ...prevStats }

      switch (operation) {
        case "generate":
          newStats.total += count
          newStats.available += count
          break
        case "delete":
          newStats.total -= count
          newStats.available -= count
          break
        case "process":
          newStats.pending -= count
          newStats.processed += count
          break
        case "redeem":
          newStats.available -= count
          newStats.used += count
          newStats.pending += count
          break
      }

      // Update cache immediately
      localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS, JSON.stringify(newStats))

      return newStats
    })
  }, [])

  // Memoized filter function
  const applyFilters = useCallback(
    (pinsData) => {
      let filtered = [...pinsData]

      // Status filter
      switch (filterStatus) {
        case "available":
          filtered = filtered.filter((pin) => !pin.used)
          break
        case "pending":
          filtered = filtered.filter((pin) => pin.used && !pin.processed)
          break
        case "processed":
          filtered = filtered.filter((pin) => pin.used && pin.processed)
          break
        default:
          break
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        filtered = filtered.filter(
          (pin) =>
            pin.code.toLowerCase().includes(searchLower) ||
            (pin.redeemedBy?.nama && pin.redeemedBy.nama.toLowerCase().includes(searchLower)) ||
            (pin.redeemedBy?.idGame && pin.redeemedBy.idGame.toLowerCase().includes(searchLower)),
        )
      }

      safeSetState(() => {
        setFilteredPins(filtered)
      })
      return filtered
    },
    [filterStatus, searchTerm, safeSetState],
  )

  // Enhanced fetch pins function with better cache handling
  const fetchPins = useCallback(
    async (page = 1, limit = 100, force = false, options = {}) => {
      if (status !== "authenticated") {
        console.log("⏳ Waiting for authentication..., current status:", status)
        return
      }

      if (requestInProgressRef.current && !force) {
        return
      }

      if (!isMountedRef.current) {
        return
      }

      const token = checkAuth()
      if (!token) {
        return
      }

      // Rate limiting check
      const now = Date.now()
      if (!force && lastRefreshTime && now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        return
      }

      requestInProgressRef.current = true

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      safeSetState(() => {
        setLoading(true)
        setError("")
        setConnectionStatus("connecting")
      })

      try {
        const headers = { Authorization: `Bearer ${token}` }

        // Force bypass cache if specified
        if (options.bypassCache || force) {
          headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
          headers["Pragma"] = "no-cache"
          delete headers["If-None-Match"]
        } else if (lastEtag && !force) {
          headers["If-None-Match"] = lastEtag
        }

        let queryParams = `?page=${page}&limit=${limit}`
        if (filterStatus === "available") {
          queryParams += "&used=false"
        } else if (filterStatus === "pending") {
          queryParams += "&used=true&processed=false"
        } else if (filterStatus === "processed") {
          queryParams += "&used=true&processed=true"
        }

        if (searchTerm) {
          queryParams += `&search=${encodeURIComponent(searchTerm)}`
        }

        // Add cache buster for force refresh
        if (options.bypassCache || force) {
          queryParams += `&_t=${Date.now()}`
        }

        const response = await api.get(`/api/admin/pins${queryParams}`, {
          headers,
          signal: abortControllerRef.current.signal,
          validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
          bypassCache: options.bypassCache || force,
        })

        if (!isMountedRef.current) {
          return
        }

        safeSetState(() => {
          setConnectionStatus("connected")
        })

        // Handle 304 Not Modified - but still update timestamp
        if (response.status === 304) {
          safeSetState(() => {
            setLastRefreshTime(now)
            setLoading(false)
          })
          return
        }

        // Save ETag only if not bypassing cache
        const newEtag = response.headers.etag
        if (newEtag && !options.bypassCache && !force) {
          setLastEtag(newEtag)
        } else {
          // Clear ETag for force refresh
          setLastEtag(null)
        }

        const responseData = response.data
        const pinsData = responseData?.pins || []

        safeSetState(() => {
          setPins(pinsData)
          setTotalPages(responseData?.totalPages || 1)
          setTotalItems(responseData?.total || 0)
          setCurrentPage(page)
          setDataLoaded(true)

          if (responseData?.stats) {
            setStats(responseData.stats)
            localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS, JSON.stringify(responseData.stats))
          }

          setError("")
          setSelectedPins([])
          setSelectAll(false)
          setRateLimitHit(false)
          setLastRefreshTime(now)
        })

        // Apply filters
        setTimeout(() => {
          if (isMountedRef.current) {
            applyFilters(pinsData)
          }
        }, 0)

        // Update cache
        localStorage.setItem(CACHE_KEYS.PIN_MANAGEMENT_DATA, JSON.stringify(pinsData))
        localStorage.setItem(CACHE_KEYS.PIN_MANAGEMENT_LAST_FETCH, now.toString())
      } catch (error) {
        if (!isMountedRef.current) {
          return
        }

        if (error.name === "AbortError") {
          return
        }

        safeSetState(() => {
          setConnectionStatus("error")

          if (error.response?.status === 401) {
            sessionStorage.removeItem("adminToken")
            setAuthError(true)
            router.push("/admin/login")
          } else if (error.response?.status === 429) {
            setRateLimitHit(true)
            addToast("Rate limit tercapai. Auto-refresh dihentikan sementara.", "warning")
          } else {
            setError("Gagal mengambil data PIN: " + (error.response?.data?.error || error.message))
          }
        })
      } finally {
        requestInProgressRef.current = false
        safeSetState(() => {
          setLoading(false)
        })
      }
    },
    [
      checkAuth,
      lastRefreshTime,
      lastEtag,
      filterStatus,
      searchTerm,
      router,
      safeSetState,
      applyFilters,
      addToast,
      status,
    ],
  )

  // Improved generate PINs with immediate UI update
  const handleGeneratePins = useCallback(
    async (e) => {
      e.preventDefault()

      if (status !== "authenticated") {
        addToast("Sesi belum siap, silakan tunggu...", "warning")
        return
      }

      if (!pinCount || pinCount <= 0 || pinCount > 1000) {
        addToast("Jumlah PIN harus antara 1-1000", "error")
        return
      }

      if (pinPrefix && !/^[A-Z0-9]*$/.test(pinPrefix)) {
        addToast("Prefix hanya boleh mengandung huruf kapital dan angka", "error")
        return
      }

      setGenerating(true)
      setError("")

      try {
        const token = checkAuth()
        if (!token) return

        // Immediately update stats optimistically
        updateStatsImmediately("generate", pinCount)

        const response = await api.post(
          `/api/admin/pins`,
          { count: Number.parseInt(pinCount), prefix: pinPrefix },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          },
        )

        if (isMountedRef.current) {
          addToast(`Berhasil generate ${response.data.count} PIN baru`, "success")

          // Clear all caches and force refresh
          invalidateAllCaches()

          // Multiple refresh strategy for immediate update
          const refreshSequence = async () => {
            // Immediate refresh
            await forceRefreshData(fetchPins, 1, itemsPerPage)

            // Follow-up refreshes to ensure consistency
            for (let i = 0; i < 2; i++) {
              await new Promise((resolve) => setTimeout(resolve, 1000))
              if (isMountedRef.current) {
                await forceRefreshData(fetchPins, 1, itemsPerPage)
              }
            }
          }

          refreshSequence()
          setPinCount(10)
          setPinPrefix("")
        }
      } catch (error) {
        if (isMountedRef.current) {
          // Revert optimistic update on error
          updateStatsImmediately("delete", pinCount)
          addToast("Gagal generate PIN: " + (error.response?.data?.error || error.message), "error")
        }
      } finally {
        if (isMountedRef.current) {
          setGenerating(false)
        }
      }
    },
    [pinCount, pinPrefix, checkAuth, fetchPins, itemsPerPage, addToast, updateStatsImmediately, status],
  )

  // Improved delete with immediate UI update
  const handleDeletePin = useCallback(async () => {
    if (!pinToDelete) return

    if (status !== "authenticated") {
      addToast("Sesi belum siap, silakan tunggu...", "warning")
      return
    }

    try {
      const token = checkAuth()
      if (!token) return

      // Optimistic update
      const updatedPins = pins.filter((p) => p._id !== pinToDelete._id)
      setPins(updatedPins)
      applyFilters(updatedPins)
      updateStatsImmediately("delete", 1)

      await api.delete(`/api/admin/pins/${pinToDelete._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })

      if (isMountedRef.current) {
        setShowDeleteModal(false)
        setPinToDelete(null)
        addToast("PIN berhasil dihapus", "success")

        // Force refresh to ensure consistency
        invalidateAllCaches()
        await forceRefreshData(fetchPins, currentPage, itemsPerPage)
      }
    } catch (error) {
      if (isMountedRef.current) {
        addToast("Gagal menghapus PIN: " + (error.response?.data?.error || error.message), "error")
        setShowDeleteModal(false)
        // Revert optimistic update and refresh
        await forceRefreshData(fetchPins, currentPage, itemsPerPage)
      }
    }
  }, [
    pinToDelete,
    checkAuth,
    pins,
    applyFilters,
    fetchPins,
    currentPage,
    itemsPerPage,
    addToast,
    updateStatsImmediately,
    status,
  ])

  // Improved delete multiple with immediate UI update
  const handleDeleteMultiplePins = useCallback(async () => {
    if (selectedPins.length === 0) return

    if (status !== "authenticated") {
      addToast("Sesi belum siap, silakan tunggu...", "warning")
      return
    }

    setDeletingMultiple(true)
    try {
      const token = checkAuth()
      if (!token) return

      // Optimistic update
      const updatedPins = pins.filter((p) => !selectedPins.includes(p._id))
      setPins(updatedPins)
      applyFilters(updatedPins)
      updateStatsImmediately("delete", selectedPins.length)

      const response = await api.post(
        `/api/admin/pins/delete-pins`,
        { pinIds: selectedPins },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        },
      )

      if (isMountedRef.current) {
        setShowDeleteMultipleModal(false)
        setSelectedPins([])
        setSelectAll(false)
        addToast(response.data.message || `${selectedPins.length} PIN berhasil dihapus`, "success")

        // Force refresh to ensure consistency
        invalidateAllCaches()
        await forceRefreshData(fetchPins, currentPage, itemsPerPage)
      }
    } catch (error) {
      if (isMountedRef.current) {
        addToast(error.response?.data?.error || "Terjadi kesalahan dalam penghapusan", "error")
        // Revert optimistic update and refresh
        await forceRefreshData(fetchPins, currentPage, itemsPerPage)
      }
    } finally {
      if (isMountedRef.current) {
        setDeletingMultiple(false)
        setShowDeleteMultipleModal(false)
      }
    }
  }, [
    selectedPins,
    checkAuth,
    pins,
    applyFilters,
    fetchPins,
    currentPage,
    itemsPerPage,
    addToast,
    updateStatsImmediately,
    status,
  ])

  // Improved mark as processed with immediate UI update
  const handleMarkAsProcessed = useCallback(async () => {
    if (!pinToProcess) return

    if (status !== "authenticated") {
      addToast("Sesi belum siap, silakan tunggu...", "warning")
      return
    }

    setProcessing(true)
    try {
      // Optimistic update
      const updatedPins = pins.map((p) => {
        if (p._id === pinToProcess._id) {
          return { ...p, processed: true }
        }
        return p
      })

      if (isMountedRef.current) {
        setPins(updatedPins)
        applyFilters(updatedPins)
        updateStatsImmediately("process", 1)
      }

      const token = checkAuth()
      if (!token) return

      await api.patch(
        `/api/admin/pins/${pinToProcess._id}`,
        { processed: true },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        },
      )

      if (isMountedRef.current) {
        setShowProcessModal(false)
        setPinToProcess(null)
        addToast("PIN berhasil ditandai sebagai diproses", "success")

        // Force refresh to ensure consistency
        invalidateAllCaches()
        await forceRefreshData(fetchPins, currentPage, itemsPerPage)

        // Broadcast event untuk komponen lain
        window.dispatchEvent(new CustomEvent("pin-status-changed"))
      }
    } catch (error) {
      if (isMountedRef.current) {
        addToast("Gagal memproses PIN: " + (error.response?.data?.error || error.message), "error")
        setShowProcessModal(false)
        // Revert optimistic update and refresh
        await forceRefreshData(fetchPins, currentPage, itemsPerPage)
      }
    } finally {
      if (isMountedRef.current) {
        setProcessing(false)
      }
    }
  }, [
    pinToProcess,
    pins,
    applyFilters,
    checkAuth,
    fetchPins,
    currentPage,
    itemsPerPage,
    addToast,
    updateStatsImmediately,
    status,
  ])

  // Enhanced manual refresh
  const handleRefresh = useCallback(() => {
    invalidateAllCaches()
    forceRefreshData(fetchPins, currentPage, itemsPerPage)
    addToast("Data berhasil diperbarui", "success")
  }, [fetchPins, currentPage, itemsPerPage, addToast])

  // Improved polling with better error handling
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    const poll = () => {
      if (isMountedRef.current && !rateLimitHit && !requestInProgressRef.current) {
        // Use regular fetch for polling, not force refresh
        fetchPins(currentPage, itemsPerPage, false)
      }
    }

    pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL)
    setPollingActive(true)
  }, [fetchPins, currentPage, itemsPerPage, rateLimitHit])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setPollingActive(false)
  }, [])

  const togglePolling = useCallback(() => {
    if (pollingActive) {
      stopPolling()
      addToast("Auto-refresh dimatikan", "info")
    } else {
      startPolling()
      addToast("Auto-refresh diaktifkan", "success")
    }
  }, [pollingActive, startPolling, stopPolling, addToast])

  // Debounced search
  const handleSearchChange = useCallback(
    (value) => {
      setSearchTerm(value)
      setSearchLoading(true)

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }

      searchTimeoutRef.current = setTimeout(() => {
        setSearchLoading(false)
        if (dataLoaded && isMountedRef.current) {
          setCurrentPage(1)
          fetchPins(1, itemsPerPage)
        }
      }, 500)
    },
    [fetchPins, itemsPerPage, dataLoaded],
  )

  // Initialize component
  useEffect(() => {
    isMountedRef.current = true
    setIsClient(true)

    if (status === "loading") {
      return
    }

    const token = checkAuth()
    if (!token) {
      return
    }

    const loadData = async () => {
      try {
        await forceRefreshData(fetchPins, 1, 100)
        setTimeout(() => {
          if (isMountedRef.current && !rateLimitHit && status === "authenticated") {
            startPolling()
          }
        }, 2000)
      } catch (error) {
        console.error("Initial load failed:", error)
      }
    }

    const timer = setTimeout(loadData, 100)

    // Listen untuk update dari komponen lain
    const handlePinUpdate = () => {
      if (isMountedRef.current) {
        forceRefreshData(fetchPins, currentPage, itemsPerPage)
      }
    }

    window.addEventListener("pin-status-changed", handlePinUpdate)
    window.addEventListener("pin-redeemed", handlePinUpdate)

    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      stopPolling()
      clearTimeout(timer)
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      window.removeEventListener("pin-status-changed", handlePinUpdate)
      window.removeEventListener("pin-redeemed", handlePinUpdate)
    }
  }, [status])

  // Handle filter/search changes
  useEffect(() => {
    if (pins.length > 0 && isMountedRef.current) {
      applyFilters(pins)
    }
  }, [filterStatus, searchTerm, pins, applyFilters])

  // Page change
  const handlePageChange = useCallback(
    (page) => {
      setCurrentPage(page)
      fetchPins(page, itemsPerPage)
    },
    [fetchPins, itemsPerPage],
  )

  // Items per page change
  const handleItemsPerPageChange = useCallback(
    (e) => {
      const newItemsPerPage = Number.parseInt(e.target.value, 10)
      setItemsPerPage(newItemsPerPage)
      setCurrentPage(1)
      fetchPins(1, newItemsPerPage)
    },
    [fetchPins],
  )

  // Enhanced file validation
  const validateFile = useCallback((file) => {
    if (!file) {
      setImportError("Pilih file terlebih dahulu")
      return false
    }

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setImportError("Hanya file CSV yang diperbolehkan")
      return false
    }

    if (file.size > MAX_FILE_SIZE) {
      setImportError("Ukuran file maksimal 5MB")
      return false
    }

    return true
  }, [])

  // File select for import
  const handleFileSelect = useCallback(
    (file) => {
      setImportError("")
      setImportSuccess("")
      setImportPreview([])

      if (!validateFile(file)) return

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: ",", // Explicit comma delimiter untuk mengatasi auto-detect error pada UTF-8 CSV
        complete: (results) => {
          if (results.errors.length > 0) {
            setImportError("Error parsing CSV: " + results.errors[0].message)
            return
          }

          if (!results.meta.fields.includes("PIN Code")) {
            setImportError("File CSV harus memiliki kolom 'PIN Code'")
            return
          }

          const validData = results.data.filter((row) => row["PIN Code"] && row["PIN Code"].trim())
          if (validData.length === 0) {
            setImportError("Tidak ada data PIN yang valid ditemukan")
            return
          }

          setImportPreview(validData.slice(0, 5))
          addToast(`File berhasil divalidasi. Ditemukan ${validData.length} PIN`, "success")
        },
        error: (error) => {
          setImportError("Error parsing CSV: " + error.message)
        },
      })
    },
    [validateFile, addToast],
  )


  // Import CSV with immediate UI update
  const handleImportCSV = useCallback(
    async (file) => {
      if (!validateFile(file)) return

      if (status !== "authenticated") {
        addToast("Sesi belum siap, silakan tunggu...", "warning")
        return
      }

      setIsImporting(true)
      setImportError("")
      setImportSuccess("")

      try {
        const token = checkAuth()
        if (!token) return

        const formData = new FormData()
        formData.append("file", file)

        const response = await api.post(`/api/admin/pins/import-pins`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        })

        if (isMountedRef.current) {
          const imported = response.data.imported || 0
          addToast(`Berhasil import ${imported} PIN`, "success")
          setImportPreview([])

          // Immediately update stats
          updateStatsImmediately("generate", imported)

          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }

          // Force refresh data
          invalidateAllCaches()
          await forceRefreshData(fetchPins, 1, itemsPerPage)
        }
      } catch (error) {
        if (isMountedRef.current) {
          addToast("Gagal import PIN: " + (error.response?.data?.error || error.message), "error")
        }
      } finally {
        if (isMountedRef.current) {
          setIsImporting(false)
        }
      }
    },
    [validateFile, checkAuth, fetchPins, itemsPerPage, addToast, updateStatsImmediately, status],
  )

  // Select all pins
  const handleSelectAll = useCallback(
    (e) => {
      const isChecked = e.target.checked
      setSelectAll(isChecked)
      if (isChecked) {
        const availablePinIds = filteredPins.filter((pin) => !pin.used).map((pin) => pin._id)
        setSelectedPins(availablePinIds)
      } else {
        setSelectedPins([])
      }
    },
    [filteredPins],
  )

  // Select individual pin
  const handleSelectPin = useCallback((pinId, isChecked) => {
    if (isChecked) {
      setSelectedPins((prev) => [...prev, pinId])
    } else {
      setSelectedPins((prev) => prev.filter((id) => id !== pinId))
      setSelectAll(false)
    }
  }, [])

  // Enhanced export with better formatting
  const handleExportCSV = useCallback(() => {
    const csvContent = [
      ["PIN Code", "Status", "Redeemed By", "ID Game", "Redeemed At", "Processed", "Created At"],
      ...pins.map((pin) => [
        pin.code,
        pin.used ? (pin.processed ? "Processed" : "Pending") : "Available",
        pin.redeemedBy?.nama || "",
        pin.redeemedBy?.idGame || "",
        pin.redeemedBy?.redeemedAt ? new Date(pin.redeemedBy.redeemedAt).toLocaleString("id-ID") : "",
        pin.processed ? "Yes" : pin.used ? "No" : "-",
        pin.createdAt ? new Date(pin.createdAt).toLocaleString("id-ID") : "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pin-codes-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    addToast(`Export berhasil! ${pins.length} PIN telah diunduh`, "success")
  }, [pins, addToast])

  // File input change
  const handleFileInputChange = (e) => {
    const file = e.target.files[0]
    handleFileSelect(file)
  }

  // Import button click
  const handleImportButtonClick = () => {
    if (fileInputRef.current?.files[0]) {
      handleImportCSV(fileInputRef.current.files[0])
    } else {
      addToast("Pilih file CSV terlebih dahulu", "warning")
    }
  }

  // Memoized stats cards
  const statsCards = useMemo(
    () => [
      {
        title: "Total PIN",
        value: stats.total,
        variant: "primary",
        icon: FaEye,
      },
      {
        title: "PIN Tersedia",
        value: stats.available,
        variant: "success",
        icon: FaCheckCircle,
      },
      {
        title: "PIN Pending",
        value: stats.pending,
        variant: "warning",
        icon: FaClock,
      },
      {
        title: "PIN Diproses",
        value: stats.processed,
        variant: "danger",
        icon: FaTimesCircle,
      },
    ],
    [stats],
  )

  // Connection status indicator
  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return <Badge bg="success">Terhubung</Badge>
      case "connecting":
        return <Badge bg="warning">Menghubungkan...</Badge>
      case "error":
        return <Badge bg="danger">Error</Badge>
      default:
        return <Badge bg="secondary">Unknown</Badge>
    }
  }

  // Render pagination
  const renderPagination = () => {
    if (totalPages <= 1) return null

    const items = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    // Previous
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

    // Next
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
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </Form.Select>
          <span className="ms-3">
            Showing {filteredPins.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{" "}
            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
          </span>
        </div>
        <Pagination size="sm" className="mb-0">
          {items}
        </Pagination>
      </div>
    )
  }

  // Show loading while session is loading
  if (status === "loading") {
    return (
      <div className="adminpanelmanajemenpinpage">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3">Memuat sesi...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show loading while not client-side
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

  // Show auth error
  if (authError) {
    return (
      <div className="adminpanelmanajemenpinpage">
        <div className="container mt-5">
          <Alert variant="danger" className="text-center">
            <FaExclamationTriangle size={48} className="mb-3" />
            <h4>Sesi Login Berakhir</h4>
            <p>Anda akan dialihkan ke halaman login...</p>
          </Alert>
        </div>
      </div>
    )
  }

  // Show loading while data hasn't loaded
  if (!dataLoaded) {
    return (
      <div className="adminpanelmanajemenpinpage">
        <h1 className="mb-4">Manajemen PIN</h1>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="text-center">
            <Spinner animation="border" variant="primary" size="lg" />
            <p className="mt-3">Memuat data PIN...</p>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => forceRefreshData(fetchPins, 1, itemsPerPage)}
              disabled={loading}
              className="mt-2"
            >
              {loading ? "Memuat ulang..." : "Muat Ulang Data"}
            </Button>
            {error && (
              <Alert variant="danger" className="mt-3">
                <FaExclamationTriangle className="me-2" />
                {error}
              </Alert>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="adminpanelmanajemenpinpage">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Manajemen PIN</h1>
        <div className="d-flex align-items-center gap-2">
          {getConnectionStatusBadge()}
          <small className="text-muted">
            Update: {lastRefreshTime > 0 ? new Date(lastRefreshTime).toLocaleTimeString("id-ID") : "-"}
          </small>
        </div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")} className="mb-4">
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}

      {rateLimitHit && (
        <Alert variant="warning" className="mb-4">
          <strong>Rate Limit Tercapai!</strong> Auto-refresh telah dihentikan untuk mencegah spam request.
          <Button variant="link" size="sm" onClick={() => setRateLimitHit(false)} className="ms-2">
            Reset
          </Button>
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
              eventKey="generate"
              title={
                <>
                  <FaPlus className="me-2" />
                  Generate PIN
                </>
              }
            >
              <div className="p-3">
                <Form onSubmit={handleGeneratePins}>
                  <Row>
                    <Col md={5}>
                      <Form.Group className="mb-3">
                        <Form.Label>Jumlah PIN</Form.Label>
                        <Form.Control
                          type="number"
                          value={pinCount}
                          onChange={(e) => setPinCount(Number.parseInt(e.target.value) || "")}
                          min="1"
                          max="1000"
                          placeholder="Masukkan jumlah PIN"
                          disabled={status !== "authenticated"}
                        />
                        <Form.Text muted>Masukkan jumlah PIN yang ingin digenerate (maksimal 1000)</Form.Text>
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
                          disabled={status !== "authenticated"}
                        />
                        <Form.Text muted>Awalan untuk PIN (maksimal 5 karakter, huruf kapital dan angka)</Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={2} className="d-flex align-items-end">
                      <Button
                        type="submit"
                        variant="primary"
                        className="generate d-flex align-items-center justify-content-center"
                        disabled={generating || status !== "authenticated"}
                      >
                        {generating ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <FaPlus className="me-2" /> Generate
                          </>
                        )}
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </div>
            </Tab>
            <Tab
              eventKey="import"
              title={
                <>
                  <FaFileUpload className="me-2" />
                  Import CSV
                </>
              }
            >
              <div className="p-3">
                {importError && (
                  <Alert variant="danger" dismissible onClose={() => setImportError("")}>
                    <FaExclamationTriangle className="me-2" />
                    {importError}
                  </Alert>
                )}
                {importSuccess && (
                  <Alert variant="success" dismissible onClose={() => setImportSuccess("")}>
                    <FaCheck className="me-2" />
                    {importSuccess}
                  </Alert>
                )}

                <Form.Group className="mb-3">
                  <Form.Label>Upload File CSV</Form.Label>
                  <Form.Control
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    className="form-control-lg"
                    disabled={status !== "authenticated"}
                  />
                  <Form.Text muted>File CSV harus memiliki kolom 'PIN Code'. Maksimal ukuran file: 5MB</Form.Text>
                </Form.Group>

                {importPreview.length > 0 && (
                  <div className="mb-3">
                    <h6 className="text-success">
                      <FaCheck className="me-2" />
                      Preview Data (Menampilkan 5 dari {importPreview.length} data):
                    </h6>
                    <div className="table-responsive">
                      <Table striped bordered hover size="sm">
                        <thead className="table-dark">
                          <tr>
                            {Object.keys(importPreview[0]).map((key) => (
                              <th key={key}>{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.slice(0, 5).map((row, index) => (
                            <tr key={index}>
                              {Object.values(row).map((value, i) => (
                                <td key={i}>{value}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                )}

                <Button
                  variant="success"
                  onClick={handleImportButtonClick}
                  disabled={isImporting || importPreview.length === 0 || status !== "authenticated"}
                  size="lg"
                >
                  {isImporting ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FaFileUpload className="me-2" /> Import PIN
                    </>
                  )}
                </Button>
              </div>
            </Tab>
          </Tabs>
        </Card.Header>
      </Card>

      {/* PIN List */}
      <Card className="shadow-sm">
        <Card.Header className="bg-light">
          <div className="d-flex justify-content-between align-items-center">
            <span className="fw-bold">Daftar PIN</span>
            <div className="d-flex gap-2">
              {selectedPins.length > 0 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDeleteMultipleModal(true)}
                  disabled={deletingMultiple || status !== "authenticated"}
                >
                  <FaTrash className="me-1" />
                  {deletingMultiple ? "Menghapus..." : `Hapus (${selectedPins.length})`}
                </Button>
              )}
              <Button
                variant={pollingActive && !rateLimitHit ? "success" : "outline-secondary"}
                size="sm"
                onClick={togglePolling}
                disabled={rateLimitHit || status !== "authenticated"}
              >
                {pollingActive ? (
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
              <Button
                variant="outline-primary"
                size="sm"
                onClick={handleRefresh}
                disabled={loading || status !== "authenticated"}
              >
                <FaSync className={`me-1 ${loading ? "fa-spin" : ""}`} />
                {loading ? "Memuat..." : "Refresh"}
              </Button>
              <Button
                variant="outline-success"
                size="sm"
                onClick={handleExportCSV}
                disabled={status !== "authenticated"}
              >
                <FaFileDownload className="me-1" /> Export CSV
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
                  placeholder="Cari PIN, nama, atau ID game..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  disabled={status !== "authenticated"}
                />
                {searchLoading && (
                  <InputGroup.Text>
                    <Spinner animation="border" size="sm" />
                  </InputGroup.Text>
                )}
                {searchTerm && (
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
                    <FaFilter className="filterpinmanajemen me-1" />
                    {filterStatus === "all" && "Semua PIN"}
                    {filterStatus === "available" && "PIN Tersedia"}
                    {filterStatus === "pending" && "PIN Pending"}
                    {filterStatus === "processed" && "PIN Diproses"}
                  </>
                }
                variant="outline-secondary"
                disabled={status !== "authenticated"}
              >
                <Dropdown.Item active={filterStatus === "all"} onClick={() => setFilterStatus("all")}>
                  <FaEye className="me-2" />
                  Semua PIN
                </Dropdown.Item>
                <Dropdown.Item active={filterStatus === "available"} onClick={() => setFilterStatus("available")}>
                  <FaCheckCircle className="me-2 text-success" />
                  PIN Tersedia
                </Dropdown.Item>
                <Dropdown.Item active={filterStatus === "pending"} onClick={() => setFilterStatus("pending")}>
                  <FaClock className="me-2 text-warning" />
                  PIN Pending
                </Dropdown.Item>
                <Dropdown.Item active={filterStatus === "processed"} onClick={() => setFilterStatus("processed")}>
                  <FaTimesCircle className="me-2 text-danger" />
                  PIN Diproses
                </Dropdown.Item>
              </DropdownButton>
            </Col>
          </Row>

          {/* Table */}
          <div className="table-responsive" style={{ maxHeight: "500px", overflowY: "auto" }}>
            <Table striped bordered hover responsive className="mb-0">
              <thead className="table-dark sticky-top">
                <tr>
                  <th style={{ width: "50px" }}>
                    <Form.Check
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      disabled={
                        loading || filteredPins.filter((pin) => !pin.used).length === 0 || status !== "authenticated"
                      }
                    />
                  </th>
                  <th>PIN Code</th>
                  <th>Status</th>
                  <th>Digunakan Oleh</th>
                  <th>ID Game</th>
                  <th>Waktu Redeem</th>
                  <th style={{ width: "100px" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading && filteredPins.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : filteredPins.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
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
                            disabled={status !== "authenticated"}
                          />
                        )}
                      </td>
                      <td>
                        <code className="bg-light px-2 py-1 rounded">{pin.code}</code>
                      </td>
                      <td>
                        {pin.used ? (
                          pin.processed ? (
                            <Badge bg="danger" className="d-flex align-items-center">
                              <FaTimesCircle className="me-1" />
                              Terpakai & Diproses
                            </Badge>
                          ) : (
                            <Badge bg="warning" className="d-flex align-items-center">
                              <FaClock className="me-1" />
                              Pending
                            </Badge>
                          )
                        ) : (
                          <Badge bg="success" className="d-flex align-items-center">
                            <FaCheckCircle className="me-1" />
                            Tersedia
                          </Badge>
                        )}
                      </td>
                      <td>{pin.redeemedBy?.nama || "-"}</td>
                      <td>{pin.redeemedBy?.idGame || "-"}</td>
                      <td>
                        {pin.redeemedBy?.redeemedAt ? new Date(pin.redeemedBy.redeemedAt).toLocaleString("id-ID") : "-"}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          {!pin.used && (
                            <OverlayTrigger placement="top" overlay={<Tooltip>Hapus PIN</Tooltip>}>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => {
                                  setPinToDelete(pin)
                                  setShowDeleteModal(true)
                                }}
                                disabled={status !== "authenticated"}
                              >
                                <FaTrash />
                              </Button>
                            </OverlayTrigger>
                          )}
                          {pin.used && !pin.processed && (
                            <OverlayTrigger placement="top" overlay={<Tooltip>Tandai sebagai diproses</Tooltip>}>
                              <Button
                                variant="outline-success"
                                size="sm"
                                onClick={() => {
                                  setPinToProcess(pin)
                                  setShowProcessModal(true)
                                }}
                                disabled={status !== "authenticated"}
                              >
                                <FaCheck />
                              </Button>
                            </OverlayTrigger>
                          )}
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
              Menampilkan {filteredPins.length.toLocaleString("id-ID")} dari {totalItems.toLocaleString("id-ID")} PIN
            </div>
            {pollingActive && !rateLimitHit && status === "authenticated" && (
              <Badge bg="success" className="d-flex align-items-center">
                <FaWifi className="me-1" />
                Auto-refresh aktif
              </Badge>
            )}
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
            Apakah Anda yakin ingin menghapus PIN <strong className="text-danger">{pinToDelete?.code}</strong>?
          </p>
          <Alert variant="warning" className="mb-0">
            <FaExclamationTriangle className="me-2" />
            Tindakan ini tidak dapat dibatalkan.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleDeletePin}>
            <FaTrash className="me-2" />
            Hapus
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Multiple Modal */}
      <Modal
        show={showDeleteMultipleModal}
        onHide={() => !deletingMultiple && setShowDeleteMultipleModal(false)}
        centered
      >
        <Modal.Header closeButton={!deletingMultiple}>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" /> Konfirmasi Hapus Multiple PIN
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menghapus <strong className="text-danger">{selectedPins.length}</strong> PIN yang
            dipilih?
          </p>
          <Alert variant="warning" className="mb-0">
            <FaExclamationTriangle className="me-2" />
            Tindakan ini tidak dapat dibatalkan.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteMultipleModal(false)} disabled={deletingMultiple}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleDeleteMultiplePins} disabled={deletingMultiple}>
            {deletingMultiple ? (
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

      {/* Process Modal */}
      <Modal show={showProcessModal} onHide={() => !processing && setShowProcessModal(false)} centered>
        <Modal.Header closeButton={!processing}>
          <Modal.Title>
            <FaCheck className="me-2 text-success" /> Konfirmasi Proses PIN
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menandai PIN <strong className="text-success">{pinToProcess?.code}</strong> sebagai
            sudah diproses?
          </p>
          {pinToProcess && (
            <Card className="mt-3">
              <Card.Header className="bg-light">
                <strong>Detail Redemption:</strong>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col sm={4}>
                    <strong>Nama:</strong>
                  </Col>
                  <Col sm={8}>{pinToProcess.redeemedBy?.nama || "-"}</Col>
                </Row>
                <Row>
                  <Col sm={4}>
                    <strong>ID Game:</strong>
                  </Col>
                  <Col sm={8}>{pinToProcess.redeemedBy?.idGame || "-"}</Col>
                </Row>
                <Row>
                  <Col sm={4}>
                    <strong>Waktu Redeem:</strong>
                  </Col>
                  <Col sm={8}>
                    {pinToProcess.redeemedBy?.redeemedAt
                      ? new Date(pinToProcess.redeemedBy.redeemedAt).toLocaleString("id-ID")
                      : "-"}
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProcessModal(false)} disabled={processing}>
            Batal
          </Button>
          <Button variant="success" onClick={handleMarkAsProcessed} disabled={processing}>
            {processing ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Memproses...
              </>
            ) : (
              <>
                <FaCheck className="me-2" />
                Tandai Sebagai Diproses
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default PinManagement
