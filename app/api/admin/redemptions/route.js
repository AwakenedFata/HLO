import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import crypto from "crypto"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for redemptions endpoint
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 40, // 40 requests per minute
})

export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 40, "redemptions")

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
    const sortField = searchParams.get("sort") || "redeemedAt"
    const sortDirection = searchParams.get("direction") || "desc"
    const searchTerm = searchParams.get("search")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

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

    // Build aggregation pipeline for better performance
    const pipeline = []

    // Match stage - hanya PIN yang sudah digunakan (used: true)
    const matchStage = {
      used: true,
    }

    // Add search filter if provided
    if (searchTerm) {
      matchStage.$or = [
        { code: { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.nama": { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.idGame": { $regex: searchTerm, $options: "i" } },
      ]
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      const dateFilter = {}

      if (startDate) {
        const startDateTime = new Date(startDate)
        startDateTime.setHours(0, 0, 0, 0)
        dateFilter.$gte = startDateTime
      }

      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        dateFilter.$lte = endDateTime
      }

      matchStage["redeemedBy.redeemedAt"] = dateFilter
    }

    pipeline.push({ $match: matchStage })

    // Debug logging untuk melihat berapa banyak data yang cocok
    console.log("Match stage:", JSON.stringify(matchStage, null, 2))

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

    // Use facet to get both data and count in one query
    pipeline.push({
      $facet: {
        redemptions: [
          { $sort: sortObj },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              code: 1,
              used: 1,
              processed: 1,
              processedAt: 1,
              redeemedBy: 1,
              createdAt: 1,
              // Fallback fields jika redeemedBy tidak ada
              redeemedAt: { $ifNull: ["$redeemedBy.redeemedAt", "$processedAt"] },
              nama: { $ifNull: ["$redeemedBy.nama", "Data tidak tersedia"] },
              idGame: { $ifNull: ["$redeemedBy.idGame", "Data tidak tersedia"] },
            },
          },
        ],
        totalCount: [{ $count: "count" }],
        // Debug: ambil sample data untuk melihat struktur
        sampleData: [
          { $limit: 3 },
          {
            $project: {
              _id: 1,
              code: 1,
              used: 1,
              processed: 1,
              redeemedBy: 1,
              hasRedeemedBy: { $type: "$redeemedBy" },
              redeemedByKeys: { $objectToArray: "$redeemedBy" },
            },
          },
        ],
      },
    })

    const [result] = await PinCode.aggregate(pipeline)

    // Setelah const [result] = await PinCode.aggregate(pipeline)
    console.log("Raw database sample (first 3 documents):")
    const rawSample = await PinCode.find({ used: true }).limit(3).lean()
    console.log(JSON.stringify(rawSample, null, 2))

    const redemptions = result.redemptions || []
    const totalCount = result.totalCount[0]?.count || 0
    const sampleData = result.sampleData || []

    // Log sample data untuk debugging
    console.log("Sample data for debugging:", JSON.stringify(sampleData, null, 2))
    console.log("Total redemptions found:", totalCount)
    console.log("Redemptions returned:", redemptions.length)

    if (redemptions.length > 0) {
      console.log("First redemption structure:", JSON.stringify(redemptions[0], null, 2))
    }

    logger.info(
      `Redemptions fetched by ${authResult.user.username}, page: ${page}, limit: ${limit}, count: ${totalCount}`,
    )

    const responseData = {
      redemptions,
      count: redemptions.length,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      sampleData, // Include sample data for debugging
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
      responseHeaders["Cache-Control"] = "private, max-age=30"

      // Generate ETag based on data
      const dataHash = crypto.createHash("md5").update(JSON.stringify(responseData)).digest("hex")
      responseHeaders["ETag"] = `"redemptions-${dataHash}"`

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
    logger.error("Error fetching redemptions:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
