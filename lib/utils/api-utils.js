/**
 * Utility functions for API calls
 */

import axios from "axios"
import { getFromCache, saveToCache } from "./cache-utils"

/**
 * Fetches data from API with caching
 * @param {string} url - API endpoint URL
 * @param {string} cacheKey - Key for storing data in localStorage
 * @param {string} lastFetchKey - Key for storing last fetch timestamp
 * @param {number} cacheExpiration - Cache expiration time in milliseconds
 * @param {boolean} force - Force fetch from API, ignoring cache
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - API response data
 */
export async function fetchWithCache(url, cacheKey, lastFetchKey, cacheExpiration, force = false, options = {}) {
  const { headers = {}, signal = null } = options

  // Try to get from cache first if not forcing refresh
  if (!force) {
    const cachedData = getFromCache(cacheKey, lastFetchKey, cacheExpiration)
    if (cachedData) {
      return cachedData
    }
  }

  // Fetch from API
  try {
    const response = await axios.get(url, {
      headers,
      signal,
    })

    // Check for rate limit headers
    const rateLimitRemaining = response.headers["x-ratelimit-remaining"]
    const rateLimitReset = response.headers["x-ratelimit-reset"]

    // If we're close to rate limit, extend cache expiration
    if (rateLimitRemaining && Number.parseInt(rateLimitRemaining) < 3) {
      const extendedExpiration = rateLimitReset ? Number.parseInt(rateLimitReset) * 1000 + 5000 : cacheExpiration * 2
      saveToCache(cacheKey, lastFetchKey, response.data, extendedExpiration)
    } else {
      // Save to cache with normal expiration
      saveToCache(cacheKey, lastFetchKey, response.data)
    }

    return response.data
  } catch (error) {
    console.error(`Error fetching from ${url}:`, error.message)

    // If error is due to abort, just rethrow
    if (error.name === "AbortError" || error.name === "CanceledError") {
      throw error
    }

    // For 401 errors, clear token and throw
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("adminToken")
      }
      throw error
    }

    // For 429 rate limit errors, use cached data and extend expiration
    if (error.response?.status === 429) {
      const cachedData = getFromCache(cacheKey, lastFetchKey, Number.POSITIVE_INFINITY) // Ignore expiration
      if (cachedData) {
        // Get reset time from headers or default to 60 seconds
        const resetTime = error.response.headers["retry-after"]
          ? Number.parseInt(error.response.headers["retry-after"]) * 1000
          : 60000

        // Extend cache expiration
        if (typeof window !== "undefined") {
          localStorage.setItem(lastFetchKey, (Date.now() + resetTime).toString())
        }

        return cachedData
      }
    }

    // For other errors, try to return from cache as fallback
    const cachedData = getFromCache(cacheKey, lastFetchKey, Number.POSITIVE_INFINITY) // Ignore expiration for fallback
    if (cachedData) {
      console.warn("Using cached data as fallback due to API error:", error.message)
      return cachedData
    }

    throw error
  }
}

/**
 * Handles API calls with token refresh
 * @param {Function} apiCallFn - Function that makes the API call
 * @returns {Promise<any>} - API response
 */
export async function handleApiCall(apiCallFn) {
  try {
    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      throw new Error("No authentication token found")
    }

    return await apiCallFn(token)
  } catch (error) {
    if (error.response?.status === 401) {
      try {
        // Try to refresh the token
        const refreshToken = sessionStorage.getItem("refreshToken")
        if (!refreshToken) {
          throw new Error("No refresh token available")
        }

        const refreshResponse = await axios.post(
          "/api/auth/refresh-token",
          { refreshToken },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        )

        if (refreshResponse.data.token) {
          // Store the new token
          sessionStorage.setItem("adminToken", refreshResponse.data.token)
          if (refreshResponse.data.refreshToken) {
            sessionStorage.setItem("refreshToken", refreshResponse.data.refreshToken)
          }

          // Retry the original request with the new token
          return await apiCallFn(refreshResponse.data.token)
        }
      } catch (refreshError) {
        console.error("Token refresh error:", refreshError)
        sessionStorage.removeItem("adminToken")
        sessionStorage.removeItem("refreshToken")
        throw new Error("Authentication failed")
      }
    }

    throw error
  }
}

/**
 * Creates an AbortController with timeout
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Object} - { controller, signal, clear }
 */
export function createTimeoutController(timeoutMs = 15000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  return {
    controller,
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  }
}
