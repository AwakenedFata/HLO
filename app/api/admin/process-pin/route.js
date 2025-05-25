import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for process pin endpoint
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 30, // 30 requests per minute
})

// Endpoint for processing individual pins with optimized performance
export async function POST(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 30, "process-pin")

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

    const { pinId } = await request.json()

    if (!pinId) {
      return NextResponse.json({ error: "PIN ID is required" }, { status: 400 })
    }

    const now = new Date()

    // Find and update the pin in a single operation with better error handling
    const updatedPin = await PinCode.findOneAndUpdate(
      { _id: pinId, used: true, processed: false },
      {
        $set: {
          processed: true,
          processedAt: now,
          processedBy: authResult.user._id,
        },
      },
      { new: true, runValidators: true },
    )

    if (!updatedPin) {
      // Check if the pin exists but is already processed or not used
      const existingPin = await PinCode.findById(pinId).lean()

      if (!existingPin) {
        return NextResponse.json({ error: "PIN tidak ditemukan" }, { status: 404 })
      }

      if (existingPin.processed) {
        return NextResponse.json(
          {
            error: "PIN sudah diproses sebelumnya",
            processedAt: existingPin.processedAt,
          },
          { status: 400 },
        )
      }

      if (!existingPin.used) {
        return NextResponse.json({ error: "PIN belum digunakan" }, { status: 400 })
      }

      return NextResponse.json({ error: "PIN tidak dapat diproses" }, { status: 400 })
    }

    logger.info(`PIN ${updatedPin.code} ditandai sebagai diproses oleh ${authResult.user.username}`)

    // Return response with cache invalidation headers
    return NextResponse.json(
      {
        success: true,
        message: "PIN berhasil diproses",
        pin: {
          _id: updatedPin._id,
          code: updatedPin.code,
          processed: updatedPin.processed,
          processedAt: updatedPin.processedAt,
        },
        timestamp: now.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "pin-processed",
          "X-Update-Count": "1",
        },
      },
    )
  } catch (error) {
    logger.error("Error processing pin:", error)
    return NextResponse.json(
      {
        error: "Server error",
        message: error.message,
      },
      { status: 500 },
    )
  }
}
