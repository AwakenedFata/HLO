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
  limit: 10, // 10 uploads per minute
})

// POST upload frame image to S3
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
    const file = formData.get("file")

    // Validate file
    try {
      const validationResult = imageUploadSchema.safeParse({ file })

      if (!validationResult.success) {
        return NextResponse.json(
          {
            message: "Validation failed",
            errors: validationResult.error.errors,
          },
          { status: 400 },
        )
      }
    } catch (zodError) {
      return NextResponse.json({ error: "File validation failed", message: zodError.message }, { status: 400 })
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

    // Upload to S3 with frames folder
    const uploadResult = await uploadToS3(fileForUpload, "frames")

    logger.info(`Frame image uploaded to S3 by ${authResult.user.username}: ${uploadResult.key}`)

    return NextResponse.json(
      {
        success: true,
        imageUrl: uploadResult.url,
        imageKey: uploadResult.key,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        message: "Frame berhasil diupload",
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    )
  } catch (error) {
    logger.error("Error uploading frame image:", error)
    return NextResponse.json({ error: "Upload failed", message: error.message }, { status: 500 })
  }
}
