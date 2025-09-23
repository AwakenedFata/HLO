import { NextResponse } from "next/server"
import { authorizeRequest } from "@/lib/utils/auth-server"
import { imageUploadSchema } from "@/lib/utils/validation"
import { uploadToS3 } from "@/lib/utils/s3"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for upload endpoint
const uploadLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 50,
  limit: 10, // 10 uploads per minute for articles (more than gallery)
})

export async function POST(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await uploadLimiter.check(identifier, 10)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many upload requests. Please try again later.",
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

    // Authentication and authorization
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll("file") // Get all files with name "file"

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    console.log("🔍 DEBUG upload article images details:", {
      count: files.length,
      files: files.map((file) => ({
        name: file?.name,
        type: file?.type,
        size: file?.size,
        sizeInMB: file?.size ? (file.size / 1024 / 1024).toFixed(2) : "unknown",
      })),
    })

    const uploadResults = []
    const errors = []

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        // Validate each file
        const validationResult = imageUploadSchema.safeParse({ file })
        if (!validationResult.success) {
          errors.push({
            file: file.name,
            error: validationResult.error.errors,
          })
          continue
        }

        // Convert file to buffer for S3 upload
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Create file object for S3 upload
        const fileForUpload = {
          name: file.name,
          type: file.type,
          size: file.size,
          buffer,
        }

        // Upload to S3 with "articles" folder prefix
        const uploadResult = await uploadToS3(fileForUpload, "articles")

        uploadResults.push({
          url: uploadResult.url,
          key: uploadResult.key,
          originalName: file.name,
        })

        logger.info(`Article image uploaded to S3 by ${authResult.user.username}: ${uploadResult.key}`)
      } catch (error) {
        console.log(`💥 Error uploading file ${file.name}:`, error)
        errors.push({
          file: file.name,
          error: error.message,
        })
      }
    }

    // Return results
    if (uploadResults.length === 0) {
      return NextResponse.json(
        {
          error: "All uploads failed",
          errors,
          message: "Semua file gagal diupload",
        },
        { status: 400 },
      )
    }

    const response = {
      success: true,
      links: uploadResults.map((result) => result.url), // For compatibility with frontend
      results: uploadResults,
      message: `${uploadResults.length} gambar berhasil diupload`,
    }

    if (errors.length > 0) {
      response.partialSuccess = true
      response.errors = errors
      response.message += `, ${errors.length} gagal`
    }

    return NextResponse.json(response, {
      status: 201,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    console.log("💥 Article upload error:", error)
    logger.error("Error uploading article images:", error)
    return NextResponse.json({ error: "Upload failed", message: error.message }, { status: 500 })
  }
}
