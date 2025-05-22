import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { validateRequest, deletePinSchema } from "@/lib/utils/validation"
import { rateLimit } from "@/lib/utils/rate-limit"
import { pinUpdateEmitter } from "../pins/[id]/route"

// Rate limiter for delete pins endpoint
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 10, // 10 requests per minute
})

export async function POST(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 10, "delete-pins")

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
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const body = await request.json()
    const validation = await validateRequest(deletePinSchema, body)

    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { pinIds } = validation.data

    // Limit batch size to prevent abuse
    if (pinIds.length > 500) {
      return NextResponse.json({ error: "Maximum batch size is 500 pins" }, { status: 400 })
    }

    logger.info(`Attempting to delete multiple pins: ${pinIds.length} pins`)

    // Check if all PINs exist and haven't been used
    const pins = await PinCode.find({ _id: { $in: pinIds } })

    if (pins.length !== pinIds.length) {
      return NextResponse.json({ error: "Beberapa PIN tidak ditemukan" }, { status: 400 })
    }

    // Check if any PINs have been used
    const usedPins = pins.filter((pin) => pin.used)
    if (usedPins.length > 0) {
      return NextResponse.json(
        {
          error: "Tidak dapat menghapus PIN yang sudah digunakan",
          usedPins: usedPins.map((p) => p.code),
        },
        { status: 400 },
      )
    }

    // Get PIN codes before deletion for event emission
    const pinCodes = pins.map((pin) => ({ id: pin._id.toString(), code: pin.code }))

    // Delete PINs
    const result = await PinCode.deleteMany({
      _id: { $in: pinIds },
      used: false,
    })

    logger.info(`${result.deletedCount} PIN dihapus oleh ${authResult.user.username}`)

    // Emit event for batch deletion
    pinUpdateEmitter.emit("pins-batch-deleted", {
      count: result.deletedCount,
      pins: pinCodes,
      deletedBy: {
        id: authResult.user._id.toString(),
        username: authResult.user.username,
      },
      deletedAt: new Date(),
    })

    return NextResponse.json(
      {
        success: true,
        message: `${result.deletedCount} PIN berhasil dihapus`,
        deletedCount: result.deletedCount,
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
    logger.error("Error deleting pins:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
