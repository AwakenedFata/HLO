import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import logger from "@/lib/utils/logger-server"
import crypto from "crypto"
import { EventEmitter } from "events"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"
import { resolveAdminIdFromSession } from "@/lib/utils/admin-guard"

export const pinUpdateEmitter = new EventEmitter()
pinUpdateEmitter.setMaxListeners(50)

const getLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100, limit: 60 })
const deleteLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100, limit: 30 })
const patchLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100, limit: 30 })

export async function GET(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await getLimiter.check(identifier, 60, "get-pin")
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rate.reset },
        {
          status: 429,
          headers: {
            "Retry-After": rate.reset.toString(),
            "X-RateLimit-Limit": rate.limit.toString(),
            "X-RateLimit-Remaining": rate.remaining.toString(),
            "X-RateLimit-Reset": rate.reset.toString(),
          },
        },
      )
    }

    // PERBAIKAN: Gunakan pattern yang sama dengan Gallery
    const guard = await requireAdminSession()
    if (!guard.ok) {
      return NextResponse.json({ status: "error", message: guard.message }, { status: guard.status })
    }

    await connectToDatabase()

    const { id } = params
    const pin = await PinCode.findById(id).lean()
    if (!pin) return NextResponse.json({ error: "PIN tidak ditemukan" }, { status: 404 })

    const pinHash = crypto.createHash("md5").update(JSON.stringify(pin)).digest("hex")
    const etag = `"pin-${pin._id}-${pinHash}"`

    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, max-age=60" } })
    }

    return NextResponse.json(pin, { headers: { ETag: etag, "Cache-Control": "private, max-age=60" } })
  } catch (error) {
    logger.error("Error fetching pin:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await deleteLimiter.check(identifier, 30, "delete-pin")
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rate.reset },
        {
          status: 429,
          headers: {
            "Retry-After": rate.reset.toString(),
            "X-RateLimit-Limit": rate.limit.toString(),
            "X-RateLimit-Remaining": rate.remaining.toString(),
            "X-RateLimit-Reset": rate.reset.toString(),
          },
        },
      )
    }

    await connectToDatabase()

    // PERBAIKAN: Gunakan pattern yang sama dengan Gallery
    let session
    try {
      session = await requireAdmin()
    } catch (err) {
      const status = err?.statusCode || 401
      logger.error(`[DELETE PIN] Auth failed: ${err?.message || "Unknown error"}`)
      return NextResponse.json(
        { 
          status: "error", 
          message: err?.message || "Unauthorized",
          error: "Authentication failed"
        }, 
        { status }
      )
    }
    
    const adminId = await resolveAdminIdFromSession(session)

    const pinId = params.id
    const pin = await PinCode.findById(pinId)
    if (!pin) return NextResponse.json({ error: "PIN tidak ditemukan" }, { status: 404 })
    if (pin.used) return NextResponse.json({ error: "PIN sudah digunakan dan tidak bisa dihapus" }, { status: 400 })

    await PinCode.findByIdAndDelete(pinId)
    logger.info(`PIN ${pin.code} dihapus oleh ${session.user.email}`)

    pinUpdateEmitter.emit("pin-deleted", {
      pinId,
      code: pin.code,
      deletedBy: { id: adminId, email: session.user.email },
      deletedAt: new Date(),
    })

    return NextResponse.json(
      { message: "PIN berhasil dihapus" },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "pin-deleted",
        },
      },
    )
  } catch (error) {
    logger.error("Gagal menghapus PIN:", error)
    return NextResponse.json({ error: "Terjadi kesalahan saat menghapus PIN", message: error.message }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await patchLimiter.check(identifier, 30, "update-pin")
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rate.reset },
        {
          status: 429,
          headers: {
            "Retry-After": rate.reset.toString(),
            "X-RateLimit-Limit": rate.limit.toString(),
            "X-RateLimit-Remaining": rate.remaining.toString(),
            "X-RateLimit-Reset": rate.reset.toString(),
          },
        },
      )
    }

    await connectToDatabase()

    // PERBAIKAN: Gunakan pattern yang sama dengan Gallery
    let session
    try {
      session = await requireAdmin()
    } catch (err) {
      const status = err?.statusCode || 401
      logger.error(`[PATCH PIN] Auth failed: ${err?.message || "Unknown error"}`)
      return NextResponse.json(
        { 
          status: "error", 
          message: err?.message || "Unauthorized",
          error: "Authentication failed"
        }, 
        { status }
      )
    }
    
    const adminId = await resolveAdminIdFromSession(session)

    const pinId = params.id
    const data = await request.json()
    const now = new Date()

    const pin = await PinCode.findById(pinId)
    if (!pin) return NextResponse.json({ error: "PIN tidak ditemukan" }, { status: 404 })

    if (data.processed !== undefined && typeof data.processed !== "boolean") {
      return NextResponse.json({ error: "Invalid processed value" }, { status: 400 })
    }

    const updateData = { ...data }
    if (data.processed === true) {
      updateData.processedAt = now
      updateData.processedBy = adminId
    }

    const updatedPin = await PinCode.findByIdAndUpdate(pinId, updateData, { new: true })
    logger.info(`PIN ${pin.code} diupdate oleh ${session.user.email}`)

    if (data.processed !== undefined) {
      pinUpdateEmitter.emit("pin-processed", {
        pinId,
        code: pin.code,
        processed: data.processed,
        processedAt: now,
        processedBy: { id: adminId, email: session.user.email },
      })
    } else {
      pinUpdateEmitter.emit("pin-updated", {
        pinId,
        code: pin.code,
        updates: data,
        updatedBy: { id: adminId, email: session.user.email },
        updatedAt: now,
      })
    }

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
          "X-Data-Updated": "true",
          "X-Update-Type": "pin-updated",
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