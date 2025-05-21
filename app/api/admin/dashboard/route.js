// File: /app/api/admin/dashboard/route.js

import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import logger from "@/lib/utils/logger-server"

// PERBAIKAN: Tingkatkan rate limit
const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
  limit: 20, // Tingkatkan dari 10 ke 20
})

export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 20, "dashboard-stats")

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          reset: rateLimitResult.reset,
        },
        { 
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.reset.toString(),
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          },
        }
      )
    }

    // Authenticate the request
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    // PERBAIKAN: Gunakan Redis cache
    const cacheKey = `dashboard:stats`
    const cachedData = await getCache(cacheKey)
    
    if (cachedData) {
      logger.info(`Serving dashboard stats from cache for user ${authResult.user.username}`)
      return NextResponse.json(cachedData, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-Cache": "HIT",
        },
      })
    }

    await connectToDatabase()

    // PERBAIKAN: Gunakan method statis yang sudah dioptimasi
    const stats = await PinCode.getDashboardStats();

    logger.info(`Dashboard stats fetched by ${authResult.user.username}`)

    // PERBAIKAN: Simpan ke Redis cache
    await setCache(cacheKey, stats, 300); // Cache selama 5 menit

    return NextResponse.json(
      stats,
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-Cache": "MISS",
        },
      }
    )
  } catch (error) {
    logger.error("Error fetching dashboard stats:", error)

    // Handle rate limit exceeded
    if (error.statusCode === 429) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
    }

    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 })
  }
}