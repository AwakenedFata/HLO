import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Article from "@/lib/models/article"
import { validateRequest, articleUpdateSchema } from "@/lib/utils/validation"
import { deleteFromS3 } from "@/lib/utils/s3"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdminSession } from "@/lib/utils/auth"
import { requireAdmin as requireAdminWithId, resolveAdminIdFromSession } from "@/lib/utils/admin-guard"

const limiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 100, limit: 20 })

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

    await connectToDatabase()

    const auth = await requireAdminSession()
    if (!auth.ok) {
      return NextResponse.json({ status: "error", message: auth.message }, { status: auth.status })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: "Article ID is required" }, { status: 400 })

    const article = await Article.findById(id)
      .populate("createdBy", "username")
      .populate("updatedBy", "username")
      .populate("relatedGallery", "title label")

    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 })

    logger.info(`Article ${id} fetched by ${auth.session.user.email}`)

    return NextResponse.json({ success: true, article })
  } catch (error) {
    logger.error("Error fetching article:", error)
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

    const auth = await requireAdminWithId()
    if (!auth.ok) {
      return NextResponse.json({ status: "error", message: auth.message }, { status: auth.status })
    }

    const { id } = await params
    const body = await request.json()
    if (!id) return NextResponse.json({ error: "Article ID is required" }, { status: 400 })

    if (body.tags && typeof body.tags === "string") {
      body.tags = body.tags
        .split(" ")
        .map((tag) => tag.replace(/^#/, "").trim())
        .filter(Boolean)
    }

    const validation = await validateRequest(articleUpdateSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const updateData = { ...validation.data }
    if (updateData.status === "published" && !updateData.publishedAt) {
      updateData.publishedAt = new Date()
    } else if (updateData.publishedAt) {
      updateData.publishedAt = new Date(updateData.publishedAt)
    }

    const adminId = await resolveAdminIdFromSession(auth.session)
    updateData.updatedBy = adminId
    updateData.updatedAt = new Date()

    const article = await Article.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate("createdBy", "username")
      .populate("updatedBy", "username")
      .populate("relatedGallery", "title label")

    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 })

    logger.info(`Article ${id} updated by ${auth.session.user.email}`)

    return NextResponse.json(
      { success: true, article, message: "Artikel berhasil diupdate" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "article-updated",
        },
      },
    )
  } catch (error) {
    logger.error("Error updating article:", error)
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

    const auth = await requireAdminSession()
    if (!auth.ok) {
      return NextResponse.json({ status: "error", message: auth.message }, { status: auth.status })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: "Article ID is required" }, { status: 400 })

    const article = await Article.findById(id)
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 })

    const imagesToDelete = []
    if (article.coverImageKey) imagesToDelete.push(article.coverImageKey)
    if (article.contentImages?.length) {
      for (const img of article.contentImages) {
        if (img?.key) imagesToDelete.push(img.key)
      }
    }

    for (const imageKey of imagesToDelete) {
      try {
        await deleteFromS3(imageKey)
        logger.info(`Image deleted from S3: ${imageKey}`)
      } catch (s3Error) {
        logger.warn(`Failed to delete image from S3: ${imageKey} - ${s3Error.message}`)
      }
    }

    await Article.findByIdAndDelete(id)

    logger.info(`Article ${id} deleted by ${auth.session.user.email}`)

    return NextResponse.json(
      { success: true, message: "Artikel berhasil dihapus" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "article-deleted",
        },
      },
    )
  } catch (error) {
    logger.error("Error deleting article:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
