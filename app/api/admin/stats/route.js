import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"

export async function GET(request) {
  try {
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

    // Return optimized response
    return NextResponse.json({
      total: totalCount,
      used: usedCount,
      unused: totalCount - usedCount,
      pending: pendingCount,
      processed: usedCount - pendingCount,
      batches,
    })
  } catch (error) {
    logger.error("Error fetching stats:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
