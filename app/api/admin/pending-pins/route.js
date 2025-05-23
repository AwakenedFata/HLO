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
  limit: 60, // 60 requests per minute
  identifier: "pending-pins", // Optional identifier key
})

export async function GET(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"

    // Apply rate limiting
    const rateLimitResult = await limiter.check(identifier)

    await connectToDatabase()

    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10)
    const page = Number.parseInt(searchParams.get("page") || "1", 10)

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

    logger.info(`Pending pins fetched by ${authResult.user.username}, page: ${page}, limit: ${limit}`)

    const responseData = {
      pins: pendingPins,
      count: pendingPins.length,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      lastUpdated: new Date(),
    }

    const dataHash = crypto.createHash("md5").update(JSON.stringify(responseData)).digest("hex")
    const etag = `"pins-${dataHash}"`

    const ifNoneMatch = request.headers.get("if-none-match")
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=30",
        },
      })
    }

    return NextResponse.json(responseData, {
      headers: {
        ETag: etag,
        "Cache-Control": "private, max-age=30",
        "X-Total-Count": totalCount.toString(),
        "X-Total-Pages": Math.ceil(totalCount / limit).toString(),
      },
    })
  } catch (error) {
    logger.error("Error fetching pending pins:", error)
    return NextResponse.json(
      {
        error: "Server error",
        message: error.message,
      },
      { status: 500 },
    )
  }
}
