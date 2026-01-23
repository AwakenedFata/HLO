import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import UserMail from "@/lib/models/userMail"
import logger from "@/lib/utils/logger-server"
import crypto from "crypto"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"

const getLimiter = rateLimit({
  interval: 60_000,
  uniqueTokenPerInterval: 100,
  limit: 60,
})

const patchLimiter = rateLimit({
  interval: 60_000,
  uniqueTokenPerInterval: 100,
  limit: 30,
})

const deleteLimiter = rateLimit({
  interval: 60_000,
  uniqueTokenPerInterval: 100,
  limit: 30,
})

export async function GET(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await getLimiter.check(identifier, 60, "get-user-mail")

    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rate.reset },
        { status: 429, headers: { "Retry-After": rate.reset.toString() } },
      )
    }

    const guard = await requireAdminSession()
    if (!guard.ok) {
      return NextResponse.json({ status: "error", message: guard.message }, { status: guard.status })
    }

    await connectToDatabase()

    const { id } = params
    const mail = await UserMail.findById(id).lean()

    if (!mail) {
      return NextResponse.json({ error: "Mail tidak ditemukan" }, { status: 404 })
    }

    const mailHash = crypto.createHash("md5").update(JSON.stringify(mail)).digest("hex")
    const etag = `"mail-${mail._id}-${mailHash}"`

    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": "private, max-age=60" },
      })
    }

    return NextResponse.json(mail, {
      headers: { ETag: etag, "Cache-Control": "private, max-age=60" },
    })
  } catch (error) {
    logger.error("Error fetching user mail:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await patchLimiter.check(identifier, 30, "update-user-mail")

    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rate.reset },
        { status: 429, headers: { "Retry-After": rate.reset.toString() } },
      )
    }

    let session
    try {
      session = await requireAdmin()
    } catch (err) {
      const status = err?.statusCode || 401
      logger.error(`[PATCH MAIL] Auth failed: ${err?.message || "Unknown error"}`)
      return NextResponse.json(
        {
          status: "error",
          message: err?.message || "Unauthorized",
          error: "Authentication failed",
        },
        { status },
      )
    }

    await connectToDatabase()

    const { id } = params
    const data = await request.json()

    const mail = await UserMail.findById(id)
    if (!mail) {
      return NextResponse.json({ error: "Mail tidak ditemukan" }, { status: 404 })
    }

    // Only allow updating read and archived status
    if (data.read !== undefined) {
      mail.read = Boolean(data.read)
    }
    if (data.archived !== undefined) {
      mail.archived = Boolean(data.archived)
    }

    await mail.save()

    logger.info(`User mail ${id} updated by ${session.user.email}`)

    return NextResponse.json(
      {
        message: "Mail berhasil diupdate",
        mail: mail.toObject(),
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    )
  } catch (error) {
    logger.error("Error updating user mail:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengupdate mail", message: error.message },
      { status: 500 },
    )
  }
}

export async function DELETE(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await deleteLimiter.check(identifier, 30, "delete-user-mail")

    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rate.reset },
        { status: 429, headers: { "Retry-After": rate.reset.toString() } },
      )
    }

    let session
    try {
      session = await requireAdmin()
    } catch (err) {
      const status = err?.statusCode || 401
      logger.error(`[DELETE MAIL] Auth failed: ${err?.message || "Unknown error"}`)
      return NextResponse.json(
        {
          status: "error",
          message: err?.message || "Unauthorized",
          error: "Authentication failed",
        },
        { status },
      )
    }

    await connectToDatabase()

    const { id } = params
    const mail = await UserMail.findById(id)

    if (!mail) {
      return NextResponse.json({ error: "Mail tidak ditemukan" }, { status: 404 })
    }

    await UserMail.findByIdAndDelete(id)
    logger.info(`User mail from ${mail.email} deleted by ${session.user.email}`)

    return NextResponse.json(
      { message: "Mail berhasil dihapus" },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    )
  } catch (error) {
    logger.error("Error deleting user mail:", error)
    return NextResponse.json(
      { error: "Terjadi kesalahan saat menghapus mail", message: error.message },
      { status: 500 },
    )
  }
}
