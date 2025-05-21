/**
 * Utility functions for managing cache across components
 */

// Cache keys
export const CACHE_KEYS = {
  PENDING_PINS: "pending_pins_cache",
  PENDING_PINS_LAST_FETCH: "pending_pins_last_fetch",
  DASHBOARD_STATS: "dashboard_stats_cache",
  DASHBOARD_STATS_LAST_FETCH: "dashboard_stats_last_fetch",
  ADMIN_PENDING_COUNT: "admin_pending_count_cache",
  ADMIN_PENDING_COUNT_LAST_FETCH: "admin_pending_count_last_fetch",
  PIN_MANAGEMENT: "pin_management_cache",
  PIN_MANAGEMENT_LAST_FETCH: "pin_management_last_fetch",
  REDEMPTION_HISTORY: "redemption_history_cache",
  REDEMPTION_HISTORY_LAST_FETCH: "redemption_history_last_fetch",
}

// Cache expiration times (in milliseconds)
export const CACHE_EXPIRATION = {
  DASHBOARD: 15 * 60 * 1000, // 15 minutes
  PENDING_PINS: 5 * 60 * 1000, // 5 minutes
  PIN_MANAGEMENT: 10 * 60 * 1000, // 10 minutes
  REDEMPTION_HISTORY: 30 * 60 * 1000, // 30 minutes
  ADMIN_PENDING_COUNT: 5 * 60 * 1000, // 5 minutes
}

// Event types for cross-component communication
export const EVENT_TYPES = {
  PIN_PROCESSED: "pin_processed",
  PIN_CREATED: "pin_created",
  PIN_DELETED: "pin_deleted",
  PIN_IMPORTED: "pin_imported",
  CACHE_INVALIDATED: "cache_invalidated",
}

// Simple event bus for cross-component communication
class EventBus {
  constructor() {
    this.events = {}
  }

  subscribe(event, callback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
    return () => this.unsubscribe(event, callback)
  }

  unsubscribe(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter((cb) => cb !== callback)
    }
  }

  publish(event, data) {
    if (this.events[event]) {
      this.events[event].forEach((callback) => callback(data))
    }
  }
}

// Create a singleton instance
export const eventBus =
  typeof window !== "undefined" ? (window._eventBus = window._eventBus || new EventBus()) : new EventBus()

/**
 * Updates the pending count across all caches when a PIN is processed
 * @param {number} processedCount - Number of pins that were processed
 */
export const updatePendingCountInCaches = (processedCount) => {
  if (typeof window === "undefined") return

  try {
    // Update dashboard stats cache
    const dashboardStatsCache = localStorage.getItem(CACHE_KEYS.DASHBOARD_STATS)
    if (dashboardStatsCache) {
      const stats = JSON.parse(dashboardStatsCache)
      if (stats.pending !== undefined) {
        stats.pending = Math.max(0, stats.pending - processedCount)
        if (stats.processed !== undefined) {
          stats.processed += processedCount
        }
        localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS, JSON.stringify(stats))
      }
    }

    // Update admin pending count cache
    const pendingCountCache = localStorage.getItem(CACHE_KEYS.ADMIN_PENDING_COUNT)
    if (pendingCountCache) {
      const count = Math.max(0, JSON.parse(pendingCountCache) - processedCount)
      localStorage.setItem(CACHE_KEYS.ADMIN_PENDING_COUNT, JSON.stringify(count))
    }

    // Update pending pins cache if it exists
    const pendingPinsCache = localStorage.getItem(CACHE_KEYS.PENDING_PINS)
    if (pendingPinsCache) {
      // We don't know which pins were processed in this case, so we'll just invalidate the cache
      // by setting the last fetch time to 0, forcing a refresh on next load
      localStorage.setItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, "0")
    }

    // Publish event for other components to react
    eventBus.publish(EVENT_TYPES.PIN_PROCESSED, { count: processedCount })
  } catch (error) {
    console.error("Error updating caches:", error)
  }
}

/**
 * Invalidates all caches to force a refresh on next component load
 */
export const invalidateAllCaches = () => {
  if (typeof window === "undefined") return

  try {
    // Set all last fetch times to 0
    Object.keys(CACHE_KEYS).forEach((key) => {
      if (key.includes("LAST_FETCH")) {
        localStorage.setItem(CACHE_KEYS[key], "0")
      }
    })

    // Publish event for other components to react
    eventBus.publish(EVENT_TYPES.CACHE_INVALIDATED, { keys: Object.values(CACHE_KEYS) })
  } catch (error) {
    console.error("Error invalidating caches:", error)
  }
}

/**
 * Get data from cache with expiration check
 * @param {string} key - Cache key
 * @param {string} lastFetchKey - Last fetch timestamp key
 * @param {number} expirationTime - Cache expiration time in milliseconds
 * @returns {Object|null} - Cached data or null if expired/not found
 */
export function getFromCache(key, lastFetchKey, expirationTime) {
  if (typeof window === "undefined") return null

  try {
    const cachedData = localStorage.getItem(key)
    const lastFetch = localStorage.getItem(lastFetchKey)

    if (!cachedData || !lastFetch) return null

    const now = Date.now()
    const parsedTime = Number.parseInt(lastFetch, 10)

    // Check if cache is expired
    if (now - parsedTime > expirationTime) {
      return null
    }

    return JSON.parse(cachedData)
  } catch (error) {
    console.error("Error reading from cache:", error)
    return null
  }
}

/**
 * Save data to cache with timestamp
 * @param {string} key - Cache key
 * @param {string} lastFetchKey - Last fetch timestamp key
 * @param {Object} data - Data to cache
 * @param {number} customExpiration - Optional custom expiration time
 */
export function saveToCache(key, lastFetchKey, data, customExpiration = null) {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(key, JSON.stringify(data))

    // If custom expiration provided, calculate future timestamp
    if (customExpiration) {
      const futureTime = Date.now() + customExpiration
      localStorage.setItem(lastFetchKey, futureTime.toString())
    } else {
      localStorage.setItem(lastFetchKey, Date.now().toString())
    }
  } catch (error) {
    console.error("Error saving to cache:", error)
  }
}

/**
 * Create a debounced function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait) {
  let timeout
  return function (...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

/**
 * Create a throttled function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit time in milliseconds
 * @returns {Function} - Throttled function
 */
export function throttle(func, limit) {
  let inThrottle
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}
