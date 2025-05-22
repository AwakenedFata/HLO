import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { pinUpdateEmitter } from "../pins/[id]/route"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for batch processing endpoint
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 10, // 10 requests per minute
})

// Endpoint for batch processing multiple pins at once
export async function POST(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 10, "batch-process-pins")

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
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
      return NextResponse.json({ error: "Maximum batch size is 100 pins" }, { status: 400 })
    }

    const now = new Date()

    // Batch update all pins in a single operation with processedAt and processedBy
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

    // Get the processed pins for logging and event emission
    const processedPins = await PinCode.find({
      _id: { $in: pinIds },
      processed: true,
      processedAt: now,
    })
      .select("_id code")
      .lean()

    logger.info(`${result.modifiedCount} PINs ditandai sebagai diproses oleh ${authResult.user.username}`)

    // Emit batch update event with more comprehensive data
    pinUpdateEmitter.emit("pins-batch-processed", {
      count: result.modifiedCount,
      pinIds,
      codes: processedPins.map((pin) => pin.code),
      processedAt: now,
      processedBy: {
        id: authResult.user._id,
        username: authResult.user.username,
      },
    })

    // Return response with cache control headers
    return NextResponse.json(
      {
        success: true,
        message: `${result.modifiedCount} PIN berhasil diproses`,
        processed: result.modifiedCount,
        processedAt: now,
        processedPins: processedPins.map((pin) => ({ _id: pin._id, code: pin.code })),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  } catch (error) {
    logger.error("Error batch processing pins:", error)
    return NextResponse.json(
      {
        error: "Server error",
        message: error.message,
      },
      { status: 500 },
    )
  }
}
