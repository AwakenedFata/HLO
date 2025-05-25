import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import crypto from "crypto"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for pending pins endpoint
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 40, // 40 requests per minute
})

export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 40, "pending-pins")

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

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "50", 10), 100)
    const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10), 1)

    // Check for cache busting parameter
    const cacheBuster = searchParams.get("_t")
    const bypassCache = cacheBuster || request.headers.get("cache-control")?.includes("no-cache")

    // Validate parameters
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 })
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid limit parameter (1-100)" }, { status: 400 })
    }

    const skip = (page - 1) * limit

    // Use aggregation for better performance
    const [result] = await PinCode.aggregate([
      {
        $facet: {
          // Get pending pins with pagination
          pins: [
            { $match: { used: true, processed: false } },
            { $sort: { "redeemedBy.redeemedAt": -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                code: 1,
                "redeemedBy.nama": 1,
                "redeemedBy.idGame": 1,
                "redeemedBy.redeemedAt": 1,
              },
            },
          ],
          // Get total count
          totalCount: [{ $match: { used: true, processed: false } }, { $count: "count" }],
        },
      },
    ])

    const pendingPins = result.pins || []
    const totalCount = result.totalCount[0]?.count || 0

    logger.info(
      `Pending pins fetched by ${authResult.user.username}, page: ${page}, limit: ${limit}, count: ${totalCount}`,
    )

    const responseData = {
      pins: pendingPins,
      count: pendingPins.length,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      lastUpdated: new Date(),
    }

    // Prepare response headers
    const responseHeaders = {
      "X-Total-Count": totalCount.toString(),
      "X-Total-Pages": Math.ceil(totalCount / limit).toString(),
    }

    // Handle caching based on bypass cache flag
    if (bypassCache) {
      responseHeaders["Cache-Control"] = "no-store, no-cache, must-revalidate"
      responseHeaders["Pragma"] = "no-cache"
      responseHeaders["Expires"] = "0"
    } else {
      responseHeaders["Cache-Control"] = "private, max-age=15"

      // Generate ETag based on data
      const dataHash = crypto.createHash("md5").update(JSON.stringify(responseData)).digest("hex")
      responseHeaders["ETag"] = `"pending-${dataHash}"`

      // Check if client has cached version
      const ifNoneMatch = request.headers.get("if-none-match")
      if (ifNoneMatch === responseHeaders["ETag"]) {
        return new NextResponse(null, {
          status: 304,
          headers: responseHeaders,
        })
      }
    }

    return NextResponse.json(responseData, {
      headers: responseHeaders,
    })
  } catch (error) {
    logger.error("Error fetching pending pins:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
