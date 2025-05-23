import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import crypto from "crypto"
import { rateLimit } from "@/lib/utils/rate-limit"

// More generous rate limiter for pending pins endpoint
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 30, // 30 requests per minute (every 2 seconds)
  identifier: "pending-pins",
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
        logger.warn(`Rate limit exceeded for pending-pins: ${identifier}`)
        return NextResponse.json(
          {
            error: "Too many requests. Please try again later.",
            reset: rateLimitError.rateLimitInfo?.reset || 60,
          },
          {
            status: 429,
            headers: {
              "Retry-After": (rateLimitError.rateLimitInfo?.reset || 60).toString(),
              "X-RateLimit-Limit": (rateLimitError.rateLimitInfo?.limit || 30).toString(),
              "X-RateLimit-Remaining": (rateLimitError.rateLimitInfo?.remaining || 0).toString(),
              "X-RateLimit-Reset": (rateLimitError.rateLimitInfo?.reset || 60).toString(),
            },
          },
        )
      }
      throw rateLimitError
    }

    await connectToDatabase()

    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "50", 10), 100)
    const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10), 1)

    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 })
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid limit parameter" }, { status: 400 })
    }

    const skip = (page - 1) * limit

    const [pendingPins, totalCount] = await Promise.all([
      PinCode.find(
        { used: true, processed: false },
        {
          _id: 1,
          code: 1,
          "redeemedBy.nama": 1,
          "redeemedBy.idGame": 1,
          "redeemedBy.redeemedAt": 1,
        },
      )
        .sort({ "redeemedBy.redeemedAt": -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      PinCode.countDocuments({ used: true, processed: false }),
    ])

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

    // Create more stable ETag
    const dataForHash = {
      total: totalCount,
      page,
      limit,
      pins: pendingPins.map((p) => ({ id: p._id, code: p.code, redeemedAt: p.redeemedBy?.redeemedAt })),
    }
    const dataHash = crypto.createHash("md5").update(JSON.stringify(dataForHash)).digest("hex")
    const etag = `"pins-${dataHash}"`

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

    return NextResponse.json(responseData, {
      headers: {
        ETag: etag,
        "Cache-Control": "private, max-age=15, must-revalidate",
        "X-Total-Count": totalCount.toString(),
        "X-Total-Pages": Math.ceil(totalCount / limit).toString(),
      },
    })
  } catch (error) {
    // Don't log rate limit errors as errors
    if (error.statusCode !== 429) {
      logger.error("Error fetching pending pins:", error)
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
