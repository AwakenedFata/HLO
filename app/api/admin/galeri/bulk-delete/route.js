import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Gallery from "@/lib/models/galleryItems"
import { requireAdmin } from "@/lib/utils/auth"
import { deleteFromS3 } from "@/lib/utils/r2"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

const bulkDeleteLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 50,
  limit: 5,
})

export async function POST(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await bulkDeleteLimiter.check(identifier, 5)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many bulk delete requests. Please try again later.", reset: rateLimitResult.reset },
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

    let session
    try {
      session = await requireAdmin()
    } catch (err) {
      const status = err?.statusCode || 401
      return NextResponse.json({ status: "error", message: err?.message || "Unauthorized" }, { status })
    }

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Gallery IDs array is required" }, { status: 400 })
    }
    if (ids.length > 50) {
      return NextResponse.json({ error: "Cannot delete more than 50 items at once" }, { status: 400 })
    }

    const galleries = await Gallery.find({ _id: { $in: ids } })
    if (galleries.length === 0) {
      return NextResponse.json({ error: "No gallery items found" }, { status: 404 })
    }

    const s3DeletePromises = galleries
      .filter((g) => g.imageKey)
      .map(async (g) => {
        try {
          await deleteFromS3(g.imageKey)
          logger.info(`Image deleted from S3: ${g.imageKey}`)
          return { success: true, key: g.imageKey }
        } catch (s3Error) {
          logger.warn(`Failed to delete image from S3: ${g.imageKey} - ${s3Error.message}`)
          return { success: false, key: g.imageKey, error: s3Error.message }
        }
      })

    const s3Results = await Promise.allSettled(s3DeletePromises)
    const deleteResult = await Gallery.deleteMany({ _id: { $in: ids } })

    logger.info(`${deleteResult.deletedCount} gallery items bulk deleted by ${session.user.email}`)

    return NextResponse.json(
      {
        success: true,
        deletedCount: deleteResult.deletedCount,
        s3Results: s3Results.map((r) => r.value || r.reason),
        message: `${deleteResult.deletedCount} gallery items berhasil dihapus`,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "gallery-bulk-deleted",
        },
      },
    )
  } catch (error) {
    logger.error("Error bulk deleting gallery items:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
