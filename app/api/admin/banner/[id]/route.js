import { NextResponse } from "next/server"
import { revalidatePath } from 'next/cache'
import connectToDatabase from "@/lib/db"
import Banner from "@/lib/models/banner"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"
import { validateRequest, bannerUpdateSchema } from "@/lib/utils/validation"
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

    const guard = await requireAdminSession()
    if (!guard.ok) {
      return NextResponse.json({ error: guard.message }, { status: guard.status })
    }
    const { session } = guard

    await connectToDatabase()
    const { id } = params
    if (!id) return NextResponse.json({ error: "Banner ID is required" }, { status: 400 })

    const banner = await Banner.findById(id).populate("createdBy", "username").populate("updatedBy", "username")

    if (!banner) return NextResponse.json({ error: "Banner item not found" }, { status: 404 })

    logger.info(`Banner item ${id} fetched by ${session.user.email}`)

    return NextResponse.json(
      { success: true, banner },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        }
      }
    )
  } catch (error) {
    const status = error?.statusCode || 500
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: error.message }, { status })
    }
    logger.error("Error fetching banner item:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 15)
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
    const session = await requireAdmin()

    const { id } = params
    if (!id) return NextResponse.json({ error: "Banner ID is required" }, { status: 400 })

    const body = await request.json()
    const validation = await validateRequest(bannerUpdateSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const adminId = await resolveAdminIdFromSession(session)

    const updateData = {
      ...validation.data,
      updatedAt: new Date(),
      updatedBy: adminId,
    }

    const banner = await Banner.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("createdBy", "username")
      .populate("updatedBy", "username")

    if (!banner) return NextResponse.json({ error: "Banner item not found" }, { status: 404 })

    logger.info(`Banner item ${id} updated by ${session.user.email}`)

    try {
      revalidatePath('/gallery')
      revalidatePath('/', 'layout')
      logger.info('Gallery page revalidated after banner update')
    } catch (revalError) {
      logger.warn('Failed to revalidate paths:', revalError)
    }

    return NextResponse.json(
      { success: true, banner, message: "Banner item berhasil diupdate" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "banner-updated",
          "X-Revalidated": "true",
        },
      },
    )
  } catch (error) {
    const status = error?.statusCode || 500
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: error.message }, { status })
    }
    logger.error("Error updating banner item:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
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
    const session = await requireAdmin()

    const { id } = params
    if (!id) return NextResponse.json({ error: "Banner ID is required" }, { status: 400 })

    const banner = await Banner.findById(id)
    if (!banner) return NextResponse.json({ error: "Banner item not found" }, { status: 404 })

    try {
      if (banner.imageKey) {
        await deleteFromS3(banner.imageKey)
        logger.info(`Banner image deleted from S3: ${banner.imageKey}`)
      }
    } catch (s3Error) {
      logger.warn(`Failed to delete banner image from S3: ${s3Error.message}`)
    }

    await Banner.findByIdAndDelete(id)

    logger.info(`Banner item ${id} deleted by ${session.user.email}`)

    try {
      revalidatePath('/gallery')
      revalidatePath('/', 'layout')
      logger.info('Gallery page revalidated after banner deletion')
    } catch (revalError) {
      logger.warn('Failed to revalidate paths:', revalError)
    }

    return NextResponse.json(
      { success: true, message: "Banner item berhasil dihapus" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "banner-deleted",
          "X-Revalidated": "true",
        },
      },
    )
  } catch (error) {
    const status = error?.statusCode || 500
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: error.message }, { status })
    }
    logger.error("Error deleting banner item:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}