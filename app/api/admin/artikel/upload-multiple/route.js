import { NextResponse } from "next/server"
import { authorizeRequest } from "@/lib/utils/auth-server"
import { imageUploadSchema } from "@/lib/utils/validation"
import { uploadToS3 } from "@/lib/utils/s3"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for multiple upload endpoint
const uploadLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 50,
  limit: 5, // 5 batch uploads per minute (more restrictive since it's multiple files)
})

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
    // Get files from "files" field name (matching frontend)
    const files = formData.getAll("files")

    if (!files || files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No files provided",
          message: "Tidak ada file yang dipilih",
        },
        { status: 400 },
      )
    }

    // Limit max files per batch
    const MAX_FILES = 10
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many files. Maximum ${MAX_FILES} files allowed per upload.`,
          message: `Maksimal ${MAX_FILES} file per upload`,
        },
        { status: 400 },
      )
    }

    console.log("🔄 DEBUG upload multiple article images:", {
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
        // Skip if file is not valid
        if (!file || !file.name) {
          errors.push({
            file: `File ${i + 1}`,
            error: "Invalid file object",
          })
          continue
        }

        // Validate each file
        const validationResult = imageUploadSchema.safeParse({ file })
        if (!validationResult.success) {
          errors.push({
            file: file.name,
            error: validationResult.error.errors[0]?.message || "Validation failed",
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

        logger.info(`Article content image uploaded to S3 by ${authResult.user.username}: ${uploadResult.key}`)
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
          success: false,
          error: "All uploads failed",
          errors,
          message: "Semua file gagal diupload",
        },
        { status: 400 },
      )
    }

    // Format response to match frontend expectations
    const response = {
      success: true,
      images: uploadResults, // Frontend expects 'images' array
      count: uploadResults.length,
      message: `${uploadResults.length} gambar berhasil diupload`,
    }

    // Add error info if some failed
    if (errors.length > 0) {
      response.partialSuccess = true
      response.errors = errors
      response.failedCount = errors.length
      response.message += `, ${errors.length} gagal`
    }

    return NextResponse.json(response, {
      status: 201,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    console.log("💥 Multiple article upload error:", error)
    logger.error("Error uploading multiple article images:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Upload failed",
        message: error.message || "Terjadi kesalahan saat upload",
      },
      { status: 500 },
    )
  }
}
