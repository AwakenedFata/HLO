import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Create a rate limiter for redemptions endpoint
const redemptionsRateLimiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  limit: 10, // 10 requests per minute
  identifier: "redemptions",
})

export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || request.ip || "anonymous"
    const rateLimitResult = await redemptionsRateLimiter.check(identifier)

    // If rate limit exceeded, return 429 response
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          reset: 60,
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": "60",
          },
        },
      )
    }

    await connectToDatabase()

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    // Get URL parameters for pagination
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10)
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const search = searchParams.get("search") || ""
    const startDate = searchParams.get("startDate") || ""
    const endDate = searchParams.get("endDate") || ""

    // Validate pagination parameters
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid pagination parameters" }, { status: 400 })
    }

    const skip = (page - 1) * limit

    // Build query for redeemed pins
    const query = { used: true }

    // Add search filter if provided
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { "redeemedBy.nama": { $regex: search, $options: "i" } },
        { "redeemedBy.idGame": { $regex: search, $options: "i" } },
      ]
    }

    // Add date range filter if provided
    if (startDate && endDate) {
      query["redeemedBy.redeemedAt"] = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)), // End of the day
      }
    } else if (startDate) {
      query["redeemedBy.redeemedAt"] = { $gte: new Date(startDate) }
    } else if (endDate) {
      query["redeemedBy.redeemedAt"] = { $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) }
    }

    // Use lean() for better performance and only select needed fields
    const [redemptions, totalCount] = await Promise.all([
      PinCode.find(query, {
        _id: 1,
        code: 1,
        processed: 1,
        "redeemedBy.nama": 1,
        "redeemedBy.idGame": 1,
        "redeemedBy.redeemedAt": 1,
      })
        .sort({ "redeemedBy.redeemedAt": -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .hint({ "redeemedBy.redeemedAt": -1 }), // Add index hint for better query performance

      // Get total count in parallel
      PinCode.countDocuments(query),
    ])

    logger.info(`Redemptions fetched by ${authResult.user.username}, page: ${page}, limit: ${limit}`)

    return NextResponse.json(
      {
        redemptions,
        count: redemptions.length,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      {
        headers: {
          // Add cache control headers
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    )
  } catch (error) {
    logger.error("Error fetching redemptions:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
