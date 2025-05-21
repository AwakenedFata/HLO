import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authMiddleware } from "@/lib/middleware/authMiddleware"
import { rateLimit } from "@/lib/utils/rate-limit"

// Create a rate limiter that allows 10 requests per minute
const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 100, // Max 100 users per interval
  limit: 10, // 10 requests per interval
})

export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    await limiter.check(identifier, 10, "dashboard-stats")

    // Authenticate the request
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    await connectToDatabase()

    // Use aggregation for better performance
    const stats = await PinCode.aggregate([
      {
        $facet: {
          // Count total pins
          total: [{ $count: "count" }],

          // Count used pins
          used: [{ $match: { used: true } }, { $count: "count" }],

          // Count pending pins (used but not processed)
          pending: [{ $match: { used: true, processed: false } }, { $count: "count" }],

          // Group by batch for batch statistics
          batches: [
            {
              $group: {
                _id: "$batch",
                count: { $sum: 1 },
                name: { $first: "$batchName" },
              },
            },
            { $sort: { _id: 1 } },
            { $limit: 10 }, // Limit to 10 most recent batches
          ],
        },
      },
    ])

    // Process the aggregation results
    const result = stats[0]
    const totalCount = result.total[0]?.count || 0
    const usedCount = result.used[0]?.count || 0
    const pendingCount = result.pending[0]?.count || 0

    // Format batches
    const batches = result.batches.map((batch) => ({
      id: batch._id,
      name: batch.name || `Batch ${batch._id}`,
      count: batch.count,
    }))

    return NextResponse.json(
      {
        total: totalCount,
        used: usedCount,
        unused: totalCount - usedCount,
        pending: pendingCount,
        batches: batches,
      },
      {
        headers: {
          // Add cache control headers
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    )
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)

    // Handle rate limit exceeded
    if (error.statusCode === 429) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
    }

    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 })
  }
}
