import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Banner from "@/lib/models/banner"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for GET endpoint
const getLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 60, // 60 requests per minute
})

// GET current active banner
export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await getLimiter.check(identifier, 60)

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
        },
      )
    }

    await connectToDatabase()

    // Authentication and authorization
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    // Find the most recent active banner
    const currentBanner = await Banner.findOne({ isActive: true })
      .populate("createdBy", "username")
      .populate("updatedBy", "username")
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean()

    if (!currentBanner) {
      return NextResponse.json(
        {
          success: true,
          banner: null,
          message: "No active banner found",
        },
        {
          headers: {
            "Cache-Control": "private, max-age=30",
          },
        },
      )
    }

    logger.info(`Current banner fetched by ${authResult.user.username}: ${currentBanner._id}`)

    return NextResponse.json(
      {
        success: true,
        banner: currentBanner,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      },
    )
  } catch (error) {
    logger.error("Error fetching current banner:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
