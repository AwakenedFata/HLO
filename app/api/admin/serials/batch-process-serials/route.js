import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import SerialNumber from "@/lib/models/serialNumber"
import { serialBatchCreateSchema } from "@/lib/utils/validation"
import { requireAdmin } from "@/lib/utils/auth"
import { rateLimit } from "@/lib/utils/rate-limit"

const batchLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
  limit: 10,
})

function zeroPad(num, digits) {
  const s = String(num)
  if (s.length >= digits) return s
  return s.padStart(digits, "0")
}

export async function POST(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await batchLimiter.check(identifier, 10)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rateLimitResult.reset },
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
    const parsed = serialBatchCreateSchema.safeParse({
      count: typeof body.count === "string" ? Number.parseInt(body.count, 10) : body.count,
      startFrom: body.startFrom,
      digits: typeof body.digits === "string" ? Number.parseInt(body.digits, 10) : body.digits,
      productName: body.productName,
      issuedDate: body.issuedDate,
      productionDate: body.productionDate,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { count, startFrom, digits, productName = "", issuedDate, productionDate = "" } = parsed.data

    // Determine issuedDate value
    const finalIssuedDate = issuedDate ? new Date(issuedDate) : new Date()

    let startNum
    if (startFrom && startFrom.length > 0) {
      startNum = Number.parseInt(startFrom, 10)
    } else {
      // cari max existing
      const top = await SerialNumber.find({}).sort({ code: -1 }).limit(1).lean()
      if (top.length === 0) {
        startNum = 1
      } else {
        startNum = Number.parseInt(top[0].code, 10) + 1
      }
    }

    const candidateCodes = []
    for (let i = 0; i < count; i++) {
      candidateCodes.push(zeroPad(startNum + i, digits))
    }

    // cek yang sudah ada
    const existing = await SerialNumber.find({ code: { $in: candidateCodes } }, { code: 1 }).lean()
    const existingSet = new Set(existing.map((d) => d.code))
    const toInsert = candidateCodes
      .filter((c) => !existingSet.has(c))
      .map((code) => ({
        code,
        product: { name: productName || "", productionDate: productionDate || "" },
        issuedDate: finalIssuedDate,
      }))

    if (toInsert.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: candidateCodes.length,
        message: "Semua serial pada rentang tersebut sudah ada",
      })
    }

    const batchSize = 1000
    let created = 0
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize)
      const res = await SerialNumber.insertMany(batch, { ordered: true })
      created += res.length
    }

    return NextResponse.json({
      success: true,
      created,
      skipped: candidateCodes.length - created,
      range: {
        from: candidateCodes[0],
        to: candidateCodes[candidateCodes.length - 1],
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}