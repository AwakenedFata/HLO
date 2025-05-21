/**
 * Simple rate limiting utility for API routes
 */

export function rateLimit({ interval, uniqueTokenPerInterval, limit }) {
  const tokenCache = new Map()

  return {
    check: async (token, limit, identifier = "global") => {
      const now = Date.now()
      const windowKey = `${token}:${identifier}:${Math.floor(now / interval)}`

      const tokenCount = (tokenCache.get(windowKey) || 0) + 1

      tokenCache.set(windowKey, tokenCount)

      // Clean up old entries every 5 minutes
      if (tokenCache.size > uniqueTokenPerInterval) {
        const keys = [...tokenCache.keys()]
        const windowStart = Math.floor(now / interval) * interval

        for (const key of keys) {
          const keyTime = Number(key.split(":")[2]) * interval
          if (keyTime < windowStart) {
            tokenCache.delete(key)
          }
        }
      }

      if (tokenCount > limit) {
        const error = new Error("Rate limit exceeded")
        error.statusCode = 429
        throw error
      }

      return { success: true }
    },
  }
}
