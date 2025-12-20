import { NextResponse } from "next/server"
import { imageUploadSchema } from "@/lib/utils/validation"
import { uploadToS3 } from "@/lib/utils/r2"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdmin } from "@/lib/utils/auth"

// Rate limiter for upload endpoint
const uploadLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 50,
  limit: 10, // 10 uploads per minute
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

    let adminUser
    try {
      adminUser = await requireAdmin(request)
    } catch (err) {
      const status = err?.statusCode || 401
      return NextResponse.json({ status: "error", message: err?.message || "Unauthorized" }, { status })
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!file) {
      return NextResponse.json(
        { error: "Validation failed", message: "File gambar harus diupload" },
        { status: 400 }
      )
    }

    // Check file size before validation
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Validation failed", message: "Ukuran file maksimal 10MB" },
        { status: 400 }
      )
    }

    const fileType = file.type?.toLowerCase()
    const fileName = file.name?.toLowerCase()
    const validTypes = ["image/jpeg", "image/jpg", "image/avif", "image/png", "image/webp"]
    const validExtensions = [".jpg", ".jpeg", ".avif", ".png", ".webp"]

    const isValidType = fileType && validTypes.includes(fileType)
    const isValidExtension = fileName && validExtensions.some((ext) => fileName.endsWith(ext))

    if (!isValidType && !isValidExtension) {
      return NextResponse.json(
        {
          error: "Validation failed",
          message: "Format file harus JPG, PNG, AVIF, atau WebP",
          details: {
            received: fileType || "unknown",
            fileName: fileName || "unknown",
          },
        },
        { status: 400 }
      )
    }

    const validationResult = imageUploadSchema.safeParse({ file })
    if (!validationResult.success) {
      logger.warn("Frame upload validation failed:", validationResult.error.errors)
      return NextResponse.json(
        {
          error: "Validation failed",
          message: "File gambar tidak valid",
          errors: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileForUpload = {
      name: file.name,
      type: file.type,
      size: file.size,
      buffer,
    }

    const uploadResult = await uploadToS3(fileForUpload, "frames")
    logger.info(`Frame image uploaded to S3 by ${adminUser?.email || "admin"}: ${uploadResult.key} (${file.type})`)

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
      { status: 201, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    )
  } catch (error) {
    logger.error("Error uploading frame image:", error)
    return NextResponse.json({ error: "Upload failed", message: error.message }, { status: 500 })
  }
}