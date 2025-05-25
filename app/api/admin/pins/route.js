import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import { validateRequest, pinCreationSchema } from "@/lib/utils/validation"
import { generateUniquePin } from "@/lib/utils/pinGenerator"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for GET endpoint
const getLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 30, // 30 requests per minute
})

// Rate limiter for POST endpoint
const postLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 10, // 10 requests per minute
})

// GET all pins with pagination and correct global stats
export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await getLimiter.check(identifier, 30, "get-pins")

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

    // Autentikasi dan otorisasi
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "500", 10)
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const skip = (page - 1) * limit

    // Check for cache busting parameter
    const cacheBuster = searchParams.get("_t")
    const bypassCache = cacheBuster || request.headers.get("cache-control")?.includes("no-cache")

    // Validate parameters
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 })
    }

    if (isNaN(limit) || limit < 1 || limit > 500) {
      return NextResponse.json({ error: "Invalid limit parameter (1-500)" }, { status: 400 })
    }

    const filterUsed = searchParams.get("used")
    const filterProcessed = searchParams.get("processed")
    const searchTerm = searchParams.get("search")

    // Query filter untuk data yang ditampilkan
    const query = {}
    if (filterUsed !== null) {
      query.used = filterUsed === "true"
    }
    if (filterProcessed !== null) {
      query.processed = filterProcessed === "true"
    }
    if (searchTerm) {
      query.$or = [
        { code: { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.nama": { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.idGame": { $regex: searchTerm, $options: "i" } },
      ]
    }

    const totalFiltered = await PinCode.countDocuments(query)

    const pins = await PinCode.find(query, {
      code: 1,
      used: 1,
      processed: 1,
      "redeemedBy.nama": 1,
      "redeemedBy.idGame": 1,
      "redeemedBy.redeemedAt": 1,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    // Calculate statistics from the entire collection
    const [totalAll, usedAll, pendingAll, processedAll] = await Promise.all([
      PinCode.countDocuments({}),
      PinCode.countDocuments({ used: true }),
      PinCode.countDocuments({ used: true, processed: false }),
      PinCode.countDocuments({ used: true, processed: true }),
    ])

    logger.info(`Pins fetched by ${authResult.user.username}, page: ${page}, limit: ${limit}`)

    // Prepare response headers
    const responseHeaders = {
      "X-Total-Count": totalFiltered.toString(),
      "X-Total-Pages": Math.ceil(totalFiltered / limit).toString(),
    }

    // Handle caching based on bypass cache flag
    if (bypassCache) {
      responseHeaders["Cache-Control"] = "no-store, no-cache, must-revalidate"
      responseHeaders["Pragma"] = "no-cache"
      responseHeaders["Expires"] = "0"
    } else {
      responseHeaders["Cache-Control"] = "private, max-age=30"

      // Generate ETag based on data
      const dataHash = require("crypto")
        .createHash("md5")
        .update(JSON.stringify({ pins, stats: { totalAll, usedAll, pendingAll, processedAll } }))
        .digest("hex")
      responseHeaders["ETag"] = `"pins-${dataHash}"`

      // Check if client has cached version
      const ifNoneMatch = request.headers.get("if-none-match")
      if (ifNoneMatch === responseHeaders["ETag"]) {
        return new NextResponse(null, {
          status: 304,
          headers: responseHeaders,
        })
      }
    }

    // Return response
    return NextResponse.json(
      {
        pins,
        total: totalFiltered,
        page,
        totalPages: Math.ceil(totalFiltered / limit),
        stats: {
          total: totalAll,
          used: usedAll,
          unused: totalAll - usedAll,
          available: totalAll - usedAll,
          pending: pendingAll,
          processed: processedAll,
        },
      },
      { headers: responseHeaders },
    )
  } catch (error) {
    logger.error("Error fetching pins:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

// POST generate new pins - optimized for batch operations with immediate response
export async function POST(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await postLimiter.check(identifier, 10, "generate-pins")

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
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const body = await request.json()

    // Validate request
    const validation = await validateRequest(pinCreationSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { count = 10, prefix = "" } = body

    // Limit the maximum number of pins that can be generated at once
    const maxPinsPerRequest = 1000
    if (count > maxPinsPerRequest) {
      return NextResponse.json(
        {
          error: `Maksimum ${maxPinsPerRequest} PIN dapat dibuat dalam satu permintaan`,
        },
        { status: 400 },
      )
    }

    // Generate PINs in batches for better performance
    const batchSize = 100
    const pins = []
    const now = new Date()
    const userId = authResult.user._id

    for (let i = 0; i < count; i += batchSize) {
      const batchCount = Math.min(batchSize, count - i)
      const batchPins = []

      for (let j = 0; j < batchCount; j++) {
        const code = await generateUniquePin(prefix)
        batchPins.push({
          code,
          used: false,
          processed: false,
          createdAt: now,
          createdBy: userId,
        })
      }

      // Insert batch
      const result = await PinCode.insertMany(batchPins, { ordered: true })
      pins.push(...result)
    }

    logger.info(`${pins.length} PIN baru dibuat oleh ${authResult.user.username}`)

    // Return immediate response with cache invalidation headers
    return NextResponse.json(
      {
        success: true,
        count: pins.length,
        message: `Berhasil generate ${pins.length} PIN baru`,
        timestamp: now.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "pin-generated",
          "X-Update-Count": pins.length.toString(),
        },
      },
    )
  } catch (error) {
    logger.error("Error generating pins:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
