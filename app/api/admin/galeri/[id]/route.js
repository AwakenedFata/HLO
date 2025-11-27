import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Gallery from "@/lib/models/galleryItems"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"
import { validateRequest, galleryUpdateSchema } from "@/lib/utils/validation"
import { deleteFromS3 } from "@/lib/utils/r2"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { resolveAdminIdFromSession } from "@/lib/utils/admin-guard"

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
  limit: 20,
})

export async function GET(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 20)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rateLimitResult.reset },
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

    const guard = await requireAdminSession()
    if (!guard.ok) {
      return NextResponse.json({ status: "error", message: guard.message }, { status: guard.status })
    }
    const { id } = params
    if (!id) return NextResponse.json({ error: "Gallery ID is required" }, { status: 400 })

    await connectToDatabase()

    const gallery = await Gallery.findById(id).populate("createdBy", "username").populate("updatedBy", "username")
    if (!gallery) return NextResponse.json({ error: "Gallery item not found" }, { status: 404 })

    logger.info(`Gallery item ${id} fetched`)
    return NextResponse.json({ success: true, gallery })
  } catch (error) {
    logger.error("Error fetching gallery item:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 15)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rateLimitResult.reset },
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
    const adminId = await resolveAdminIdFromSession(session)

    const { id } = params
    if (!id) return NextResponse.json({ error: "Gallery ID is required" }, { status: 400 })

    const body = await request.json()
    const validation = await validateRequest(galleryUpdateSchema, body)
    if (!validation.success) return NextResponse.json(validation.error, { status: 400 })

    const updateData = { ...validation.data }
    if (updateData.uploadDate) updateData.uploadDate = new Date(updateData.uploadDate)
    updateData.updatedBy = adminId // use Admin ObjectId
    updateData.updatedAt = new Date()

    const gallery = await Gallery.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate("createdBy", "username")
      .populate("updatedBy", "username")

    if (!gallery) return NextResponse.json({ error: "Gallery item not found" }, { status: 404 })

    logger.info(`Gallery item ${id} updated by ${session.user.email}`)
    return NextResponse.json(
      { success: true, gallery, message: "Gallery item berhasil diupdate" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "gallery-updated",
        },
      },
    )
  } catch (error) {
    logger.error("Error updating gallery item:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 10)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rateLimitResult.reset },
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

    try {
      await requireAdmin()
    } catch (err) {
      const status = err?.statusCode || 401
      return NextResponse.json({ status: "error", message: err?.message || "Unauthorized" }, { status })
    }

    const { id } = params
    if (!id) return NextResponse.json({ error: "Gallery ID is required" }, { status: 400 })

    const gallery = await Gallery.findById(id)
    if (!gallery) return NextResponse.json({ error: "Gallery item not found" }, { status: 404 })

    // delete image from S3 if exists
    try {
      if (gallery.imageKey) {
        await deleteFromS3(gallery.imageKey)
        logger.info(`Image deleted from S3: ${gallery.imageKey}`)
      }
    } catch (s3Error) {
      logger.warn(`Failed to delete image from S3: ${s3Error.message}`)
      // continue
    }

    await Gallery.findByIdAndDelete(id)
    logger.info(`Gallery item ${id} deleted`)

    return NextResponse.json(
      { success: true, message: "Gallery item berhasil dihapus" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "gallery-deleted",
        },
      },
    )
  } catch (error) {
    logger.error("Error deleting gallery item:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
