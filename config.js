export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_APP_URL || "https://hoklampung.vercel.app"
export const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "6285709346954"

// Production-specific configurations
export const PRODUCTION_CONFIG = {
  // Rate limiting (use your existing env vars)
  rateLimits: {
    window: Number.parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
    maxRequests: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },

  // Security
  security: {
    secureCookies: process.env.SECURE_COOKIES === "true",
    jwtExpiry: process.env.JWT_EXPIRES_IN || "1h",
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || "warn",
    apiRequests: process.env.LOG_API_REQUESTS === "true",
  },

  // Email
  email: {
    host: process.env.EMAIL_HOST,
    port: Number.parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
    from: process.env.EMAIL_FROM,
  },
}