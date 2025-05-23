import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// More generous rate limiter for count endpoint
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 60, // 60 requests per minute (every 1 second)
  identifier: "pending-pins-count",
})

export async function GET(request) {
  try {
    // Get identifier for rate limiting
    const identifier = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "anonymous"

    // Apply rate limiting with error handling
    try {
      await limiter.check(identifier)
    } catch (rateLimitError) {
      if (rateLimitError.statusCode === 429) {
        logger.warn(`Rate limit exceeded for pending-pins-count: ${identifier}`)
        return NextResponse.json(
          {
            error: "Too many requests. Please try again later.",
            reset: rateLimitError.rateLimitInfo?.reset || 60,
          },
          {
            status: 429,
            headers: {
              "Retry-After": (rateLimitError.rateLimitInfo?.reset || 60).toString(),
              "X-RateLimit-Limit": (rateLimitError.rateLimitInfo?.limit || 60).toString(),
              "X-RateLimit-Remaining": (rateLimitError.rateLimitInfo?.remaining || 0).toString(),
              "X-RateLimit-Reset": (rateLimitError.rateLimitInfo?.reset || 60).toString(),
            },
          },
        )
      }
      throw rateLimitError
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

    // Generate ETag based on count and timestamp (rounded to 30 seconds for stability)
    const roundedTime = Math.floor(Date.now() / 30000) * 30000
    const etag = `"count-${count}-${roundedTime}"`

    // Check if client has a valid cached version
    const ifNoneMatch = request.headers.get("if-none-match")
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=15, must-revalidate",
        },
      })
    }

    // Return response with caching headers
    return NextResponse.json(
      {
        count,
        lastUpdated: new Date(),
      },
      {
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=15, must-revalidate",
        },
      },
    )
  } catch (error) {
    // Don't log rate limit errors as errors
    if (error.statusCode !== 429) {
      logger.error("Error fetching pending pins count:", error)
    }

    return NextResponse.json(
      {
        error: "Server error",
        message: error.message,
      },
      { status: error.statusCode || 500 },
    )
  }
}
