import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Create a rate limiter for pending pins count endpoint
// Higher limit since this is likely called frequently for UI updates
const pendingPinsCountRateLimiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  limit: 60, // 60 requests per minute (1 per second)
  identifier: "pending-pins-count",
})

export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || request.ip || "anonymous"
    const rateLimitResult = await pendingPinsCountRateLimiter.check(identifier)

    // If rate limit exceeded, return 429 response
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          reset: rateLimitResult.reset,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.reset,
            "X-RateLimit-Limit": rateLimitResult.limit,
            "X-RateLimit-Remaining": rateLimitResult.remaining,
            "X-RateLimit-Reset": rateLimitResult.reset,
          },
        },
      )
    }

    await connectToDatabase()

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    // Only count pending pins (used but not processed)
    const count = await PinCode.countDocuments({ used: true, processed: false })

    logger.info(`Pending pins count fetched by ${authResult.user.username}: ${count}`)

    // Return with cache headers - shorter cache time since this changes frequently
    return NextResponse.json(
      { count },
      {
        headers: {
          // Cache for 30 seconds, but allow stale data for up to 2 minutes while revalidating
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": rateLimitResult.reset.toString(),
        },
      },
    )
  } catch (error) {
    logger.error("Error fetching pending pins count:", error)

    // Handle rate limit exceeded
    if (error.statusCode === 429) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
