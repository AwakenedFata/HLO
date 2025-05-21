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
 */
export const updatePendingCountInCaches = (processedCount) => {
  if (typeof window === "undefined") return

  try {
    // Update dashboard stats cache
    const dashboardStatsCache = localStorage.getItem(CACHE_KEYS.DASHBOARD_STATS)
    if (dashboardStatsCache) {
      const stats = JSON.parse(dashboardStatsCache)
      stats.pending = Math.max(0, stats.pending - processedCount)
      stats.processed = (stats.processed || 0) + processedCount
      localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS, JSON.stringify(stats))
    }

    // Update admin pending count cache
    const pendingCountCache = localStorage.getItem(CACHE_KEYS.ADMIN_PENDING_COUNT)
    if (pendingCountCache) {
      const count = Math.max(0, JSON.parse(pendingCountCache) - processedCount)
      localStorage.setItem(CACHE_KEYS.ADMIN_PENDING_COUNT, JSON.stringify(count))
    }

    // Invalidate all page-specific pending pins caches
    // Ini lebih baik daripada hanya mengatur waktu fetch terakhir ke 0
    for (let key in localStorage) {
      if (key.startsWith(CACHE_KEYS.PENDING_PINS + "_page_")) {
        localStorage.removeItem(key)
      }
    }
    
    // Tetapkan waktu fetch terakhir ke 0 untuk memaksa refresh pada load berikutnya
    localStorage.setItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, "0")
    
    // Broadcast event untuk memberi tahu komponen lain tentang perubahan
    const event = new CustomEvent('pin-data-updated', { 
      detail: { processedCount } 
    });
    window.dispatchEvent(event);
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
    // Hapus semua cache page-specific
    for (let key in localStorage) {
      if (key.startsWith(CACHE_KEYS.PENDING_PINS + "_page_")) {
        localStorage.removeItem(key)
      }
    }
    
    // Set all last fetch times to 0
    localStorage.setItem(CACHE_KEYS.PENDING_PINS_LAST_FETCH, "0")
    localStorage.setItem(CACHE_KEYS.DASHBOARD_STATS_LAST_FETCH, "0")
    localStorage.setItem(CACHE_KEYS.ADMIN_PENDING_COUNT_LAST_FETCH, "0")
    
    // Broadcast event untuk memberi tahu komponen lain
    window.dispatchEvent(new CustomEvent('cache-invalidated'));
  } catch (error) {
    console.error("Error invalidating caches:", error)
  }
}