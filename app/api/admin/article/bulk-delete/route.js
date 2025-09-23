import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Article from "@/lib/models/article"
import { authorizeRequest } from "@/lib/utils/auth-server"
import { validateRequest } from "@/lib/utils/validation"
import { articleBulkDeleteSchema } from "@/lib/utils/validation"
import { deleteFromS3 } from "@/lib/utils/s3"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for bulk delete endpoint
const bulkDeleteLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 50,
  limit: 5, // 5 bulk delete requests per minute
})

// POST bulk delete articles
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

    // Validate request
    const validation = await validateRequest(articleBulkDeleteSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { ids } = validation.data

    // Find articles to delete
    const articles = await Article.find({ _id: { $in: ids } })

    if (articles.length === 0) {
      return NextResponse.json({ error: "No articles found" }, { status: 404 })
    }

    // Collect all images to delete from S3
    const imagesToDelete = []

    articles.forEach((article) => {
      // Add cover image if exists
      if (article.coverImageKey) {
        imagesToDelete.push(article.coverImageKey)
      }

      // Add content images if exist
      if (article.contentImages && article.contentImages.length > 0) {
        article.contentImages.forEach((img) => {
          if (img.key) {
            imagesToDelete.push(img.key)
          }
        })
      }
    })

    // Delete images from S3
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

    // Delete from database
    const deleteResult = await Article.deleteMany({ _id: { $in: ids } })

    logger.info(`${deleteResult.deletedCount} articles bulk deleted by ${authResult.user.username}`)

    return NextResponse.json(
      {
        success: true,
        deletedCount: deleteResult.deletedCount,
        s3Results: s3Results.map((result) => result.value || result.reason),
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
