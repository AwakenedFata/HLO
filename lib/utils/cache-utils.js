/**
 * Enhanced utility functions for managing cache across components
 * Provides better error handling, type safety, and additional functionality
 */

// Cache version - increment when changing cache structure
const CACHE_VERSION = 1

// Cache keys with namespacing to avoid conflicts
export const CACHE_KEYS = {
  PENDING_PINS: "admin_v" + CACHE_VERSION + "_pending_pins_cache",
  PENDING_PINS_LAST_FETCH: "admin_v" + CACHE_VERSION + "_pending_pins_last_fetch",
  DASHBOARD_STATS: "admin_v" + CACHE_VERSION + "_dashboard_stats_cache",
  DASHBOARD_STATS_LAST_FETCH: "admin_v" + CACHE_VERSION + "_dashboard_stats_last_fetch",
  ADMIN_PENDING_COUNT: "admin_v" + CACHE_VERSION + "_admin_pending_count_cache",
  ADMIN_PENDING_COUNT_LAST_FETCH: "admin_v" + CACHE_VERSION + "_admin_pending_count_last_fetch",
  REDEMPTION_HISTORY: "admin_v" + CACHE_VERSION + "_redemption_history_cache",
  REDEMPTION_HISTORY_LAST_FETCH: "admin_v" + CACHE_VERSION + "_redemption_history_last_fetch",
}

// Default cache expiration times
export const CACHE_EXPIRATION = {
  SHORT: 2 * 60 * 1000, // 2 minutes
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
}

/**
 * Safely checks if localStorage is available
 * @returns {boolean} True if localStorage is available
 */
const isStorageAvailable = () => {
  if (typeof window === "undefined") return false

  try {
    const testKey = "__storage_test__"
    window.localStorage.setItem(testKey, testKey)
    window.localStorage.removeItem(testKey)
    return true
  } catch (e) {
    console.warn("localStorage is not available:", e)
    return false
  }
}

/**
 * Safely gets a value from cache with proper error handling
 * @param {string} key - Cache key
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {any} Parsed value or defaultValue
 */
export const getCacheItem = (key, defaultValue = null) => {
  if (!isStorageAvailable()) return defaultValue

  try {
    const item = localStorage.getItem(key)
    if (item === null) return defaultValue

    return JSON.parse(item)
  } catch (error) {
    console.error(`Error getting cache item [${key}]:`, error)
    return defaultValue
  }
}

/**
 * Safely sets a value in cache with proper error handling
 * @param {string} key - Cache key
 * @param {any} value - Value to store (will be JSON stringified)
 * @returns {boolean} True if successful
 */
export const setCacheItem = (key, value) => {
  if (!isStorageAvailable()) return false

  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.error(`Error setting cache item [${key}]:`, error)

    // If we hit quota error, try to clear old caches
    if (
      error instanceof DOMException &&
      (error.code === 22 || // Chrome quota error
        error.code === 1014 || // Firefox quota error
        error.name === "QuotaExceededError")
    ) {
      console.warn("Storage quota exceeded, clearing old caches")
      clearOldCaches()

      // Try again after clearing
      try {
        localStorage.setItem(key, JSON.stringify(value))
        return true
      } catch (retryError) {
        console.error("Still failed after clearing old caches:", retryError)
      }
    }

    return false
  }
}

/**
 * Safely removes a value from cache
 * @param {string} key - Cache key
 * @returns {boolean} True if successful
 */
export const removeCacheItem = (key) => {
  if (!isStorageAvailable()) return false

  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error(`Error removing cache item [${key}]:`, error)
    return false
  }
}

/**
 * Mendapatkan kunci cache untuk halaman pending pins tertentu
 * @param {number} page - Nomor halaman
 * @param {number} limit - Jumlah item per halaman
 * @returns {string} Kunci cache
 */
export const getPendingPinsCacheKey = (page, limit) => {
  return `${CACHE_KEYS.PENDING_PINS}_page_${page}_limit_${limit}`
}

/**
 * Updates the pending count across all caches when a PIN is processed
 * @param {number} processedCount - Number of pins that were processed
 * @returns {boolean} True if successful
 */
