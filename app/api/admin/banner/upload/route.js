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
  limit: 5, // 5 uploads per minute
})

// POST upload banner image to S3
export async function POST(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await uploadLimiter.check(identifier, 5)

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

    // Enhanced debug logging
    console.log("🔍 DEBUG upload banner file details:", {
      exists: !!file,
      name: file?.name,
      type: file?.type,
      size: file?.size,
      sizeInMB: file?.size ? (file.size / 1024 / 1024).toFixed(2) : "unknown",
    })

    // Direct Zod validation WITHOUT sanitization for File objects
    try {
      const validationResult = imageUploadSchema.safeParse({ file })

      if (!validationResult.success) {
        console.log("❌ Direct Zod validation failed:", validationResult.error.errors)
        return NextResponse.json(
          {
            message: "Validation failed",
            errors: validationResult.error.errors,
          },
          { status: 400 },
        )
      }

      console.log("✅ Direct Zod validation passed")
    } catch (zodError) {
      console.log("💥 Zod validation error:", zodError)
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

    // Upload to S3 with banner folder
    const uploadResult = await uploadToS3(fileForUpload, "banner")

    logger.info(`Banner image uploaded to S3 by ${authResult.user.username}: ${uploadResult.key}`)

    return NextResponse.json(
      {
        success: true,
        imageUrl: uploadResult.url,
        imageKey: uploadResult.key,
        message: "Banner image berhasil diupload",
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    )
  } catch (error) {
    console.log("💥 Banner upload error:", error)
    logger.error("Error uploading banner image:", error)
    return NextResponse.json({ error: "Upload failed", message: error.message }, { status: 500 })
  }
}
