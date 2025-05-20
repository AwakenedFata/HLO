import { LRUCache } from "lru-cache"

// Buat objek untuk menyimpan rate limiter berbeda
const limiters = {}

export function rateLimit({ interval, limit, uniqueTokenPerInterval = 500, identifier = "default" }) {
  // Gunakan identifier untuk membedakan rate limiter
  const cacheKey = identifier

  // Jika rate limiter dengan identifier ini belum ada, buat baru
  if (!limiters[cacheKey]) {
    limiters[cacheKey] = new LRUCache({
      max: uniqueTokenPerInterval,
      ttl: interval,
    })
  }

  const tokenCache = limiters[cacheKey]

  return {
    check: async (token) => {
      // Dapatkan timestamp saat ini
      const now = Date.now()

      // Dapatkan data rate limit untuk token ini
      const tokenData = tokenCache.get(token) || { count: 0, firstAttempt: now }

      // Increment counter
      tokenData.count += 1

      // Jika ini percobaan pertama, catat waktunya
      if (tokenData.count === 1) {
        tokenData.firstAttempt = now
      }

      // Update cache
      tokenCache.set(token, tokenData)

      // Hitung waktu reset dalam detik
      // Waktu reset adalah waktu ketika interval berakhir sejak percobaan pertama
      const resetTime = Math.ceil((tokenData.firstAttempt + interval - now) / 1000)

      // Cek apakah masih dalam batas
      const success = tokenData.count <= limit
      const remaining = Math.max(0, limit - tokenData.count)

      return {
        success,
        remaining,
        limit,
        reset: resetTime > 0 ? resetTime : 0,
        firstAttempt: tokenData.firstAttempt,
        count: tokenData.count,
      }
    },

    reset: (token) => {
      tokenCache.delete(token)
      return true
    },

    getInfo: (token) => {
      const now = Date.now()
      const tokenData = tokenCache.get(token)

      if (!tokenData) {
        return {
          success: true,
          remaining: limit,
          limit,
          reset: 0,
          count: 0,
        }
      }

      const resetTime = Math.ceil((tokenData.firstAttempt + interval - now) / 1000)
      const success = tokenData.count < limit
      const remaining = Math.max(0, limit - tokenData.count)

      return {
        success,
        remaining,
        limit,
        reset: resetTime > 0 ? resetTime : 0,
        count: tokenData.count,
      }
    },
  }
}
