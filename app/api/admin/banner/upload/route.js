import { NextResponse } from "next/server"
import { imageUploadSchema } from "@/lib/utils/validation"
import { uploadToS3 } from "@/lib/utils/r2"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdminSession } from "@/lib/utils/auth"

// Rate limiter for upload endpoint
const uploadLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 50,
  limit: 5, // 5 uploads per minute
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

    // Switch to NextAuth-only guard, no DB
    const guard = await requireAdminSession()
    if (!guard.ok) {
      return NextResponse.json({ status: "error", message: guard.message }, { status: guard.status })
    }
    const { session } = guard

    const formData = await request.formData()
    const file = formData.get("file")

    // Direct Zod validation for File objects
    try {
      const validationResult = imageUploadSchema.safeParse({ file })
      if (!validationResult.success) {
        return NextResponse.json(
          { message: "Validation failed", errors: validationResult.error.errors },
          { status: 400 },
        )
      }
    } catch (zodError) {
      return NextResponse.json({ error: "File validation failed", message: zodError.message }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileForUpload = {
      name: file.name,
      type: file.type,
      size: file.size,
      buffer,
    }

    const uploadResult = await uploadToS3(fileForUpload, "banner")
    logger.info(`Banner image uploaded to S3 by ${session?.user?.email || "admin"}: ${uploadResult.key}`)

    return NextResponse.json(
      {
        success: true,
        imageUrl: uploadResult.url,
        imageKey: uploadResult.key,
        message: "Banner image berhasil diupload",
      },
      { status: 201, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    )
  } catch (error) {
    logger.error("Error uploading banner image:", error)
    return NextResponse.json({ error: "Upload failed", message: error.message }, { status: 500 })
  }
}
