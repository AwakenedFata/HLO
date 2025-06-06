import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { EventEmitter } from "events"
import crypto from "crypto"
import { rateLimit } from "@/lib/utils/rate-limit"

// Create a global event emitter for pin updates
export const pinUpdateEmitter = new EventEmitter()
// Increase max listeners to avoid memory leak warnings
pinUpdateEmitter.setMaxListeners(50)

// Rate limiter for GET endpoint
const getLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 60, // 60 requests per minute
})

// Rate limiter for DELETE endpoint
const deleteLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 30, // 30 requests per minute
})

// Rate limiter for PATCH endpoint
const patchLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 30, // 30 requests per minute
})

// GET endpoint for retrieving a single PIN
export async function GET(request, { params }) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await getLimiter.check(identifier, 60, "get-pin")

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

    const { id } = params

    // Find pin by ID with lean() for better performance
    const pin = await PinCode.findById(id).lean()

    if (!pin) {
      return NextResponse.json({ error: "PIN tidak ditemukan" }, { status: 404 })
    }

    logger.info(`PIN ${pin.code} diakses oleh ${authResult.user.username}`)

    // Generate ETag based on pin data
    const pinHash = crypto.createHash("md5").update(JSON.stringify(pin)).digest("hex")
    const etag = `"pin-${pin._id}-${pinHash}"`

    // Check if client has a valid cached version
    const ifNoneMatch = request.headers.get("if-none-match")
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=60",
        },
      })
    }

    // Return response with caching headers
    return NextResponse.json(pin, {
      headers: {
        ETag: etag,
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch (error) {
    logger.error("Error fetching pin:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

// DELETE endpoint for removing a PIN
export async function DELETE(request, { params }) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await deleteLimiter.check(identifier, 30, "delete-pin")

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

    // Autentikasi
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    const pinId = params.id

    // Cari PIN
    const pin = await PinCode.findById(pinId)

    if (!pin) {
      return NextResponse.json({ error: "PIN tidak ditemukan" }, { status: 404 })
    }

    if (pin.used) {
      return NextResponse.json({ error: "PIN sudah digunakan dan tidak bisa dihapus" }, { status: 400 })
    }

    await PinCode.findByIdAndDelete(pinId)

    logger.info(`PIN ${pin.code} dihapus oleh ${authResult.user.username}`)

    // Emit event for pin deletion with enhanced data
    pinUpdateEmitter.emit("pin-deleted", {
      pinId,
      code: pin.code,
      deletedBy: {
        id: authResult.user._id,
        username: authResult.user.username,
      },
      deletedAt: new Date(),
    })

    // Return response with cache control headers
    return NextResponse.json(
      { message: "PIN berhasil dihapus" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  } catch (error) {
    logger.error("Gagal menghapus PIN:", error)
    return NextResponse.json({ error: "Terjadi kesalahan saat menghapus PIN", message: error.message }, { status: 500 })
  }
}

// PATCH endpoint for updating a PIN
export async function PATCH(request, { params }) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await patchLimiter.check(identifier, 30, "update-pin")

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

    // Autentikasi
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    const pinId = params.id
    const data = await request.json()
    const now = new Date()

    // Cari PIN
    const pin = await PinCode.findById(pinId)

    if (!pin) {
      return NextResponse.json({ error: "PIN tidak ditemukan" }, { status: 404 })
    }

    // Validate update data
    if (data.processed !== undefined && typeof data.processed !== "boolean") {
      return NextResponse.json({ error: "Invalid processed value" }, { status: 400 })
    }

    // Prepare update data
    const updateData = { ...data }

    // Add processedAt and processedBy if setting processed to true
    if (data.processed === true) {
      updateData.processedAt = now
      updateData.processedBy = authResult.user._id
    }

    // Update PIN
    const updatedPin = await PinCode.findByIdAndUpdate(pinId, updateData, { new: true })

    logger.info(`PIN ${pin.code} diupdate oleh ${authResult.user.username}`)

    // Emit event for pin update with enhanced data
    if (data.processed !== undefined) {
      pinUpdateEmitter.emit("pin-processed", {
        pinId,
        code: pin.code,
        processed: data.processed,
        processedAt: now,
        processedBy: {
          id: authResult.user._id,
          username: authResult.user.username,
        },
      })
    } else {
      // Generic update event
      pinUpdateEmitter.emit("pin-updated", {
        pinId,
        code: pin.code,
        updates: data,
        updatedBy: {
          id: authResult.user._id,
          username: authResult.user.username,
        },
        updatedAt: now,
      })
    }

    // Return response with cache control headers
    return NextResponse.json(
      {
        message: "PIN berhasil diupdate",
        pin: updatedPin,
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
    logger.error("Gagal mengupdate PIN:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengupdate PIN", message: error.message },
      { status: 500 },
    )
  }
}
