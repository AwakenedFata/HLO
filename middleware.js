import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { rateLimit } from "@/lib/utils/rate-limit"
import logger from "@/lib/utils/logger-edge"

// Use your environment variables for rate limiting
const RATE_LIMIT_WINDOW = Number.parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000
const RATE_LIMIT_MAX = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100

// Rate limiter configurations
const apiLimiter = rateLimit({
  interval: 60 * 60 * 1000,
  uniqueTokenPerInterval: 500,
  limit: RATE_LIMIT_MAX,
  identifier: "api-general",
})

const redeemLimiter = rateLimit({
  interval: 60 * 60 * 1000,
  uniqueTokenPerInterval: 500,
  limit: 5,
  identifier: "api-redeem",
})

const adminLimiter = rateLimit({
  interval: 60 * 60 * 1000,
  uniqueTokenPerInterval: 500,
  limit: Math.floor(RATE_LIMIT_MAX / 2),
  identifier: "api-admin",
})

const sseLimiter = rateLimit({
  interval: 60 * 60 * 1000,
  uniqueTokenPerInterval: 500,
  limit: 10,
  identifier: "api-sse",
})

function getClientIdentifier(request) {
  const cfConnectingIp = request.headers.get("cf-connecting-ip")
  const xForwardedFor = request.headers.get("x-forwarded-for")
  const xRealIp = request.headers.get("x-real-ip")

  const ip = cfConnectingIp || xRealIp || xForwardedFor?.split(",")[0]?.trim() || "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"

  return `${ip}:${userAgent.substring(0, 50)}`
}

function createRateLimitResponse(limitResult) {
  const retryAfter = limitResult.reset || 60

  return NextResponse.json(
    {
      error: "Too many requests",
      message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      retryAfter,
      code: "RATE_LIMIT_EXCEEDED",
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

export async function middleware(request) {
  const path = request.nextUrl.pathname
  const ip = getClientIdentifier(request).split(":")[0]
  const method = request.method

  // Admin route protection with NextAuth
  if (path.startsWith("/admin") && 
    !path.startsWith("/admin/login") && 
    !path.startsWith("/api/admin")) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
      logger.warn(`Unauthorized admin access: ${path} from IP: ${ip}`)
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }

    // Check if user email matches admin email
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
    if (token.email !== adminEmail) {
      logger.warn(`Unauthorized admin access attempt: ${token.email} from IP: ${ip}`)
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
  }

  // Rate limiting for API routes
  if (path.startsWith("/api/")) {
    // Skip rate limiting for NextAuth routes
    if (path.startsWith("/api/auth/")) {
      return NextResponse.next()
    }

    try {
      const tokenKey = getClientIdentifier(request)
      let limitResult

      if (path.startsWith("/api/pin/redeem")) {
        limitResult = await redeemLimiter.check(tokenKey)
      } else if (path.startsWith("/api/admin/")) {
        limitResult = await adminLimiter.check(tokenKey)
      } else if (path.startsWith("/api/sse")) {
        limitResult = await sseLimiter.check(tokenKey)
      } else {
        limitResult = await apiLimiter.check(tokenKey)
      }

      if (!limitResult.success) {
        logger.warn(`Rate limit exceeded: ${method} ${path} from ${ip}`)
        return createRateLimitResponse(limitResult)
      }
    } catch (error) {
      if (error.statusCode === 429) {
        return createRateLimitResponse(error.rateLimitInfo)
      }
      logger.error(`Rate limiting error: ${error.message}`)
    }
  }

  // CORS and security headers
  if (path.startsWith("/api/")) {
    const response = NextResponse.next()
    const origin = request.headers.get("origin") || ""

    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      "https://hoklampung.vercel.app",
      "https://hoklampung.com",
      "https://www.hoklampung.com",
    ].filter(Boolean)

    if (allowedOrigins.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin)
    }

    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    )
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.set("Access-Control-Max-Age", "86400")

    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-XSS-Protection", "1; mode=block")
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

    if (process.env.NODE_ENV === "production") {
      response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
      response.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https:; frame-ancestors 'none';",
      )
    }

    if (method === "OPTIONS") {
      return new NextResponse(null, { status: 200, headers: response.headers })
    }

    if (process.env.LOG_API_REQUESTS === "true") {
      logger.info(`API: ${method} ${path} from ${ip}`)
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*", "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
}
