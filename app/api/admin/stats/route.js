import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Create a rate limiter for stats endpoint
const statsRateLimiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  limit: 10, // 10 requests per minute
  identifier: "admin-stats",
})

export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || request.ip || "anonymous"
    const rateLimitResult = await statsRateLimiter.check(identifier)

    // If rate limit exceeded, return 429 response
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          status: "error",
          message: "Too many requests. Please try again later.",
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

          // Get batch data
          batchesData: [
            {
              $project: {
                prefix: { $substr: ["$code", 0, 3] },
              },
            },
            {
              $group: {
                _id: "$prefix",
                count: { $sum: 1 },
              },
            },
            {
              $sort: { _id: 1 },
            },
            {
              $limit: 10, // Limit to top 10 batches for performance
            },
          ],

          // Get recent pins (last 10)
          recentPins: [
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
            {
              $project: {
                _id: 1,
                code: 1,
                used: 1,
                processed: 1,
                createdAt: 1,
              },
            },
          ],

          // Get recent usage (last 10)
          recentUsage: [
            { $match: { used: true } },
            { $sort: { "redeemedBy.redeemedAt": -1 } },
            { $limit: 10 },
            {
              $project: {
                _id: 1,
                code: 1,
                "redeemedBy.nama": 1,
                "redeemedBy.idGame": 1,
                "redeemedBy.redeemedAt": 1,
                processed: 1,
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

    // Convert batch data to the expected format
    const batches = statsAggregation[0].batchesData.map((batch, index) => ({
      id: index + 1,
      name: batch._id || "NO_PREFIX",
      count: batch.count,
    }))

    logger.info(`Statistik diakses oleh ${authResult.user.username}`)

    // Return optimized response with cache headers
    return NextResponse.json(
      {
        total: totalCount,
        used: usedCount,
        unused: totalCount - usedCount,
        pending: pendingCount,
        processed: usedCount - pendingCount,
        batches,
        recentPins: statsAggregation[0].recentPins,
        recentUsage: statsAggregation[0].recentUsage,
      },
      {
        headers: {
          // Add cache control headers
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": "60",
        },
      },
    )
  } catch (error) {
    logger.error("Error fetching stats:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
