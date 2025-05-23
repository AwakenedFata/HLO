/**
 * Improved rate limiting utility for API routes and middleware
 * Compatible with both Node.js and Edge runtimes
 */

export function rateLimit({
  interval = 60000, // 1 minute default
  uniqueTokenPerInterval = 500,
  limit = 60,
  identifier = "global",
}) {
  const tokenCache = new Map()
  let cleanupTimer = null

  // More conservative cleanup - only run every 2 intervals
  const setupCleanup = () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer)
    }

    cleanupTimer = setInterval(() => {
      const now = Date.now()
      const cutoff = now - interval * 2 // Keep data for 2 intervals

      for (const [key, data] of tokenCache.entries()) {
        if (data.timestamp < cutoff) {
          tokenCache.delete(key)
        }
      }

      // Log cleanup stats occasionally
      if (tokenCache.size > 0 && Math.random() < 0.1) {
        console.log(`[RATE LIMIT] Cleanup: ${tokenCache.size} active windows`)
      }
    }, interval * 2)

    // Node.js: allow process to exit naturally
    if (
      typeof process !== "undefined" &&
      typeof process.release !== "undefined" &&
      process.release.name === "node" &&
      typeof cleanupTimer.unref === "function"
    ) {
      cleanupTimer.unref()
    }
  }

  setupCleanup()

  return {
    check: async (token, customLimit = limit) => {
      const now = Date.now()
      const routeKey = typeof identifier === "function" ? identifier() : identifier

      // Use a more stable window calculation
      const windowStart = Math.floor(now / interval) * interval
      const windowKey = `${token}:${routeKey}:${windowStart}`

      // Get or initialize window data
      const windowData = tokenCache.get(windowKey) || { count: 0, timestamp: windowStart }
      windowData.count += 1
      windowData.timestamp = windowStart

      tokenCache.set(windowKey, windowData)

      const remaining = Math.max(0, customLimit - windowData.count)
      const windowEnd = windowStart + interval
      const reset = Math.ceil((windowEnd - now) / 1000)
      const success = windowData.count <= customLimit

      const result = {
        success,
        limit: customLimit,
        remaining,
        reset: Math.max(1, reset), // Ensure reset is at least 1 second
        window: windowStart,
        count: windowData.count,
      }

      if (!success) {
        console.warn(
          `[RATE LIMIT] ${windowKey} exceeded limit: ${windowData.count}/${customLimit} (reset in ${reset}s)`,
        )
        const error = new Error("Rate limit exceeded")
        error.statusCode = 429
        error.rateLimitInfo = result
        throw error
      }

      // Log when approaching limit
      if (windowData.count > customLimit * 0.8) {
        console.log(`[RATE LIMIT] ${windowKey} approaching limit: ${windowData.count}/${customLimit}`)
      }

      return result
    },

    // Method to clean up and stop the rate limiter
    destroy: () => {
      if (cleanupTimer) {
        clearInterval(cleanupTimer)
        cleanupTimer = null
      }
      tokenCache.clear()
    },
  }
}
