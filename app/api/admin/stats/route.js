import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import crypto from "crypto"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for stats endpoint
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 30, // Increased limit for dashboard
})

export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 30, "dashboard-stats")

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

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    await connectToDatabase()

    const { searchParams } = new URL(request.url)

    // Check for cache busting parameter
    const cacheBuster = searchParams.get("_t")
    const bypassCache = cacheBuster || request.headers.get("cache-control")?.includes("no-cache")

    // Use aggregation pipeline for more efficient statistics calculation
    const statsAggregation = await PinCode.aggregate([
      {
        $facet: {
          // Count total pins
          totalCount: [{ $count: "count" }],

          // Count used pins
          usedCount: [{ $match: { used: true } }, { $count: "count" }],

          // Count pending pins
          pendingCount: [{ $match: { used: true, processed: false } }, { $count: "count" }],

          // Count processed pins
          processedCount: [{ $match: { used: true, processed: true } }, { $count: "count" }],

          // Get batch data
          batchesData: [
            {
              $project: {
                prefix: { $substr: ["$code", 0, 3] },
                used: 1,
                processed: 1,
              },
            },
            {
              $group: {
                _id: "$prefix",
                total: { $sum: 1 },
                used: { $sum: { $cond: ["$used", 1, 0] } },
                pending: {
                  $sum: {
                    $cond: [{ $and: ["$used", { $eq: ["$processed", false] }] }, 1, 0],
                  },
                },
                processed: {
                  $sum: {
                    $cond: [{ $and: ["$used", "$processed"] }, 1, 0],
                  },
                },
              },
            },
            {
              $sort: { _id: 1 },
            },
          ],

          // Get recent activity (last 10 processed pins)
          recentActivity: [
            { $match: { processed: true, processedAt: { $exists: true } } },
            { $sort: { processedAt: -1 } },
            { $limit: 10 },
            {
              $project: {
                code: 1,
                processedAt: 1,
                "redeemedBy.nama": 1,
                "redeemedBy.idGame": 1,
              },
            },
          ],
        },
      },
    ]).exec()

    // Extract values from aggregation result
    const totalCount = statsAggregation[0].totalCount[0]?.count || 0
    const usedCount = statsAggregation[0].usedCount[0]?.count || 0
    const pendingCount = statsAggregation[0].pendingCount[0]?.count || 0
    const processedCount = statsAggregation[0].processedCount[0]?.count || 0

    // Convert batch data to the expected format
    const batches = statsAggregation[0].batchesData.map((batch, index) => ({
      id: index + 1,
      name: batch._id || "NO_PREFIX",
      count: batch.total,
      used: batch.used,
      pending: batch.pending,
      processed: batch.processed,
    }))

    // Format recent activity
    const recentActivity = statsAggregation[0].recentActivity.map((item) => ({
      code: item.code,
      processedAt: item.processedAt,
      redeemedBy: item.redeemedBy
        ? {
            nama: item.redeemedBy.nama,
            idGame: item.redeemedBy.idGame,
          }
        : null,
    }))

    // Create response data
    const responseData = {
      total: totalCount,
      used: usedCount,
      unused: totalCount - usedCount,
      available: totalCount - usedCount, // Alias for unused
      pending: pendingCount,
      processed: processedCount,
      batches,
      recentActivity,
      lastUpdated: new Date(),
    }

    // Prepare response headers
    const responseHeaders = {
      "X-Total-Count": totalCount.toString(),
      "X-Last-Updated": new Date().toISOString(),
    }

    // Handle caching based on bypass cache flag
    if (bypassCache) {
      responseHeaders["Cache-Control"] = "no-store, no-cache, must-revalidate"
      responseHeaders["Pragma"] = "no-cache"
      responseHeaders["Expires"] = "0"
    } else {
      responseHeaders["Cache-Control"] = "private, max-age=30"

      // Generate ETag based on response data
      const dataHash = crypto.createHash("md5").update(JSON.stringify(responseData)).digest("hex")
      responseHeaders["ETag"] = `"stats-${dataHash}"`

      // Check if client has a valid cached version
      const ifNoneMatch = request.headers.get("if-none-match")
      if (ifNoneMatch === responseHeaders["ETag"]) {
        return new NextResponse(null, {
          status: 304,
          headers: responseHeaders,
        })
      }
    }

    logger.info(`Dashboard stats accessed by ${authResult.user.username}`)

    // Return optimized response with caching headers
    return NextResponse.json(responseData, {
      headers: responseHeaders,
    })
  } catch (error) {
    logger.error("Error fetching dashboard stats:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
