import { NextResponse } from "next/server"
import { imageUploadSchema } from "@/lib/utils/validation"
import { uploadToS3 } from "@/lib/utils/r2"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdminSession } from "@/lib/utils/auth"

const uploadLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 50,
  limit: 5,
})

export async function POST(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await uploadLimiter.check(identifier, 5)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many upload requests. Please try again later.", reset: rateLimitResult.reset },
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

    const auth = await requireAdminSession()
    if (!auth.ok) {
      return NextResponse.json({ status: "error", message: auth.message }, { status: auth.status })
    }

    const formData = await request.formData()
    const files = formData.getAll("files") || []
    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files provided", message: "Tidak ada file yang dipilih" },
        { status: 400 },
      )
    }
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

    const uploadResults = []
    const errors = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        if (!file || !file.name) {
          errors.push({ file: `File ${i + 1}`, error: "Invalid file object" })
          continue
        }
        const validationResult = imageUploadSchema.safeParse({ file })
        if (!validationResult.success) {
          errors.push({ file: file.name, error: validationResult.error.errors[0]?.message || "Validation failed" })
          continue
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const uploadResult = await uploadToS3({ name: file.name, type: file.type, size: file.size, buffer }, "articles")
        uploadResults.push({ url: uploadResult.url, key: uploadResult.key, originalName: file.name })
        logger.info(`Article content image uploaded to S3 by ${auth.session.user.email}: ${uploadResult.key}`)
      } catch (error) {
        errors.push({ file: file?.name || `File ${i + 1}`, error: error.message })
      }
    }

    if (uploadResults.length === 0) {
      return NextResponse.json(
        { success: false, error: "All uploads failed", errors, message: "Semua file gagal diupload" },
        { status: 400 },
      )
    }

    const response = {
      success: true,
      images: uploadResults,
      count: uploadResults.length,
      message: `${uploadResults.length} gambar berhasil diupload`,
    }
    if (errors.length > 0) {
      response.partialSuccess = true
      response.errors = errors
      response.failedCount = errors.length
      response.message += `, ${errors.length} gagal`
    }

    return NextResponse.json(response, {
      status: 201,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    })
  } catch (error) {
    logger.error("Error uploading multiple article images:", error)
    return NextResponse.json(
      { success: false, error: "Upload failed", message: error.message || "Terjadi kesalahan saat upload" },
      { status: 500 },
    )
  }
}
