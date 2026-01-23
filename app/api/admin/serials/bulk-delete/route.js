import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import SerialNumber from "@/lib/models/serialNumber"
import { requireAdmin } from "@/lib/utils/auth"
import { rateLimit } from "@/lib/utils/rate-limit"

const bulkDeleteLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 50,
  limit: 5,
})

export async function POST(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await bulkDeleteLimiter.check(identifier, 5)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many bulk delete requests. Please try again later.", reset: rateLimitResult.reset },
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

    try {
      await requireAdmin()
    } catch (err) {
      const status = err?.statusCode || 401
      return NextResponse.json({ status: "error", message: err?.message || "Unauthorized" }, { status })
    }

    const body = (await request.json().catch(() => ({}))) || {}
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : []

    if (ids.length === 0) {
      return NextResponse.json({ error: "ids harus array dengan minimal 1 id" }, { status: 400 })
    }

    // hanya terima ObjectId (24 hex)
    const validIds = ids.filter((id) => typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id))
    if (validIds.length === 0) {
      return NextResponse.json({ error: "Format id tidak valid" }, { status: 400 })
    }

    const res = await SerialNumber.deleteMany({ _id: { $in: validIds } })
    return NextResponse.json({
      success: true,
      requested: ids.length,
      processed: validIds.length,
      deleted: res?.deletedCount || 0,
    })
  } catch (error) {
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