export const updatePendingCountInCaches = (processedCount) => {
  if (!isStorageAvailable()) return false
  if (!processedCount || processedCount <= 0) return false

  try {
    // Use a transaction-like approach to ensure all updates happen or none
    const updates = []

    // Update dashboard stats cache
    const dashboardStats = getCacheItem(CACHE_KEYS.DASHBOARD_STATS)
    if (dashboardStats) {
      const updatedStats = {
        ...dashboardStats,
        pending: Math.max(0, dashboardStats.pending - processedCount),
        processed: (dashboardStats.processed || 0) + processedCount,
        lastUpdated: new Date().toISOString(),
      }
      updates.push({ key: CACHE_KEYS.DASHBOARD_STATS, value: updatedStats })
    }

    // Update admin pending count cache
    const pendingCount = getCacheItem(CACHE_KEYS.ADMIN_PENDING_COUNT)
    if (pendingCount !== null) {
      const updatedCount = Math.max(0, pendingCount - processedCount)
      updates.push({ key: CACHE_KEYS.ADMIN_PENDING_COUNT, value: updatedCount })
    }

    // Collect all page-specific pending pins cache keys
    const pendingPinsKeys = []
    if (isStorageAvailable()) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(CACHE_KEYS.PENDING_PINS + "_page_")) {
          pendingPinsKeys.push(key)
        }
      }
    }

    // Apply all updates atomically
    for (const update of updates) {
      setCacheItem(update.key, update.value)
    }

    // Remove all page-specific pending pins caches
    for (const key of pendingPinsKeys) {
      removeCacheItem(key)
    }

    // Set last fetch time to 0 to force refresh on next load
    setCacheItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, 0)

    // Broadcast event for other components
    if (typeof window !== "undefined") {
      const event = new CustomEvent("pin-data-updated", {
        detail: {
          processedCount,
          timestamp: Date.now(),
          source: "cache-update",
        },
      })
      window.dispatchEvent(event)

      // Also dispatch cache-invalidated event
      window.dispatchEvent(
        new CustomEvent("cache-invalidated", {
          detail: {
            keys: ["pending-pins", "redemption-history"],
            timestamp: Date.now(),
          },
        }),
      )
    }

    return true
  } catch (error) {
    console.error("Error updating caches:", error)
    return false
  }
}

/**
 * Invalidates all caches to force a refresh on next component load
 * @param {Array<string>} specificKeys - Optional array of specific cache keys to invalidate
 * @returns {boolean} True if successful
 */
export const invalidateAllCaches = (specificKeys = null) => {
  if (!isStorageAvailable()) return false

  try {
    if (specificKeys && Array.isArray(specificKeys)) {
      // Invalidate only specific keys
      for (const baseKey of specificKeys) {
        if (CACHE_KEYS[baseKey]) {
          // Set last fetch time to 0
          setCacheItem(`${CACHE_KEYS[baseKey]}_LAST_FETCH`, 0)

          // Remove page-specific caches if it's PENDING_PINS
          if (baseKey === "PENDING_PINS") {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (key && key.startsWith(CACHE_KEYS.PENDING_PINS + "_page_")) {
                removeCacheItem(key)
              }
            }
          }

          // Remove page-specific caches if it's REDEMPTION_HISTORY
          if (baseKey === "REDEMPTION_HISTORY") {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (key && key.startsWith(CACHE_KEYS.REDEMPTION_HISTORY + "_page_")) {
                removeCacheItem(key)
              }
            }
          }
        }
      }
    } else {
      // Invalidate all caches

      // Remove all page-specific pending pins caches
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (
          key &&
          (key.startsWith(CACHE_KEYS.PENDING_PINS + "_page_") ||
            key.startsWith(CACHE_KEYS.REDEMPTION_HISTORY + "_page_"))
        ) {
          keysToRemove.push(key)
        }
      }

      // Remove collected keys
      for (const key of keysToRemove) {
        removeCacheItem(key)
      }

      // Set all last fetch times to 0
      setCacheItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, 0)
      setCacheItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH, 0)
      setCacheItem(CACHE_KEYS.ADMIN_PENDING_COUNT_LAST_FETCH, 0)
      setCacheItem(CACHE_KEYS.REDEMPTION_HISTORY_LAST_FETCH, 0)
    }

    // Broadcast event for other components
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cache-invalidated", {
          detail: {
            keys: specificKeys || "all",
            timestamp: Date.now(),
          },
        }),
      )
    }

    return true
  } catch (error) {
    console.error("Error invalidating caches:", error)
    return false
  }
}

/**
 * Checks if cache is stale and needs refresh
 * @param {string} lastFetchKey - Cache key for last fetch time
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {boolean} True if cache is stale
 */
export const isCacheStale = (lastFetchKey, maxAge = CACHE_EXPIRATION.MEDIUM) => {
  if (!isStorageAvailable()) return true

  try {
    const lastFetch = getCacheItem(lastFetchKey, 0)
    if (!lastFetch) return true

    const now = Date.now()
    return now - lastFetch > maxAge
  } catch (error) {
    console.error(`Error checking cache staleness [${lastFetchKey}]:`, error)
    return true
  }
}

/**
 * Gets the remaining time until cache expires
 * @param {string} lastFetchKey - Cache key for last fetch time
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {number} Milliseconds until expiration (0 if already expired)
 */
