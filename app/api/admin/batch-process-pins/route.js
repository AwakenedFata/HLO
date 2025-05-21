import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { pinUpdateEmitter } from "../pins/[id]/route"
import { rateLimit } from "@/lib/utils/rate-limit"

// Create a rate limiter for batch process pins endpoint
const batchProcessPinsRateLimiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  limit: 10, // 10 requests per minute
  identifier: "batch-process-pins",
})

// Endpoint for batch processing multiple pins at once
export async function POST(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || request.ip || "anonymous"
    const rateLimitResult = await batchProcessPinsRateLimiter.check(identifier)

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

    const { pinIds } = await request.json()

    if (!pinIds || !Array.isArray(pinIds) || pinIds.length === 0) {
      return NextResponse.json({ error: "Valid PIN IDs array is required" }, { status: 400 })
    }

    // Limit batch size to prevent abuse
    if (pinIds.length > 100) {
      return NextResponse.json({ error: "Maximum 100 PINs can be processed at once" }, { status: 400 })
    }

    // Batch update all pins in a single operation
    const now = new Date()
    const result = await PinCode.updateMany(
      { _id: { $in: pinIds }, used: true, processed: false },
      {
        $set: {
          processed: true,
          processedAt: now,
          processedBy: authResult.user._id,
        },
      },
    )

    if (result.modifiedCount === 0) {
      return NextResponse.json({
        message: "No pins were processed. They may already be processed or don't exist.",
        processed: 0,
      })
    }

    logger.info(`${result.modifiedCount} PINs ditandai sebagai diproses oleh ${authResult.user.username}`)

    // Emit batch update event
    pinUpdateEmitter.emit("pins-batch-processed", {
      count: result.modifiedCount,
      pinIds,
    })

    return NextResponse.json({
      success: true,
      message: `${result.modifiedCount} PIN berhasil diproses`,
      processed: result.modifiedCount,
    })
  } catch (error) {
    logger.error("Error batch processing pins:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
