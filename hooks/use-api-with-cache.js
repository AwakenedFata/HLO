"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import axios from "axios"
import { useRouter } from "next/navigation"
import { getFromCache, saveToCache, eventBus, EVENT_TYPES } from "@/lib/utils/cache-utils"

/**
 * Custom hook for API calls with caching, authentication, and cross-component synchronization
 *
 * @param {string} url - API endpoint URL
 * @param {string} cacheKey - Key for storing data in localStorage
 * @param {string} lastFetchKey - Key for storing last fetch timestamp
 * @param {number} cacheExpiration - Cache expiration time in milliseconds
 * @param {Array} dependencies - Dependencies array for refetching
 * @param {Array} invalidateOn - Array of event types that should trigger cache invalidation
 * @param {Object} options - Additional options
 * @returns {Object} - { data, loading, error, mutate, isRefreshing }
 */
export default function useApiWithCache(
  url,
  cacheKey,
  lastFetchKey,
  cacheExpiration,
  dependencies = [],
  invalidateOn = [],
  options = {},
) {
  const {
    initialData = null,
    requiresAuth = true,
    autoRefreshInterval = null,
    withPagination = false,
    pageSize = 50,
    transformResponse = (data) => data,
  } = options

  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const router = useRouter()
  const isMounted = useRef(true)
  const abortControllerRef = useRef(null)
  const lastFetchTimeRef = useRef(0)
  const autoRefreshTimerRef = useRef(null)

  // Function to check authentication and get token
  const getAuthToken = useCallback(() => {
    if (!requiresAuth) return null

    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      router.push("/admin/login")
      return null
    }
    return token
  }, [requiresAuth, router])

  // Function to fetch data from API
  const fetchData = useCallback(
    async (force = false, pageToFetch = page) => {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create a new AbortController
      abortControllerRef.current = new AbortController()

      // Check if we should use cached data
      if (!force) {
        const now = Date.now()
        const timeSinceLastFetch = now - lastFetchTimeRef.current

        // If we fetched recently and not forcing, use cached data
        if (timeSinceLastFetch < 2000) {
          // 2 seconds debounce
          return
        }

        // Try to get from cache
        const cachedData = getFromCache(cacheKey, lastFetchKey, cacheExpiration)
        if (cachedData) {
          setData(transformResponse(cachedData))
          setLoading(false)
          return
        }
      }

      // If we need authentication and can't get a token, return
      if (requiresAuth) {
        const token = getAuthToken()
        if (!token) return
      }

      setIsRefreshing(true)
      setError(null)

      try {
        // Set a timeout for the request (15 seconds)
        const timeoutId = setTimeout(() => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort()
          }
        }, 15000)

        // Prepare URL with pagination if needed
        let fetchUrl = url
        if (withPagination) {
          const separator = url.includes("?") ? "&" : "?"
          fetchUrl = `${url}${separator}page=${pageToFetch}&limit=${pageSize}`
        }

        // Make the API call
        const response = await axios.get(fetchUrl, {
          headers: requiresAuth
            ? {
                Authorization: `Bearer ${getAuthToken()}`,
              }
            : {},
          signal: abortControllerRef.current.signal,
        })

        clearTimeout(timeoutId)

        // Only update state if component is still mounted
        if (!isMounted.current) return

        // Process response data
        const responseData = response.data

        // Handle pagination metadata if available
        if (withPagination && responseData.totalPages) {
          setTotalPages(responseData.totalPages)
          setTotalItems(responseData.total || 0)
        }

        // Transform and set data
        const transformedData = transformResponse(responseData)
        setData(transformedData)

        // Save to cache
        saveToCache(cacheKey, lastFetchKey, responseData)
        lastFetchTimeRef.current = Date.now()

        setLoading(false)
      } catch (error) {
        if (!isMounted.current) return

        console.error(`Error fetching data from ${url}:`, error)

        if (error.name === "AbortError") {
          setError("Request timed out. The server might be busy, please try again later.")
        } else if (error.response?.status === 401) {
          if (requiresAuth) {
            sessionStorage.removeItem("adminToken")
            router.push("/admin/login")
          }
        } else if (error.response?.status === 429) {
          setError("Too many requests. Please try again in a few minutes.")
        } else {
          setError(`Failed to fetch data: ${error.response?.data?.error || "An error occurred"}`)
        }

        setLoading(false)
      } finally {
        if (isMounted.current) {
          setIsRefreshing(false)
        }
      }
    },
    [
      url,
      cacheKey,
      lastFetchKey,
      cacheExpiration,
      requiresAuth,
      getAuthToken,
      router,
      withPagination,
      pageSize,
      page,
      transformResponse,
    ],
  )

  // Function to manually trigger a refresh
  const mutate = useCallback(
    (force = true) => {
      return fetchData(force)
    },
    [fetchData],
  )

  // Function to change page
  const changePage = useCallback(
    (newPage) => {
      setPage(newPage)
      fetchData(true, newPage)
    },
    [fetchData],
  )

  // Set up event listeners for cache invalidation
  useEffect(() => {
    const unsubscribers = invalidateOn.map((eventType) => {
      return eventBus.subscribe(eventType, () => {
        fetchData(true)
      })
    })

    // Add listener for general cache invalidation
    const cacheInvalidationUnsubscriber = eventBus.subscribe(EVENT_TYPES.CACHE_INVALIDATED, ({ keys }) => {
      if (keys.includes(cacheKey) || keys.includes(lastFetchKey)) {
        fetchData(true)
      }
    })

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      cacheInvalidationUnsubscriber()
    }
  }, [invalidateOn, cacheKey, lastFetchKey, fetchData])

  // Set up auto-refresh interval if specified
  useEffect(() => {
    if (autoRefreshInterval) {
      autoRefreshTimerRef.current = setInterval(() => {
        if (isMounted.current) {
          fetchData(true)
        }
      }, autoRefreshInterval)
    }

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current)
      }
    }
  }, [autoRefreshInterval, fetchData])

  // Initial data fetch
  useEffect(() => {
    fetchData()

    return () => {
      isMounted.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, ...dependencies])

  return {
    data,
    loading,
    error,
    isRefreshing,
    mutate,
    page,
    totalPages,
    totalItems,
    changePage,
  }
}
