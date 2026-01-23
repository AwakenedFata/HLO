import { NextResponse } from "next/server"
import connectDB from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { requireAdmin } from "@/lib/utils/auth"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { resolveAdminIdFromSession } from "@/lib/utils/admin-guard"

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
  limit: 10,
})

export async function POST(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await limiter.check(identifier, 10, "batch-process-pins")
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rate.reset },
        {
          status: 429,
          headers: {
            "Retry-After": rate.reset.toString(),
            "X-RateLimit-Limit": rate.limit.toString(),
            "X-RateLimit-Remaining": rate.remaining.toString(),
            "X-RateLimit-Reset": rate.reset.toString(),
          },
        },
      )
    }

    await connectDB()

    // Auth
    let session
    try {
      session = await requireAdmin()
    } catch (err) {
      return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err?.statusCode || 401 })
    }

    const { pinIds } = await request.json()

    if (!pinIds || !Array.isArray(pinIds) || pinIds.length === 0) {
      return NextResponse.json({ error: "Valid PIN IDs array is required" }, { status: 400 })
    }
    if (pinIds.length > 100) {
      return NextResponse.json({ error: "Maximum batch size is 100 pins" }, { status: 400 })
    }

    const now = new Date()

    const adminId = await resolveAdminIdFromSession(session)

    const result = await PinCode.updateMany(
      { _id: { $in: pinIds }, used: true, processed: false },
      {
        $set: {
          processed: true,
          processedAt: now,
          processedBy: adminId, // set processedBy if schema supports it
        },
      },
    )

    if (result.modifiedCount === 0) {
      return NextResponse.json({
        message: "No pins were processed. They may already be processed or don't exist.",
        processed: 0,
      })
    }

    const processedPins = await PinCode.find({
      _id: { $in: pinIds },
      processed: true,
      processedAt: now,
    })
      .select("_id code")
      .lean()

    logger.info(`[admin] ${result.modifiedCount} PINs batch processed`)

    return NextResponse.json(
      {
        success: true,
        message: `${result.modifiedCount} PIN berhasil diproses`,
        processed: result.modifiedCount,
        processedAt: now,
        processedPins: processedPins.map((pin) => ({ _id: pin._id, code: pin.code })),
        timestamp: now.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "pins-batch-processed",
          "X-Update-Count": result.modifiedCount.toString(),
        },
      },
    )
  } catch (error) {
    logger.error("Error batch processing pins:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
