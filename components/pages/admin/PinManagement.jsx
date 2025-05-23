"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
} from "react-bootstrap";
import { useRouter } from "next/navigation";
import axios from "axios";
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
} from "react-icons/fa";
import Papa from "papaparse";
import {
  CACHE_KEYS,
  invalidateAllCaches,
  updatePendingCountInCaches,
} from "@/lib/utils/cache-utils";
import "@/styles/adminstyles.css";

// Buat instance axios dengan konfigurasi default
const api = axios.create({
  timeout: 15000, // 15 seconds timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Fungsi untuk membatalkan request dengan aman
function safeAbort(controller) {
  try {
    if (controller) controller.abort();
  } catch (e) {
    console.warn("AbortController error:", e.message);
  }
}

// Custom hook for managing PIN data
function usePinManagement() {
  // State for pins data
  const [pins, setPins] = useState([]);
  const [filteredPins, setFilteredPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pinCount, setPinCount] = useState(10);
  const [pinPrefix, setPinPrefix] = useState("");
  const [generating, setGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [activeTab, setActiveTab] = useState("generate");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [importPreview, setImportPreview] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [dataFetchAttempted, setDataFetchAttempted] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    used: 0,
    available: 0,
    pending: 0,
    processed: 0,
  });

  // State for selection and modals
  const [selectedPins, setSelectedPins] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pinToDelete, setPinToDelete] = useState(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [pinToProcess, setPinToProcess] = useState(null);
  const [processing, setProcessing] = useState(false);

  // State for filtering and search
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDebounceTimeout, setSearchDebounceTimeout] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [totalItems, setTotalItems] = useState(0);

  // State for refresh control
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [rateLimitHit, setRateLimitHit] = useState(false);

  // Refs for request management
  const abortControllerRef = useRef(null);
  const timeoutRef = useRef(null);
  const refreshTimeoutRef = useRef(null);
  const requestInProgressRef = useRef(false);
  const isMounted = useRef(true);

  // Constants
  const MIN_REFRESH_INTERVAL = 5000; // 5 seconds minimum between refreshes

  // Router
  const router = useRouter();

  // Cleanup function untuk semua timers dan controllers
  const cleanupAllTimers = useCallback(() => {
    // Clear timeouts
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
    }

    // Abort any in-flight requests
    safeAbort(abortControllerRef.current);
    abortControllerRef.current = null;
  }, [searchDebounceTimeout]);

  // Check authentication and get token
  const checkAuthAndGetToken = useCallback(() => {
    const token =
      typeof window !== "undefined"
        ? sessionStorage.getItem("adminToken")
        : null;
    if (!token) {
      return null;
    }
    return token;
  }, []);

  const applyFilters = useCallback((pinsData) => {
    console.log("Tampilkan semua PIN tanpa filter");
    setFilteredPins(pinsData);
  }, []);

  // Function to fetch pins with pagination
  const fetchPins = useCallback(
    async (page = currentPage, limit = itemsPerPage, force = false) => {
      console.log("fetchPins dipanggil");
      if (typeof window === "undefined") return;

      const token = checkAuthAndGetToken();
      if (!token) {
        router.push("/admin/login");
        return;
      }

      // Check if we should throttle requests
      const now = Date.now();
      if (
        !force &&
        lastRefreshTime &&
        now - lastRefreshTime < MIN_REFRESH_INTERVAL
      ) {
        console.log("Throttling refresh request");
        return;
      }

      // Prevent concurrent requests
      if (requestInProgressRef.current) {
        console.log("Request already in progress, skipping");
        return;
      }

      requestInProgressRef.current = true;
      setLoading(true);
      setError("");
      setDataFetchAttempted(true);
      setLastRefreshTime(now);

      // Cancel any existing request
      safeAbort(abortControllerRef.current);
      abortControllerRef.current = new AbortController();

      try {
        // Set a timeout for the request (15 seconds)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          if (abortControllerRef.current && isMounted.current) {
            abortControllerRef.current.abort();
          }
        }, 15000);

        // Build query parameters for filtering
        let queryParams = `?page=${page}&limit=${limit}`;
        if (filterStatus === "available") {
          queryParams += "&used=false";
        } else if (filterStatus === "pending") {
          queryParams += "&used=true&processed=false";
        } else if (filterStatus === "processed") {
          queryParams += "&used=true&processed=true";
        }

        if (searchTerm) {
          queryParams += `&search=${encodeURIComponent(searchTerm)}`;
        }

        const response = await api.get(`/api/admin/pins${queryParams}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: abortControllerRef.current.signal,
        });
        console.log("Data dari API:", response.data);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Only update state if component is still mounted
        if (!isMounted.current) return;

        // Reset error count on successful request
        setConsecutiveErrors(0);
        setRateLimitHit(false);

        setPins(response.data.pins || []);
        setTotalPages(response.data.totalPages || 1);
        setTotalItems(response.data.total || 0);

        // Update stats if available in response
        if (response.data.stats) {
          setStats(response.data.stats);

          // Cache the stats for other components to use
          localStorage.setItem(
            CACHE_KEYS.DASHBOARD_STATS,
            JSON.stringify(response.data.stats)
          );
          localStorage.setItem(
            CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH,
            Date.now().toString()
          );
        } else {
          // Calculate stats from pins data
          const total = response.data.total || response.data.pins?.length || 0;
          const used =
            response.data.pins?.filter((pin) => pin.used).length || 0;
          const pending =
            response.data.pins?.filter((pin) => pin.used && !pin.processed)
              .length || 0;
          const processed =
            response.data.pins?.filter((pin) => pin.used && pin.processed)
              .length || 0;

          const calculatedStats = {
            total,
            used,
            available: total - used,
            pending,
            processed,
          };

          setStats(calculatedStats);

          // Cache the calculated stats
          localStorage.setItem(
            CACHE_KEYS.DASHBOARD_STATS,
            JSON.stringify(calculatedStats)
          );
          localStorage.setItem(
            CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH,
            Date.now().toString()
          );
        }

        // Apply filters to the fetched data
        applyFilters(response.data.pins || [], filterStatus, searchTerm);

        console.log("Fetch pins selesai, setting initialLoadDone = true");
        setInitialLoadDone(true);
        setLoading(false);
        setIsRefreshing(false);
      } catch (error) {
        if (!isMounted.current) return;

        if (
          error.name === "AbortError" ||
          error.message === "canceled" ||
          error.name === "CanceledError"
        ) {
          console.log(
            "Fetch dibatalkan karena timeout atau perubahan halaman."
          );
        } else {
          console.error("Error fetching pins:", error);

          if (error.response?.status === 401) {
            sessionStorage.removeItem("adminToken");
            router.push("/admin/login");
          } else if (error.response?.status === 429) {
            setRateLimitHit(true);
            setConsecutiveErrors((prev) => prev + 1);
            setError(
              "Terlalu banyak permintaan ke server. Coba lagi dalam beberapa menit."
            );
          } else {
            setConsecutiveErrors((prev) => prev + 1);
            setError(
              "Gagal mengambil data PIN: " +
                (error.response?.data?.error || "Terjadi kesalahan")
            );
          }
        }

        setLoading(false);
        setIsRefreshing(false);
        setInitialLoadDone(true); // Mark as done even if there was an error
      } finally {
        requestInProgressRef.current = false;

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    },
    [
      applyFilters,
      checkAuthAndGetToken,
      currentPage,
      filterStatus,
      itemsPerPage,
      lastRefreshTime,
      router,
      searchTerm,
    ]
  );

  // Function to refresh data manually with debounce
  const handleRefresh = useCallback(() => {
    if (
      typeof window === "undefined" ||
      isRefreshing ||
      requestInProgressRef.current
    )
      return;

    const now = Date.now();
    if (lastRefreshTime && now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
      const timeRemaining = Math.ceil(
        (lastRefreshTime + MIN_REFRESH_INTERVAL - now) / 1000
      );
      setError(
        `Untuk menghindari rate limit, tunggu ${timeRemaining} detik sebelum refresh data.`
      );
      return;
    }

    setIsRefreshing(true);
    setLoading(true);

    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Invalidate all caches to force refresh
    invalidateAllCaches();

    // Set a timeout to prevent rapid refreshes
    refreshTimeoutRef.current = setTimeout(() => {
      fetchPins(currentPage, itemsPerPage, true);
    }, 1000);
  }, [currentPage, fetchPins, isRefreshing, itemsPerPage, lastRefreshTime]);

  // Function to handle page changes
  const handlePageChange = useCallback(
    (page) => {
      setCurrentPage(page);
      fetchPins(page, itemsPerPage);
    },
    [fetchPins, itemsPerPage]
  );

  // Function to handle items per page changes
  const handleItemsPerPageChange = useCallback(
    (e) => {
      const newItemsPerPage = Number.parseInt(e.target.value, 10);
      setItemsPerPage(newItemsPerPage);
      setCurrentPage(1); // Reset to first page
      fetchPins(1, newItemsPerPage);
    },
    [fetchPins]
  );

  // Function to generate PINs
  const handleGeneratePins = useCallback(
    async (e) => {
      e.preventDefault();
      if (typeof window === "undefined") return;

      setError("");
      setSuccessMessage("");

      if (
        pinCount === "" ||
        isNaN(pinCount) ||
        pinCount <= 0 ||
        pinCount > 1000
      ) {
        setError("Jumlah PIN harus antara 1-1000");
        return;
      }

      setGenerating(true);
      try {
        const token = checkAuthAndGetToken();
        if (!token) {
          router.push("/admin/login");
          return;
        }

        // Create a new AbortController for this request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for PIN generation

        const response = await api.post(
          `/api/admin/pins`,
          { count: Number.parseInt(pinCount), prefix: pinPrefix },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        // Only update if component is still mounted
        if (!isMounted.current) return;

        setSuccessMessage(`Berhasil generate ${response.data.count} PIN baru`);

        // Invalidate all caches to force refresh
        invalidateAllCaches();

        // Broadcast event untuk memberi tahu komponen lain
        window.dispatchEvent(new CustomEvent("cache-invalidated"));

        // Refresh data after generate
        fetchPins(1, itemsPerPage, true); // Reset to first page after generating new PINs
      } catch (error) {
        console.error("Error generating pins:", error);

        if (!isMounted.current) return;

        if (
          error.name === "AbortError" ||
          error.message === "canceled" ||
          error.name === "CanceledError"
        ) {
          setError(
            "Permintaan timeout. Server mungkin sedang sibuk, coba lagi nanti."
          );
        } else if (error.response?.status === 429) {
          setError(
            "Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat."
          );
        } else {
          setError(
            "Gagal generate PIN. " + (error.response?.data?.error || "")
          );
        }
      } finally {
        if (isMounted.current) {
          setGenerating(false);
        }
      }
    },
    [checkAuthAndGetToken, fetchPins, itemsPerPage, pinCount, pinPrefix, router]
  );

  // Function to handle file select for import
  const handleFileSelect = useCallback((file) => {
    if (typeof window === "undefined") return;

    setImportError("");
    setImportSuccess("");
    setImportPreview([]);

    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setImportError("Hanya file CSV yang diperbolehkan");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setImportError("Error parsing CSV: " + results.errors[0].message);
          return;
        }

        // Validasi format
        const requiredColumn = "PIN Code";
        if (!results.meta.fields.includes(requiredColumn)) {
          setImportError(`File CSV harus memiliki kolom '${requiredColumn}'`);
          return;
        }

        // Preview data
        setImportPreview(results.data.slice(0, 5));
      },
      error: (error) => {
        setImportError("Error parsing CSV: " + error.message);
      },
    });
  }, []);

  // Function to import PINs from CSV
  const handleImportCSV = useCallback(
    async (file) => {
      if (typeof window === "undefined" || !file) {
        setImportError("Pilih file CSV terlebih dahulu");
        return;
      }

      setIsImporting(true);
      setImportError("");
      setImportSuccess("");

      try {
        const token = checkAuthAndGetToken();
        if (!token) {
          router.push("/admin/login");
          return;
        }

        // Create a new AbortController for this request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for import

        const formData = new FormData();
        formData.append("file", file);

        const response = await api.post(`/api/admin/import-pins`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Only update if component is still mounted
        if (!isMounted.current) return;

        setImportSuccess(`Berhasil import ${response.data.imported} PIN`);
        setImportPreview([]);

        // Invalidate all caches to force refresh
        invalidateAllCaches();

        // Broadcast event untuk memberi tahu komponen lain
        window.dispatchEvent(new CustomEvent("cache-invalidated"));

        // Refresh data after import
        fetchPins(1, itemsPerPage, true); // Reset to first page after importing

        return response;
      } catch (error) {
        console.error("Error importing pins:", error);

        if (!isMounted.current) return;

        if (
          error.name === "AbortError" ||
          error.message === "canceled" ||
          error.name === "CanceledError"
        ) {
          setImportError(
            "Permintaan timeout. Server mungkin sedang sibuk, coba lagi nanti."
          );
        } else if (error.response?.status === 429) {
          setImportError(
            "Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat."
          );
        } else {
          setImportError(
            "Gagal import PIN: " +
              (error.response?.data?.error || "Terjadi kesalahan")
          );
        }
      } finally {
        if (isMounted.current) {
          setIsImporting(false);
        }
      }
    },
    [checkAuthAndGetToken, fetchPins, itemsPerPage, router]
  );

  // Function to handle delete PIN click
  const handleDeleteClick = useCallback((pin) => {
    if (typeof window === "undefined") return;
    setPinToDelete(pin);
    setShowDeleteModal(true);
  }, []);

  // Function to delete a PIN
  const handleDeletePin = useCallback(async () => {
    if (typeof window === "undefined" || !pinToDelete) return;

    try {
      const token = checkAuthAndGetToken();
      if (!token) {
        router.push("/admin/login");
        return;
      }

      // Create a new AbortController for this request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await api.delete(`/api/admin/pins/${pinToDelete._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Only update if component is still mounted
      if (!isMounted.current) return;

      // Tutup modal dan refresh data
      setShowDeleteModal(false);
      setPinToDelete(null);
      setSuccessMessage("PIN berhasil dihapus");

      // Invalidate all caches to force refresh
      invalidateAllCaches();

      // Broadcast event untuk memberi tahu komponen lain
      window.dispatchEvent(new CustomEvent("cache-invalidated"));

      fetchPins(currentPage, itemsPerPage, true); // Refresh data setelah hapus

      return response;
    } catch (error) {
      console.error("Error deleting pin:", error);

      if (!isMounted.current) return;

      if (
        error.name === "AbortError" ||
        error.message === "canceled" ||
        error.name === "CanceledError"
      ) {
        setError(
          "Permintaan timeout. Server mungkin sedang sibuk, coba lagi nanti."
        );
      } else if (error.response?.status === 429) {
        setError(
          "Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat."
        );
      } else {
        setError(
          "Gagal menghapus PIN: " +
            (error.response?.data?.error || "Terjadi kesalahan")
        );
      }
      setShowDeleteModal(false);
    }
  }, [
    checkAuthAndGetToken,
    currentPage,
    fetchPins,
    itemsPerPage,
    pinToDelete,
    router,
  ]);

  // Function to handle select all pins
  const handleSelectAll = useCallback(
    (e) => {
      if (typeof window === "undefined") return;

      const isChecked = e.target.checked;
      setSelectAll(isChecked);
      if (isChecked) {
        // Pilih semua PIN yang belum digunakan dari filtered pins
        const availablePinIds = filteredPins
          .filter((pin) => !pin.used)
          .map((pin) => pin._id);
        setSelectedPins(availablePinIds);
      } else {
        setSelectedPins([]);
      }
    },
    [filteredPins]
  );

  // Function to handle select individual pin
  const handleSelectPin = useCallback((pinId, isChecked) => {
    if (typeof window === "undefined") return;

    if (isChecked) {
      setSelectedPins((prev) => [...prev, pinId]);
    } else {
      setSelectedPins((prev) => prev.filter((id) => id !== pinId));
      setSelectAll(false);
    }
  }, []);

  // Function to delete multiple pins
  const handleDeleteMultiplePins = useCallback(async () => {
    if (typeof window === "undefined" || selectedPins.length === 0) return;

    setDeletingMultiple(true);
    setError("");
    setSuccessMessage("");

    try {
      const token = checkAuthAndGetToken();
      if (!token) {
        router.push("/admin/login");
        return;
      }

      // Create a new AbortController for this request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

      const response = await api.post(
        `/api/admin/delete-pins`,
        { pinIds: selectedPins },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      // Only update if component is still mounted
      if (!isMounted.current) return;

      setShowDeleteMultipleModal(false);
      setSelectedPins([]);
      setSelectAll(false);

      setSuccessMessage(response.data.message || "PIN berhasil dihapus");

      // Invalidate all caches to force refresh
      invalidateAllCaches();

      // Broadcast event untuk memberi tahu komponen lain
      window.dispatchEvent(new CustomEvent("cache-invalidated"));

      fetchPins(currentPage, itemsPerPage, true); // Refresh data setelah hapus multiple

      return response;
    } catch (error) {
      console.error("Error deleting multiple pins:", error);

      if (!isMounted.current) return;

      if (
        error.name === "AbortError" ||
        error.message === "canceled" ||
        error.name === "CanceledError"
      ) {
        setError(
          "Permintaan timeout. Server mungkin sedang sibuk, coba lagi nanti."
        );
      } else if (error.response?.status === 429) {
        setError(
          "Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat."
        );
      } else {
        setError(
          error.response?.data?.error || "Terjadi kesalahan dalam penghapusan"
        );
      }
    } finally {
      if (isMounted.current) {
        setDeletingMultiple(false);
        setShowDeleteMultipleModal(false);
      }
    }
  }, [
    checkAuthAndGetToken,
    currentPage,
    fetchPins,
    itemsPerPage,
    router,
    selectedPins,
  ]);

  // Function to handle mark as processed click
  const handleProcessClick = useCallback((pin) => {
    if (typeof window === "undefined") return;
    setPinToProcess(pin);
    setShowProcessModal(true);
  }, []);

  // Function to mark PIN as processed
  const handleMarkAsProcessed = useCallback(async () => {
    if (typeof window === "undefined" || !pinToProcess) return;

    setProcessing(true);
    try {
      // Optimistic UI update
      const updatedPins = pins.map((p) => {
        if (p._id === pinToProcess._id) {
          return { ...p, processed: true };
        }
        return p;
      });
      setPins(updatedPins);
      applyFilters(updatedPins, filterStatus, searchTerm);

      const token = checkAuthAndGetToken();
      if (!token) {
        router.push("/admin/login");
        return;
      }

      // Create a new AbortController for this request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await api.patch(
        `/api/admin/pins/${pinToProcess._id}`,
        { processed: true },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      // Only update if component is still mounted
      if (!isMounted.current) return;

      // Close modal and refresh data
      setShowProcessModal(false);
      setPinToProcess(null);
      setSuccessMessage("PIN berhasil ditandai sebagai diproses");

      // Update global stats cache to reflect the change
      updatePendingCountInCaches(1);

      // Broadcast event untuk memberi tahu komponen lain
      window.dispatchEvent(
        new CustomEvent("pin-data-updated", {
          detail: { processedCount: 1 },
        })
      );

      // Refresh data after update
      fetchPins(currentPage, itemsPerPage, true);

      return response;
    } catch (error) {
      console.error("Error marking pin as processed:", error);

      if (!isMounted.current) return;

      if (
        error.name === "AbortError" ||
        error.message === "canceled" ||
        error.name === "CanceledError"
      ) {
        setError(
          "Permintaan timeout. Server mungkin sedang sibuk, coba lagi nanti."
        );
      } else if (error.response?.status === 429) {
        setError(
          "Terlalu banyak permintaan. Silakan coba lagi setelah beberapa saat."
        );
      } else {
        setError(
          "Gagal memproses PIN: " +
            (error.response?.data?.error || "Terjadi kesalahan")
        );
      }
      setShowProcessModal(false);
      fetchPins(currentPage, itemsPerPage, true); // Refresh data to revert optimistic update
    } finally {
      if (isMounted.current) {
        setProcessing(false);
      }
    }
  }, [
    applyFilters,
    checkAuthAndGetToken,
    currentPage,
    fetchPins,
    filterStatus,
    itemsPerPage,
    pins,
    pinToProcess,
    router,
    searchTerm,
  ]);

  // Function to export PINs to CSV
  const handleExportCSV = useCallback(() => {
    if (typeof window === "undefined") return;

    // Buat CSV string
    const csvContent = [
      [
        "PIN Code",
        "Status",
        "Redeemed By",
        "ID Game",
        "Redeemed At",
        "Processed",
      ],
      ...pins.map((pin) => [
        pin.code,
        pin.used ? (pin.processed ? "Processed" : "Pending") : "Available",
        pin.redeemedBy?.nama || "",
        pin.redeemedBy?.idGame || "",
        pin.redeemedBy?.redeemedAt
          ? new Date(pin.redeemedBy.redeemedAt).toLocaleString()
          : "",
        pin.processed ? "Yes" : pin.used ? "No" : "-",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    // Buat file dan download
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pin-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [pins]);

  // Set isMounted to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
      cleanupAllTimers();
    };
  }, [cleanupAllTimers]);

  return {
    // State
    pins,
    filteredPins,
    loading,
    error,
    pinCount,
    pinPrefix,
    generating,
    successMessage,
    activeTab,
    importError,
    importSuccess,
    importPreview,
    isImporting,
    stats,
    selectedPins,
    selectAll,
    showDeleteMultipleModal,
    deletingMultiple,
    showDeleteModal,
    pinToDelete,
    showProcessModal,
    pinToProcess,
    processing,
    filterStatus,
    searchTerm,
    currentPage,
    totalPages,
    itemsPerPage,
    totalItems,
    isRefreshing,
    initialLoadDone,
    rateLimitHit,
    consecutiveErrors,

    // Setters
    setPinCount,
    setPinPrefix,
    setActiveTab,
    setShowDeleteMultipleModal,
    setShowDeleteModal,
    setShowProcessModal,
    setFilterStatus,
    setSearchTerm,
    setError,
    setSuccessMessage,

    // Actions
    fetchPins,
    handleRefresh,
    handlePageChange,
    handleItemsPerPageChange,
    handleGeneratePins,
    handleFileSelect,
    handleImportCSV,
    handleDeleteClick,
    handleDeletePin,
    handleSelectAll,
    handleSelectPin,
    handleDeleteMultiplePins,
    handleProcessClick,
    handleMarkAsProcessed,
    handleExportCSV,

    // Refs
    isMounted,
  };
}

function PinManagement() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [authError, setAuthError] = useState(false);
  const fileInputRef = useRef(null);

  // Use custom hook for PIN management
  const pinManagement = usePinManagement();

  // Destructure state and methods from the hook
  const {
    pins,
    filteredPins,
    loading,
    error,
    pinCount,
    pinPrefix,
    generating,
    successMessage,
    activeTab,
    importError,
    importSuccess,
    importPreview,
    isImporting,
    stats,
    selectedPins,
    selectAll,
    showDeleteMultipleModal,
    deletingMultiple,
    showDeleteModal,
    pinToDelete,
    showProcessModal,
    pinToProcess,
    processing,
    filterStatus,
    searchTerm,
    currentPage,
    totalPages,
    itemsPerPage,
    totalItems,
    isRefreshing,
    initialLoadDone,
    rateLimitHit,
    consecutiveErrors,

    setPinCount,
    setPinPrefix,
    setActiveTab,
    setShowDeleteMultipleModal,
    setShowDeleteModal,
    setShowProcessModal,
    setFilterStatus,
    setSearchTerm,
    setError,
    setSuccessMessage,

    fetchPins,
    handleRefresh,
    handlePageChange,
    handleItemsPerPageChange,
    handleGeneratePins,
    handleFileSelect,
    handleImportCSV,
    handleDeleteClick,
    handleDeletePin,
    handleSelectAll,
    handleSelectPin,
    handleDeleteMultiplePins,
    handleProcessClick,
    handleMarkAsProcessed,
    handleExportCSV,
    isMounted,
  } = pinManagement;

  // Tandai bahwa kita sudah di client-side
  useEffect(() => {
    setIsClient(true);

    // Tambahkan event listener untuk update data
    const handleDataUpdate = () => {
      if (isMounted.current) {
        fetchPins();
      }
    };

    window.addEventListener("pin-data-updated", handleDataUpdate);
    window.addEventListener("cache-invalidated", handleDataUpdate);

    return () => {
      // Remove event listeners
      window.removeEventListener("pin-data-updated", handleDataUpdate);
      window.removeEventListener("cache-invalidated", handleDataUpdate);
    };
  }, [fetchPins, isMounted]);

  // Letakkan ini setelah setIsClient(true)
  useEffect(() => {
    if (!isClient) return;

    const token = sessionStorage.getItem("adminToken");
    if (token) {
      console.log("✅ Auto-fetchPins setelah client aktif & token ada");
      fetchPins(1, itemsPerPage, true);
    } else {
      console.warn("⚠️ Token tidak ditemukan di sessionStorage");
    }
  }, [isClient, fetchPins, itemsPerPage]); // ✅ stabil dari awal render

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? sessionStorage.getItem("adminToken")
        : null;
    if (!token) {
      setAuthError(true);
      router.push("/admin/login");
      return;
    }

    const loadInitialData = () => {
      console.log("Starting initial PIN data load...");
      fetchPins(1, itemsPerPage, true).catch((error) => {
        console.error("Initial PIN data load failed:", error);
        setTimeout(() => {
          if (isMounted.current) {
            console.log("Retrying initial PIN data load...");
            fetchPins(1, itemsPerPage, true);
          }
        }, 3000);
      });
    };

    loadInitialData();

    const dataLoadTimeout = setTimeout(() => {
      if (!initialLoadDone && isMounted.current) {
        console.log("PIN data loading taking too long, trying again");
        fetchPins(currentPage, itemsPerPage, true);
      }
    }, 10000);

    return () => {
      clearTimeout(dataLoadTimeout);
    };
  }, [
    router,
    fetchPins,
    currentPage,
    itemsPerPage,
    initialLoadDone,
    isMounted,
  ]);

  // Handle file input change
  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  // Handle import button click
  const handleImportButtonClick = () => {
    if (fileInputRef.current?.files[0]) {
      handleImportCSV(fileInputRef.current.files[0]);
    } else {
      pinManagement.setImportError("Pilih file CSV terlebih dahulu");
    }
  };

  // Render pagination controls
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const items = [];
    const maxVisiblePages = 5;

    // Calculate range of pages to show
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Previous button
    items.push(
      <Pagination.Prev
        key="prev"
        disabled={currentPage === 1}
        onClick={() => handlePageChange(currentPage - 1)}
      >
        <span className="sr-only">Previous</span>
      </Pagination.Prev>
    );

    // First page
    if (startPage > 1) {
      items.push(
        <Pagination.Item key={1} onClick={() => handlePageChange(1)}>
          1
        </Pagination.Item>
      );
      if (startPage > 2) {
        items.push(<Pagination.Ellipsis key="ellipsis1" />);
      }
    }

    // Page numbers
    for (let page = startPage; page <= endPage; page++) {
      items.push(
        <Pagination.Item
          key={page}
          active={page === currentPage}
          onClick={() => handlePageChange(page)}
        >
          {page}
        </Pagination.Item>
      );
    }

    // Last page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<Pagination.Ellipsis key="ellipsis2" />);
      }
      items.push(
        <Pagination.Item
          key={totalPages}
          onClick={() => handlePageChange(totalPages)}
        >
          {totalPages}
        </Pagination.Item>
      );
    }

    // Next button
    items.push(
      <Pagination.Next
        key="next"
        disabled={currentPage === totalPages}
        onClick={() => handlePageChange(currentPage + 1)}
      >
        <span className="sr-only">Next</span>
      </Pagination.Next>
    );

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
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </Form.Select>
          <span className="ms-3">
            Showing{" "}
            {filteredPins.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}{" "}
            - {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
          </span>
        </div>
        <Pagination size="sm" className="mb-0" aria-label="Pagination">
          {items}
        </Pagination>
      </div>
    );
  };

  if (!initialLoadDone) {
    return (
      <div className="adminpanelmanajemenpinpage">
        <h1 className="mb-4">Manajemen PIN</h1>
        <div className="text-center my-5" aria-live="polite" aria-busy="true">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="adminpanelmanajemenpinpage">
        <h1 className="mb-4">Manajemen PIN</h1>
        <Alert variant="danger">
          Sesi login Anda telah berakhir. Anda akan dialihkan ke halaman
          login...
        </Alert>
      </div>
    );
  }

  return (
    <div className="adminpanelmanajemenpinpage">
      <h1 className="mb-4">Manajemen PIN</h1>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert
          variant="success"
          dismissible
          onClose={() => setSuccessMessage("")}
        >
          <FaCheck className="me-2" />
          {successMessage}
        </Alert>
      )}

      {rateLimitHit && (
        <Alert variant="warning" className="mb-3">
          <strong>Rate Limit Tercapai!</strong> Beberapa operasi mungkin
          dibatasi untuk mencegah spam request.
          {consecutiveErrors > 0 && (
            <div className="mt-1">
              <small>Consecutive errors: {consecutiveErrors}</small>
            </div>
          )}
        </Alert>
      )}

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
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-3"
            fill
          >
            <Tab eventKey="generate" title="Generate PIN">
              <Card.Body>
                <Form onSubmit={handleGeneratePins}>
                  <Row>
                    <Col md={5}>
                      <Form.Group className="mb-3">
                        <Form.Label htmlFor="pinCount">Jumlah PIN</Form.Label>
                        <Form.Control
                          id="pinCount"
                          type="number"
                          value={pinCount === "" ? "" : pinCount}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              setPinCount("");
                            } else {
                              const parsed = Number.parseInt(val);
                              if (!Number.isNaN(parsed)) {
                                setPinCount(parsed);
                              }
                            }
                          }}
                          min="1"
                          max="1000"
                          aria-describedby="pinCountHelp"
                        />
                        <Form.Text id="pinCountHelp" muted>
                          Masukkan jumlah PIN yang ingin digenerate (maksimal
                          1000)
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={5}>
                      <Form.Group className="mb-3">
                        <Form.Label htmlFor="pinPrefix">
                          Prefix (opsional)
                        </Form.Label>
                        <Form.Control
                          id="pinPrefix"
                          type="text"
                          value={pinPrefix}
                          onChange={(e) =>
                            setPinPrefix(e.target.value.toUpperCase())
                          }
                          placeholder="Contoh: HLO"
                          maxLength={5}
                          aria-describedby="pinPrefixHelp"
                        />
                        <Form.Text id="pinPrefixHelp" muted>
                          Awalan untuk PIN (maksimal 5 karakter)
                        </Form.Text>
                      </Form.Group>
                    </Col>
                    <Col md={2} className="d-flex align-items-end">
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-100 mb-3"
                        disabled={generating}
                        aria-label="Generate PIN"
                      >
                        {generating ? (
                          <>
                            <Spinner
                              animation="border"
                              size="sm"
                              className="me-2"
                            />
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
              </Card.Body>
            </Tab>
            <Tab eventKey="import" title="Import CSV">
              <Card.Body>
                {importError && (
                  <Alert
                    variant="danger"
                    dismissible
                    onClose={() => pinManagement.setImportError("")}
                  >
                    <FaExclamationTriangle className="me-2" />
                    {importError}
                  </Alert>
                )}
                {importSuccess && (
                  <Alert
                    variant="success"
                    dismissible
                    onClose={() => pinManagement.setSuccessMessage("")}
                  >
                    <FaCheck className="me-2" />
                    {importSuccess}
                  </Alert>
                )}

                <Form.Group className="mb-3">
                  <Form.Label htmlFor="csvFileInput">
                    Upload File CSV
                  </Form.Label>
                  <Form.Control
                    id="csvFileInput"
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    aria-describedby="csvFileHelp"
                  />
                  <Form.Text id="csvFileHelp" className="infotextpinmanagement">
                    File CSV harus memiliki kolom 'PIN Code'
                  </Form.Text>
                </Form.Group>

                {importPreview.length > 0 && (
                  <div className="mb-3">
                    <h6>Preview:</h6>
                    <div className="table-responsive">
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
                    </div>
                    <p className="text-muted">
                      Menampilkan {importPreview.length} dari total data
                    </p>
                  </div>
                )}

                <Button
                  variant="success"
                  onClick={handleImportButtonClick}
                  disabled={isImporting || importPreview.length === 0}
                  aria-label="Import PIN"
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
                aria-label={`Hapus ${selectedPins.length} PIN`}
              >
                <FaTrash className="me-1" />
                {deletingMultiple ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-1" />
                    Menghapus...
                  </>
                ) : (
                  `Hapus (${selectedPins.length})`
                )}
              </Button>
            )}
            <Button
              variant="outline-primary"
              size="sm"
              className="me-2"
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
              aria-label="Refresh data"
            >
              <FaSync className={`me-1 ${isRefreshing ? "fa-spin" : ""}`} />
              {loading ? "Memuat..." : "Refresh"}
            </Button>
            <Button
              variant="outline-success"
              size="sm"
              onClick={handleExportCSV}
              aria-label="Export CSV"
            >
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
                  aria-label="Cari PIN"
                />
                {searchTerm && (
                  <Button
                    variant="outline-secondary"
                    onClick={() => setSearchTerm("")}
                    aria-label="Clear search"
                  >
                    &times;
                  </Button>
                )}
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
                aria-label="Filter PIN"
              >
                <Dropdown.Item
                  active={filterStatus === "all"}
                  onClick={() => setFilterStatus("all")}
                >
                  Semua PIN
                </Dropdown.Item>
                <Dropdown.Item
                  active={filterStatus === "available"}
                  onClick={() => setFilterStatus("available")}
                >
                  PIN Tersedia
                </Dropdown.Item>
                <Dropdown.Item
                  active={filterStatus === "pending"}
                  onClick={() => setFilterStatus("pending")}
                >
                  PIN Pending
                </Dropdown.Item>
                <Dropdown.Item
                  active={filterStatus === "processed"}
                  onClick={() => setFilterStatus("processed")}
                >
                  PIN Diproses
                </Dropdown.Item>
              </DropdownButton>
            </Col>
          </Row>

          <div
            className="table-responsive"
            style={{ maxHeight: "400px", overflowY: "auto" }}
          >
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>
                    <Form.Check
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      disabled={
                        loading ||
                        filteredPins.filter((pin) => !pin.used).length === 0
                      }
                      aria-label="Select all available PINs"
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
                {loading && filteredPins.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading...
                    </td>
                  </tr>
                ) : filteredPins.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center">
                      {searchTerm
                        ? "Tidak ada PIN yang sesuai dengan pencarian"
                        : "Belum ada PIN yang dibuat"}
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
                            onChange={(e) =>
                              handleSelectPin(pin._id, e.target.checked)
                            }
                            aria-label={`Select PIN ${pin.code}`}
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
                      <td>
                        {pin.redeemedBy?.redeemedAt
                          ? new Date(pin.redeemedBy.redeemedAt).toLocaleString()
                          : "-"}
                      </td>
                      <td>
                        {!pin.used && (
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Hapus PIN</Tooltip>}
                          >
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteClick(pin)}
                              aria-label={`Hapus PIN ${pin.code}`}
                            >
                              <FaTrash />
                            </Button>
                          </OverlayTrigger>
                        )}
                        {pin.used && !pin.processed && (
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Tandai sebagai diproses</Tooltip>}
                          >
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleProcessClick(pin)}
                              aria-label={`Tandai PIN ${pin.code} sebagai diproses`}
                            >
                              <FaCheck />
                            </Button>
                          </OverlayTrigger>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className="mt-2 text-muted">
            Menampilkan {filteredPins.length} dari {totalItems} PIN
          </div>

          {/* Pagination controls */}
          {renderPagination()}
        </Card.Body>
      </Card>

      {/* Modal Konfirmasi Hapus */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" /> Konfirmasi Hapus
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menghapus PIN{" "}
            <strong>{pinToDelete?.code}</strong>?
          </p>
          <Alert variant="warning">
            <FaExclamationTriangle className="me-2" />
            Tindakan ini tidak dapat dibatalkan.
          </Alert>
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
      <Modal
        show={showDeleteMultipleModal}
        onHide={() => !deletingMultiple && setShowDeleteMultipleModal(false)}
      >
        <Modal.Header closeButton={!deletingMultiple}>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" /> Konfirmasi Hapus Multiple
            PIN
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menghapus{" "}
            <strong>{selectedPins.length}</strong> PIN yang dipilih?
          </p>
          <Alert variant="warning">
            <FaExclamationTriangle className="me-2" />
            Tindakan ini tidak dapat dibatalkan.
          </Alert>
          <div className="mt-3">
            <strong>PIN yang akan dihapus:</strong>
            <div
              className="mt-2 border rounded p-2"
              style={{ maxHeight: "150px", overflowY: "auto" }}
            >
              {selectedPins.map((pinId) => {
                const pin = pins.find((p) => p._id === pinId);
                return pin ? (
                  <div key={pinId} className="mb-1">
                    <code>{pin.code}</code>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowDeleteMultipleModal(false)}
            disabled={deletingMultiple}
          >
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteMultiplePins}
            disabled={deletingMultiple}
          >
            {deletingMultiple ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Menghapus...
              </>
            ) : (
              "Hapus"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Mark as Processed */}
      <Modal
        show={showProcessModal}
        onHide={() => !processing && setShowProcessModal(false)}
      >
        <Modal.Header closeButton={!processing}>
          <Modal.Title>
            <FaCheck className="me-2 text-success" /> Konfirmasi Proses PIN
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menandai PIN{" "}
            <strong>{pinToProcess?.code}</strong> sebagai sudah diproses?
          </p>
          {pinToProcess && (
            <div>
              <p>
                <strong>Detail Redemption:</strong>
              </p>
              <ul className="list-group">
                <li className="list-group-item">
                  <strong>Nama:</strong> {pinToProcess.redeemedBy?.nama || "-"}
                </li>
                <li className="list-group-item">
                  <strong>ID Game:</strong>{" "}
                  {pinToProcess.redeemedBy?.idGame || "-"}
                </li>
                <li className="list-group-item">
                  <strong>Waktu Redeem:</strong>{" "}
                  {pinToProcess.redeemedBy?.redeemedAt
                    ? new Date(
                        pinToProcess.redeemedBy.redeemedAt
                      ).toLocaleString()
                    : "-"}
                </li>
              </ul>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowProcessModal(false)}
            disabled={processing}
          >
            Batal
          </Button>
          <Button
            variant="success"
            onClick={handleMarkAsProcessed}
            disabled={processing}
          >
            {processing ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Memproses...
              </>
            ) : (
              "Tandai Sebagai Diproses"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default PinManagement;
