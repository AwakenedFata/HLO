/**
 * Production-ready rate limiting utility
 * Enhanced with better memory management and error handling
 */

export function rateLimit({ interval = 60000, uniqueTokenPerInterval = 1000, limit = 60, identifier = "global" }) {
  const tokenCache = new Map()
  let cleanupTimer = null
  let isDestroyed = false

  // Enhanced cleanup with memory monitoring
  const setupCleanup = () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
    }

    cleanupTimer = setInterval(() => {
      if (isDestroyed) return

      const now = Date.now()
      const cutoff = now - interval * 3 // Keep data for 3 intervals for safety
      let cleanedCount = 0

      for (const [key, data] of tokenCache.entries()) {
        if (data.timestamp < cutoff) {
          tokenCache.delete(key)
          cleanedCount++
        }
      }

      // Memory monitoring
      if (tokenCache.size > uniqueTokenPerInterval * 1.5) {
        console.warn(`[RATE LIMIT] High memory usage: ${tokenCache.size} active windows`)

        // Emergency cleanup - remove oldest entries
        const entries = Array.from(tokenCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)

        const toRemove = entries.slice(0, Math.floor(entries.length * 0.3))
        toRemove.forEach(([key]) => tokenCache.delete(key))

        console.warn(`[RATE LIMIT] Emergency cleanup: removed ${toRemove.length} entries`)
      }

      // Periodic logging
      if (cleanedCount > 0 && Math.random() < 0.1) {
        console.log(`[RATE LIMIT] Cleanup: removed ${cleanedCount}, active: ${tokenCache.size}`)
      }
    }, interval)

    // Ensure cleanup timer doesn't prevent process exit
    if (typeof process !== "undefined" && cleanupTimer?.unref) {
      cleanupTimer.unref()
    }
  }

  setupCleanup()

  return {
    check: async (token, customLimit = limit) => {
      if (isDestroyed) {
        throw new Error("Rate limiter has been destroyed")
      }

      const now = Date.now()
      const routeKey = typeof identifier === "function" ? identifier() : identifier

      // Use sliding window approach
      const windowStart = Math.floor(now / interval) * interval
      const windowKey = `${token}:${routeKey}:${windowStart}`

      // Get or initialize window data
      let windowData = tokenCache.get(windowKey)
      if (!windowData) {
        windowData = { count: 0, timestamp: windowStart, requests: [] }
        tokenCache.set(windowKey, windowData)
      }

      // Add current request
      windowData.requests.push(now)
      windowData.count = windowData.requests.length

      // Clean old requests within the window
      const windowEnd = windowStart + interval
      windowData.requests = windowData.requests.filter((time) => time >= windowStart && time < windowEnd)
      windowData.count = windowData.requests.length

      const remaining = Math.max(0, customLimit - windowData.count)
      const reset = Math.ceil((windowEnd - now) / 1000)
      const success = windowData.count <= customLimit

      const result = {
        success,
        limit: customLimit,
        remaining,
        reset: Math.max(1, reset),
        window: windowStart,
        count: windowData.count,
      }

      if (!success) {
        const error = new Error("Rate limit exceeded")
        error.statusCode = 429
        error.rateLimitInfo = result
        throw error
      }

      return result
    },

    // Enhanced destroy method
    destroy: () => {
      isDestroyed = true
      if (cleanupTimer) {
        clearInterval(cleanupTimer)
        cleanupTimer = null
      }
      tokenCache.clear()
      console.log("[RATE LIMIT] Rate limiter destroyed")
    },

    // Get current stats
    getStats: () => ({
      activeWindows: tokenCache.size,
      isDestroyed,
      interval,
      limit,
    }),
  }
}
