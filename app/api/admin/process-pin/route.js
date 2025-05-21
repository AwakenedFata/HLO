import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { pinUpdateEmitter } from "../pins/[id]/route"
import { rateLimit } from "@/lib/utils/rate-limit"

// Create a rate limiter for process pin endpoint
const processPinRateLimiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  limit: 30, // 30 requests per minute
  identifier: "process-pin",
})

// Endpoint for processing pins with optimized performance
export async function POST(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || request.ip || "anonymous"
    const rateLimitResult = await processPinRateLimiter.check(identifier)

    // If rate limit exceeded, return 429 response
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          reset: rateLimitResult.reset,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.reset,
            "X-RateLimit-Limit": rateLimitResult.limit,
            "X-RateLimit-Remaining": rateLimitResult.remaining,
            "X-RateLimit-Reset": rateLimitResult.reset,
          },
        },
      )
    }

    await connectToDatabase()

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    const { pinId } = await request.json()

    if (!pinId) {
      return NextResponse.json({ error: "PIN ID is required" }, { status: 400 })
    }

    // Find and update the pin in a single operation
    const updatedPin = await PinCode.findByIdAndUpdate(
      pinId,
      {
        processed: true,
        processedAt: new Date(),
        processedBy: authResult.user._id,
      },
      { new: true },
    )

    if (!updatedPin) {
      return NextResponse.json({ error: "PIN tidak ditemukan" }, { status: 404 })
    }

    if (!updatedPin.used) {
      return NextResponse.json({ error: "PIN belum digunakan" }, { status: 400 })
    }

    logger.info(`PIN ${updatedPin.code} ditandai sebagai diproses oleh ${authResult.user.username}`)

    // Emit event for pin update
    pinUpdateEmitter.emit("pin-processed", {
      pinId,
      code: updatedPin.code,
      processed: true,
    })

    // Return minimal data to reduce response size
    return NextResponse.json({
      success: true,
      message: "PIN code berhasil digunakan",
      code: updatedPin.code,
    })
  } catch (error) {
    logger.error("Error processing pin:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
