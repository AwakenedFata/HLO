import { NextResponse } from "next/server"
import connectDB from "@/lib/db"
import Frame from "@/lib/models/frame"
import { requireAdmin } from "@/lib/utils/auth"
import { validateRequest, frameBulkDeleteSchema } from "@/lib/utils/validation"
import { deleteFromS3 } from "@/lib/utils/r2"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

const bulkDeleteLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 50, limit: 5 })

export async function POST(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await bulkDeleteLimiter.check(identifier, 5)
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many bulk delete requests. Please try again later.", reset: rate.reset },
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

    try {
      await requireAdmin(request)
    } catch (err) {
      return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err?.statusCode || 401 })
    }

    const body = await request.json()
    const validation = await validateRequest(frameBulkDeleteSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { ids } = validation.data
    const frames = await Frame.find({ _id: { $in: ids } })
    if (frames.length === 0) {
      return NextResponse.json({ error: "No frames found" }, { status: 404 })
    }

    const s3DeletePromises = frames
      .filter((f) => f.imageKey)
      .map(async (f) => {
        try {
          await deleteFromS3(f.imageKey)
          logger.info(`[admin] Frame image deleted from S3: ${f.imageKey}`)
          return { success: true, key: f.imageKey }
        } catch (e) {
          logger.warn(`[admin] Failed to delete frame image from S3: ${f.imageKey} - ${e.message}`)
          return { success: false, key: f.imageKey, error: e.message }
        }
      })

    const s3Results = await Promise.allSettled(s3DeletePromises)

    const deleteResult = await Frame.deleteMany({ _id: { $in: ids } })
    logger.info(`[admin] ${deleteResult.deletedCount} frames bulk deleted`)

    return NextResponse.json(
      {
        success: true,
        deletedCount: deleteResult.deletedCount,
        s3Results: s3Results.map((r) => r.value || r.reason),
        message: `${deleteResult.deletedCount} frame berhasil dihapus`,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "frames-bulk-deleted",
        },
      },
    )
  } catch (error) {
    logger.error("Error bulk deleting frames:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
