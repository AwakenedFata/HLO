import { NextResponse } from "next/server"
import connectDB from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import logger from "@/lib/utils/logger-server"
import crypto from "crypto"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdminSession } from "@/lib/utils/auth"

// SOLUTION 2: Increased rate limit from 30 to 60 requests per minute
const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
  limit: 60, // Increased from 30
})

export async function GET(request) {
  try {
    // Auth with NextAuth - moved before rate limit for better security
    let session
    try {
      session = await requireAdminSession()
    } catch (err) {
      const status = err?.statusCode || 401
      return NextResponse.json({ error: err?.message || "Unauthorized" }, { status })
    }

    // SOLUTION 1: Rate limit check with proper error handling
    const identifier = request.headers.get("x-forwarded-for") || session.user?.email || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 60, "dashboard-stats")
    
    if (!rateLimitResult.success) {
      // Log the rate limit error
      logger.error("Rate limit exceeded for dashboard stats", {
        identifier,
        rateLimitInfo: rateLimitResult,
        statusCode: 429,
      })

      // Return immediately without proceeding to database query
      return NextResponse.json(
        { 
          error: "Too many requests. Please try again later.", 
          reset: rateLimitResult.reset,
          retryAfter: rateLimitResult.reset 
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

    await connectDB()

    const { searchParams } = new URL(request.url)

    const cacheBuster = searchParams.get("_t")
    const bypassCache = !!cacheBuster || request.headers.get("cache-control")?.includes("no-cache")

    const statsAggregation = await PinCode.aggregate([
      {
        $facet: {
          totalCount: [{ $count: "count" }],
          usedCount: [{ $match: { used: true } }, { $count: "count" }],
          pendingCount: [{ $match: { used: true, processed: false } }, { $count: "count" }],
          processedCount: [{ $match: { used: true, processed: true } }, { $count: "count" }],
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
            { $sort: { _id: 1 } },
          ],
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

    const totalCount = statsAggregation[0].totalCount[0]?.count || 0
    const usedCount = statsAggregation[0].usedCount[0]?.count || 0
    const pendingCount = statsAggregation[0].pendingCount[0]?.count || 0
    const processedCount = statsAggregation[0].processedCount[0]?.count || 0

    const batches = (statsAggregation[0].batchesData || []).map((batch, index) => ({
      id: index + 1,
      name: batch._id || "NO_PREFIX",
      count: batch.total,
      used: batch.used,
      pending: batch.pending,
      processed: batch.processed,
    }))

    const recentActivity = (statsAggregation[0].recentActivity || []).map((item) => ({
      code: item.code,
      processedAt: item.processedAt,
      redeemedBy: item.redeemedBy ? { nama: item.redeemedBy.nama, idGame: item.redeemedBy.idGame } : null,
    }))

    const responseData = {
      total: totalCount,
      used: usedCount,
      unused: totalCount - usedCount,
      available: totalCount - usedCount,
      pending: pendingCount,
      processed: processedCount,
      batches,
      recentActivity,
      lastUpdated: new Date(),
    }

    const responseHeaders = {
      "X-Total-Count": totalCount.toString(),
      "X-Last-Updated": new Date().toISOString(),
    }

    if (bypassCache) {
      responseHeaders["Cache-Control"] = "no-store, no-cache, must-revalidate"
      responseHeaders["Pragma"] = "no-cache"
      responseHeaders["Expires"] = "0"
    } else {
      // SOLUTION 4: Better cache control - cache for 15 seconds instead of 30
      responseHeaders["Cache-Control"] = "private, max-age=15, stale-while-revalidate=30"
      const dataHash = crypto.createHash("md5").update(JSON.stringify(responseData)).digest("hex")
      responseHeaders["ETag"] = `"stats-${dataHash}"`
      const ifNoneMatch = request.headers.get("if-none-match")
      if (ifNoneMatch === responseHeaders["ETag"]) {
        return new NextResponse(null, { status: 304, headers: responseHeaders })
      }
    }

    logger.info(`Dashboard stats accessed by ${session.user?.email || "unknown"}`)

    return NextResponse.json(responseData, { headers: responseHeaders })
  } catch (error) {
    logger.error("Error fetching dashboard stats:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}