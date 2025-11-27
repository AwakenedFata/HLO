import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Article from "@/lib/models/article"
import { validateRequest, articleUpdateSchema } from "@/lib/utils/validation"
import { deleteFromS3 } from "@/lib/utils/r2"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"
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
    if (!id) return NextResponse.json({ error: "Article ID is required" }, { status: 400 })

    await connectToDatabase()

    const article = await Article.findById(id)
      .populate("createdBy", "username")
      .populate("updatedBy", "username")
      .populate("relatedGallery", "title label")

    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 })

    logger.info(`Article ${id} fetched`)
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

    let session
    try {
      session = await requireAdmin()
    } catch (err) {
      const status = err?.statusCode || 401
      logger.error(`[PUT ARTICLE] Auth failed: ${err?.message || "Unknown error"}`)
      return NextResponse.json(
        {
          status: "error",
          message: err?.message || "Unauthorized",
          error: "Authentication failed",
        },
        { status },
      )
    }

    const adminId = await resolveAdminIdFromSession(session)
    if (!adminId) {
      logger.error(`[PUT ARTICLE] Failed to resolve admin ID from session`)
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to identify admin user",
          error: "Admin ID resolution failed",
        },
        { status: 401 },
      )
    }

    const { id } = params
    if (!id) return NextResponse.json({ error: "Article ID is required" }, { status: 400 })

    const body = await request.json()
    
    logger.info(`[PUT ARTICLE] Raw update data:`, {
      id,
      status: body.status,
      publishedAt: body.publishedAt,
      hasTitle: !!body.title,
    })

    // Normalisasi tags
    if (body.tags && typeof body.tags === "string") {
      body.tags = body.tags
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#/, "").trim())
        .filter(Boolean)
    }

    // CRITICAL FIX: Clean publishedAt
    if (body.publishedAt === null || body.publishedAt === "" || body.publishedAt === undefined) {
      delete body.publishedAt
    }
    
    if (body.status === "draft" || body.status === "archived") {
      delete body.publishedAt
    }

    const validation = await validateRequest(articleUpdateSchema, body)
    if (!validation.success) {
      logger.error(`[PUT ARTICLE] Validation failed:`, validation.error)
      return NextResponse.json({
        status: "error",
        message: "Validation failed",
        errors: validation.error,
      }, { status: 400 })
    }

    const updateData = { ...validation.data }
    
    // Handle publishedAt
    if (updateData.status === "published") {
      if (updateData.publishedAt) {
        updateData.publishedAt = new Date(updateData.publishedAt)
      } else {
        updateData.publishedAt = new Date()
      }
    } else {
      updateData.publishedAt = undefined
    }
    
    updateData.updatedBy = adminId
    updateData.updatedAt = new Date()

    logger.info(`[PUT ARTICLE] Final update data:`, {
      id,
      status: updateData.status,
      publishedAt: updateData.publishedAt,
      adminId,
    })

    const article = await Article.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    )
      .populate("createdBy", "username")
      .populate("updatedBy", "username")
      .populate("relatedGallery", "title label")

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 })
    }

    logger.info(`[PUT ARTICLE] Article ${id} updated successfully`)
    
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
    logger.error("[PUT ARTICLE] Error:", error)
    logger.error("[PUT ARTICLE] Stack:", error.stack)
    
    return NextResponse.json(
      {
        status: "error",
        error: "Server error",
        message: error.message || "An unexpected error occurred",
      },
      { status: 500 },
    )
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
      logger.error(`[DELETE ARTICLE] Auth failed: ${err?.message || "Unknown error"}`)
      return NextResponse.json(
        {
          status: "error",
          message: err?.message || "Unauthorized",
          error: "Authentication failed",
        },
        { status },
      )
    }

    const { id } = params
    if (!id) return NextResponse.json({ error: "Article ID is required" }, { status: 400 })

    const article = await Article.findById(id)
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 })

    // Hapus semua gambar terkait dari S3 (jika ada)
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
    logger.info(`Article ${id} deleted`)

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
    logger.error("Error stack:", error.stack)
    return NextResponse.json(
      {
        status: "error",
        error: "Server error",
        message: error.message || "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}