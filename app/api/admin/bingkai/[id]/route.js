import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Frame from "@/lib/models/frame"
import { authorizeRequest } from "@/lib/utils/auth-server"
import { deleteFromS3 } from "@/lib/utils/s3"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for all endpoints
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 20, // 20 requests per minute
})

// GET single frame
export async function GET(request, { params }) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 20)

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

    await connectToDatabase()

    // Authentication and authorization
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const { id } = params

    if (!id) {
      return NextResponse.json({ error: "Frame ID is required" }, { status: 400 })
    }

    const frame = await Frame.findById(id)
      .populate("relatedGallery", "title label")
      .populate("createdBy", "username")
      .populate("updatedBy", "username")

    if (!frame) {
      return NextResponse.json({ error: "Frame not found" }, { status: 404 })
    }

    logger.info(`Frame ${id} fetched by ${authResult.user.username}`)

    return NextResponse.json({
      success: true,
      frame,
    })
  } catch (error) {
    logger.error("Error fetching frame:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

// DELETE frame
export async function DELETE(request, { params }) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 10)

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

    await connectToDatabase()

    // Authentication and authorization
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const { id } = params

    if (!id) {
      return NextResponse.json({ error: "Frame ID is required" }, { status: 400 })
    }

    const frame = await Frame.findById(id)

    if (!frame) {
      return NextResponse.json({ error: "Frame not found" }, { status: 404 })
    }

    // Delete image from S3
    try {
      if (frame.imageKey) {
        await deleteFromS3(frame.imageKey)
        logger.info(`Frame image deleted from S3: ${frame.imageKey}`)
      }
    } catch (s3Error) {
      logger.warn(`Failed to delete frame image from S3: ${s3Error.message}`)
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete from database
    await Frame.findByIdAndDelete(id)

    logger.info(`Frame ${id} deleted by ${authResult.user.username}`)

    return NextResponse.json(
      {
        success: true,
        message: "Frame berhasil dihapus",
      },
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
