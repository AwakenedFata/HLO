import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Article from "@/lib/models/article"
import { validateRequest, articleBulkDeleteSchema } from "@/lib/utils/validation"
import { deleteFromS3 } from "@/lib/utils/r2"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdminSession } from "@/lib/utils/auth"

const bulkDeleteLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 50, limit: 5 })

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

    const auth = await requireAdminSession()
    if (!auth.ok) {
      return NextResponse.json({ status: "error", message: auth.message }, { status: auth.status })
    }

    const body = await request.json()
    const validation = await validateRequest(articleBulkDeleteSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { ids } = validation.data
    const articles = await Article.find({ _id: { $in: ids } })
    if (articles.length === 0) {
      return NextResponse.json({ error: "No articles found" }, { status: 404 })
    }

    const imagesToDelete = []
    for (const art of articles) {
      if (art.coverImageKey) imagesToDelete.push(art.coverImageKey)
      if (art.contentImages?.length) {
        for (const img of art.contentImages) {
          if (img?.key) imagesToDelete.push(img.key)
        }
      }
    }

    const s3DeletePromises = imagesToDelete.map(async (imageKey) => {
      try {
        await deleteFromS3(imageKey)
        logger.info(`Image deleted from S3: ${imageKey}`)
        return { success: true, key: imageKey }
      } catch (s3Error) {
        logger.warn(`Failed to delete image from S3: ${imageKey} - ${s3Error.message}`)
        return { success: false, key: imageKey, error: s3Error.message }
      }
    })
    const s3Results = await Promise.allSettled(s3DeletePromises)

    const deleteResult = await Article.deleteMany({ _id: { $in: ids } })

    logger.info(`${deleteResult.deletedCount} articles bulk deleted by ${auth.session.user.email}`)

    return NextResponse.json(
      {
        success: true,
        deletedCount: deleteResult.deletedCount,
        s3Results: s3Results.map((r) => r.value || r.reason),
        message: `${deleteResult.deletedCount} artikel berhasil dihapus`,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "article-bulk-deleted",
        },
      },
    )
  } catch (error) {
    logger.error("Error bulk deleting articles:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