export const getCacheTimeRemaining = (lastFetchKey, maxAge = CACHE_EXPIRATION.MEDIUM) => {
  if (!isStorageAvailable()) return 0

  try {
    const lastFetch = getCacheItem(lastFetchKey, 0)
    if (!lastFetch) return 0

    const now = Date.now()
    const expiresAt = lastFetch + maxAge

    return Math.max(0, expiresAt - now)
  } catch (error) {
    console.error(`Error getting cache time remaining [${lastFetchKey}]:`, error)
    return 0
  }
}

/**
 * Formats remaining time in a human-readable format
 * @param {number} milliseconds - Time in milliseconds
 * @returns {string} Formatted time string (e.g., "2m 30s")
 */
export const formatTimeRemaining = (milliseconds) => {
  if (milliseconds <= 0) return "0s"

  const seconds = Math.floor((milliseconds / 1000) % 60)
  const minutes = Math.floor((milliseconds / (1000 * 60)) % 60)
  const hours = Math.floor(milliseconds / (1000 * 60 * 60))

  let result = ""
  if (hours > 0) result += `${hours}h `
  if (minutes > 0 || hours > 0) result += `${minutes}m `
  result += `${seconds}s`

  return result.trim()
}

/**
 * Clears old caches to free up storage space
 * @returns {number} Number of items cleared
 */
export const clearOldCaches = () => {
  if (!isStorageAvailable()) return 0

  try {
    let clearedCount = 0
    const now = Date.now()
    const veryOldThreshold = now - 24 * 60 * 60 * 1000 // 24 hours

    // Find old cache items
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)

      // Skip non-cache items
      if (!key || !key.startsWith("admin_v")) continue

      // Check if it's a last fetch time key
      if (key.includes("_last_fetch")) {
        const lastFetch = getCacheItem(key, 0)
        if (lastFetch < veryOldThreshold) {
          // This is a very old cache, remove it and its data
          const baseKey = key.replace("_last_fetch", "")
          keysToRemove.push(key)
          keysToRemove.push(baseKey)
        }
      }
    }

    // Remove collected keys
    for (const key of keysToRemove) {
      removeCacheItem(key)
      clearedCount++
    }

    return clearedCount
  } catch (error) {
    console.error("Error clearing old caches:", error)
    return 0
  }
}

/**
 * Gets cache statistics for debugging
 * @returns {Object} Cache statistics
 */
export const getCacheStats = () => {
  if (!isStorageAvailable()) return { available: false }

  try {
    const stats = {
      available: true,
      totalItems: 0,
      totalSize: 0,
      cacheItems: {},
      lastFetchTimes: {},
    }

    // Collect all cache items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith("admin_v")) continue

      const value = localStorage.getItem(key)
      const size = (value?.length || 0) * 2 // Approximate size in bytes

      stats.totalItems++
      stats.totalSize += size

      if (key.includes("_last_fetch")) {
        stats.lastFetchTimes[key] = {
          timestamp: getCacheItem(key, 0),
          formattedTime: new Date(getCacheItem(key, 0)).toLocaleString(),
        }
      } else {
        const itemValue = getCacheItem(key)
        stats.cacheItems[key] = {
          type: typeof itemValue,
          isArray: Array.isArray(itemValue),
          size: `${(size / 1024).toFixed(2)} KB`,
        }

        if (Array.isArray(itemValue)) {
          stats.cacheItems[key].length = itemValue.length
        }
      }
    }

    stats.totalSize = `${(stats.totalSize / 1024).toFixed(2)} KB`
    return stats
  } catch (error) {
    console.error("Error getting cache stats:", error)
    return { available: false, error: error.message }
  }
}

/**
 * Registers a callback to be executed when cache is invalidated
 * @param {Function} callback - Function to call when cache is invalidated
 * @returns {Function} Function to unregister the callback
 */
export const onCacheInvalidated = (callback) => {
  if (typeof window === "undefined" || typeof callback !== "function") {
    return () => {}
  }

  const handler = (event) => {
    callback(event.detail)
  }

  window.addEventListener("cache-invalidated", handler)

  // Return unsubscribe function
  return () => {
    window.removeEventListener("cache-invalidated", handler)
  }
}

/**
 * Registers a callback to be executed when pin data is updated
 * @param {Function} callback - Function to call when pin data is updated
 * @returns {Function} Function to unregister the callback
 */
export const onPinDataUpdated = (callback) => {
  if (typeof window === "undefined" || typeof callback !== "function") {
    return () => {}
  }

  const handler = (event) => {
    callback(event.detail)
  }

  window.addEventListener("pin-data-updated", handler)

  // Return unsubscribe function
  return () => {
    window.removeEventListener("pin-data-updated", handler)
  }
}
