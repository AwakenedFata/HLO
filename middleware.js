// Perbaikan pada middleware.js untuk menangani token refresh
// Tambahkan pengecekan token untuk rute admin

import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/utils/rate-limit"
import logger from "@/lib/utils/logger-edge" // Gunakan logger-edge yang kompatibel dengan Edge Runtime

// Rate limiter untuk API routes umum
const apiLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 jam
  uniqueTokenPerInterval: 500,
  limit: 100, // 100 requests per jam
  identifier: "api-general",
})

// Rate limiter untuk endpoint autentikasi
const authLimiter = rateLimit({
  interval: 15 * 60 * 1000, // 15 menit
  uniqueTokenPerInterval: 500,
  limit: 10, // 10 requests per 15 menit
  identifier: "api-auth",
})

// Rate limiter untuk endpoint redeem
const redeemLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 jam
  uniqueTokenPerInterval: 500,
  limit: 5, // 5 requests per jam
  identifier: "api-redeem",
})

// Rate limiter untuk endpoint admin
const adminLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 jam
  uniqueTokenPerInterval: 500,
  limit: 50, // 50 requests per jam
  identifier: "api-admin",
})

// Rate limiter untuk endpoint SSE
const sseLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 jam
  uniqueTokenPerInterval: 500,
  limit: 10, // 10 requests per jam
  identifier: "api-sse",
})

export async function middleware(request) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname
  const ip = request.headers.get("x-forwarded-for") || "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"

  // Kombinasikan IP dan user-agent untuk rate limiting yang lebih akurat
  const tokenKey = `${ip}:${userAgent.substring(0, 50)}`

  // Cek apakah request ke halaman admin (kecuali login)
  if (path.startsWith("/admin") && !path.startsWith("/admin/login")) {
    // Cek apakah ada token di cookies
    const token = request.cookies.get("jwt")?.value

    // Jika tidak ada token, redirect ke login
    if (!token) {
      logger.warn(`Akses ke halaman admin tanpa token: ${path} dari IP: ${ip}`)
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
  }

  // Apply rate limiting to API routes
  if (path.startsWith("/api/")) {
    let limitResult

    // Gunakan rate limiter yang sesuai berdasarkan path
    if (path.startsWith("/api/auth/")) {
      limitResult = await authLimiter.check(tokenKey)
    } else if (path.startsWith("/api/pin/redeem")) {
      limitResult = await redeemLimiter.check(tokenKey)
    } else if (path.startsWith("/api/admin/")) {
      limitResult = await adminLimiter.check(tokenKey)
    } else if (path.startsWith("/api/sse")) {
      limitResult = await sseLimiter.check(tokenKey)
    } else {
      limitResult = await apiLimiter.check(tokenKey)
    }

    if (!limitResult.success) {
      logger.warn(`Rate limit exceeded for ${path} from IP: ${ip}, attempts: ${limitResult.count}`)

      // Hitung waktu reset yang lebih akurat
      const retryAfter = limitResult.reset || 60 // Default 60 detik jika tidak ada info reset

      return NextResponse.json(
        {
          error: `Too many requests from this IP, please try again in ${retryAfter} seconds`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(limitResult.limit),
            "X-RateLimit-Remaining": String(limitResult.remaining),
            "X-RateLimit-Reset": String(limitResult.reset),
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        },
      )
    }
  }

  // CORS headers for API routes
  if (path.startsWith("/api/")) {
    const response = NextResponse.next()

    // Get origin from request
    const origin = request.headers.get("origin") || ""

    // Definisikan allowed origins berdasarkan environment
    const allowedOrigins =
      process.env.NODE_ENV === "production"
        ? [process.env.FRONTEND_URL, "https://hoklampung.com", "https://www.hoklampung.com"]
        : ["http://localhost:3000", "http://localhost:5173"]

    // Set CORS headers if origin is allowed
    if (allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin)
    } else if (process.env.NODE_ENV === "development") {
      // Untuk development, izinkan semua origin
      response.headers.set("Access-Control-Allow-Origin", "*")
    }

    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    )
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.set("Access-Control-Max-Age", "86400") // 24 jam

    // Tambahkan security headers
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-XSS-Protection", "1; mode=block")

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 200,
        headers: response.headers,
      })
    }

    // Log API request
    logger.info(`API Request: ${request.method} ${path} from ${ip}`)

    return response
  }

  return NextResponse.next()
}

// Configure which paths should be processed by this middleware
export const config = {
  matcher: [
    // Apply to all API routes
    "/api/:path*",
    // Apply to all admin routes
    "/admin/:path*",
    // Exclude static files and images
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
