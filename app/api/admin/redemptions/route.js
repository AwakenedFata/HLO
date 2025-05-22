import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import crypto from "crypto"

// Rate limiter for redemptions endpoint
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 30, // 30 requests per minute
})

export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 30, "redemptions")

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

    // Get URL parameters for pagination and filtering
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10)
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const sortField = searchParams.get("sort") || "redeemedAt"
    const sortDirection = searchParams.get("direction") || "desc"
    const searchTerm = searchParams.get("search")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Validate parameters
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 })
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid limit parameter (1-100)" }, { status: 400 })
    }

    const skip = (page - 1) * limit

    // Build query for filtering
    const query = { used: true }

    // Add search filter if provided
    if (searchTerm) {
      query.$or = [
        { code: { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.nama": { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.idGame": { $regex: searchTerm, $options: "i" } },
      ]
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      query["redeemedBy.redeemedAt"] = {}

      if (startDate) {
        const startDateTime = new Date(startDate)
        startDateTime.setHours(0, 0, 0, 0)
        query["redeemedBy.redeemedAt"].$gte = startDateTime
      }

      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        query["redeemedBy.redeemedAt"].$lte = endDateTime
      }
    }

    // Build sort object
    const sortObj = {}
    if (sortField === "redeemedAt") {
      sortObj["redeemedBy.redeemedAt"] = sortDirection === "asc" ? 1 : -1
    } else if (sortField === "nama") {
      sortObj["redeemedBy.nama"] = sortDirection === "asc" ? 1 : -1
    } else if (sortField === "idGame") {
      sortObj["redeemedBy.idGame"] = sortDirection === "asc" ? 1 : -1
    } else if (sortField === "processed") {
      sortObj["processed"] = sortDirection === "asc" ? 1 : -1
    } else {
      sortObj[sortField] = sortDirection === "asc" ? 1 : -1
    }

    // Execute query with pagination and sorting
    const [redemptions, totalCount] = await Promise.all([
      PinCode.find(query, {
        code: 1,
        used: 1,
        processed: 1,
        "redeemedBy.nama": 1,
        "redeemedBy.idGame": 1,
        "redeemedBy.redeemedAt": 1,
      })
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),

      // Get total count in parallel
      PinCode.countDocuments(query),
    ])

    logger.info(`Redemptions fetched by ${authResult.user.username}, page: ${page}, limit: ${limit}`)

    // Create a response object
    const responseData = {
      redemptions,
      count: redemptions.length,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      lastUpdated: new Date(),
    }

    // Generate ETag based on response data
    const dataHash = crypto.createHash("md5").update(JSON.stringify(responseData)).digest("hex")
    const etag = `"redemptions-${dataHash}"`

    // Check if client has a valid cached version
    const ifNoneMatch = request.headers.get("if-none-match")
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=60",
        },
      })
    }

    // Return response with caching headers
    return NextResponse.json(responseData, {
      headers: {
        ETag: etag,
        "Cache-Control": "private, max-age=60",
        "X-Total-Count": totalCount.toString(),
        "X-Total-Pages": Math.ceil(totalCount / limit).toString(),
      },
    })
  } catch (error) {
    logger.error("Error fetching redemptions:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
