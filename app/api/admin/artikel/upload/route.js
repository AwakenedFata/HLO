import { NextResponse } from "next/server"
import { imageUploadSchema } from "@/lib/utils/validation"
import { uploadToS3 } from "@/lib/utils/r2"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdminSession } from "@/lib/utils/auth"

const uploadLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 50,
  limit: 10,
})

export async function POST(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await uploadLimiter.check(identifier, 10)
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
    const file = formData.get("file")
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const validationResult = imageUploadSchema.safeParse({ file })
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", message: validationResult.error.errors[0]?.message || "File tidak valid" },
        { status: 400 },
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const uploadResult = await uploadToS3({ name: file.name, type: file.type, size: file.size, buffer }, "articles")

    logger.info(`Article cover image uploaded to S3 by ${auth.session.user.email}: ${uploadResult.key}`)

    return NextResponse.json(
      {
        success: true,
        imageUrl: uploadResult.url,
        imageKey: uploadResult.key,
        message: "Cover image berhasil diupload",
      },
      { status: 201, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    )
  } catch (error) {
    logger.error("Error uploading article cover image:", error)
    return NextResponse.json({ error: "Upload failed", message: error.message }, { status: 500 })
  }
}
