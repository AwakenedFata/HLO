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
}

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
      stats.pending = Math.max(0, stats.pending - processedCount)
      localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS, JSON.stringify(stats))
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
    localStorage.setItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, "0")
    localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH, "0")
    localStorage.setItem(CACHE_KEYS.ADMIN_PENDING_COUNT_LAST_FETCH, "0")
  } catch (error) {
    console.error("Error invalidating caches:", error)
  }
}
