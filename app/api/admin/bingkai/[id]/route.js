import { NextResponse } from "next/server"
import connectDB from "@/lib/db"
import Frame from "@/lib/models/frame"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"
import { deleteFromS3 } from "@/lib/utils/r2"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

const limiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 100, limit: 20 })
const delLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 100, limit: 10 })

export async function GET(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await limiter.check(identifier, 20)
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

    try {
      await requireAdminSession()
    } catch (err) {
      return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err?.statusCode || 401 })
    }

    await connectDB()

    const { id } = params
    if (!id) return NextResponse.json({ error: "Frame ID is required" }, { status: 400 })

    const frame = await Frame.findById(id)
      .populate("relatedGallery", "title label")
      .populate("createdBy", "username")
      .populate("updatedBy", "username")

    if (!frame) return NextResponse.json({ error: "Frame not found" }, { status: 404 })

    logger.info(`[admin] Frame ${id} fetched`)
    return NextResponse.json({ success: true, frame })
  } catch (error) {
    logger.error("Error fetching frame:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await delLimiter.check(identifier, 10)
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

    try {
      await requireAdmin()
    } catch (err) {
      return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err?.statusCode || 401 })
    }

    const { id } = params
    if (!id) return NextResponse.json({ error: "Frame ID is required" }, { status: 400 })

    const frame = await Frame.findById(id)
    if (!frame) return NextResponse.json({ error: "Frame not found" }, { status: 404 })

    try {
      if (frame.imageKey) {
        await deleteFromS3(frame.imageKey)
        logger.info(`[admin] Frame image deleted from S3: ${frame.imageKey}`)
      }
    } catch (s3Error) {
      logger.warn(`[admin] Failed to delete frame image from S3: ${s3Error.message}`)
    }

    await Frame.findByIdAndDelete(id)

    logger.info(`[admin] Frame ${id} deleted`)
    return NextResponse.json(
      { success: true, message: "Frame berhasil dihapus" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "frame-deleted",
        },
      },
    )
  } catch (error) {
    logger.error("Error deleting frame:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
