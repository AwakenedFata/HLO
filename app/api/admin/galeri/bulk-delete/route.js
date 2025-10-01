import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Gallery from "@/lib/models/galleryItems"
import { authorizeRequest } from "@/lib/utils/auth-server"
import { deleteFromS3 } from "@/lib/utils/s3"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for bulk delete endpoint
const bulkDeleteLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 50,
  limit: 5, // 5 bulk delete requests per minute
})

// POST bulk delete gallery items
export async function POST(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await bulkDeleteLimiter.check(identifier, 5)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many bulk delete requests. Please try again later.",
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

    // Authentication and authorization
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Gallery IDs array is required" }, { status: 400 })
    }

    // Limit bulk delete to 50 items at once
    if (ids.length > 50) {
      return NextResponse.json({ error: "Cannot delete more than 50 items at once" }, { status: 400 })
    }

    // Find galleries to delete
    const galleries = await Gallery.find({ _id: { $in: ids } })

    if (galleries.length === 0) {
      return NextResponse.json({ error: "No gallery items found" }, { status: 404 })
    }

    // Delete images from S3
    const s3DeletePromises = galleries
      .filter((gallery) => gallery.imageKey)
      .map(async (gallery) => {
        try {
          await deleteFromS3(gallery.imageKey)
          logger.info(`Image deleted from S3: ${gallery.imageKey}`)
          return { success: true, key: gallery.imageKey }
        } catch (s3Error) {
          logger.warn(`Failed to delete image from S3: ${gallery.imageKey} - ${s3Error.message}`)
          return { success: false, key: gallery.imageKey, error: s3Error.message }
        }
      })

    const s3Results = await Promise.allSettled(s3DeletePromises)

    // Delete from database
    const deleteResult = await Gallery.deleteMany({ _id: { $in: ids } })

    logger.info(`${deleteResult.deletedCount} gallery items bulk deleted by ${authResult.user.username}`)

    return NextResponse.json(
      {
        success: true,
        deletedCount: deleteResult.deletedCount,
        s3Results: s3Results.map((result) => result.value || result.reason),
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
