import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import logger from "@/lib/utils/logger-server"
import crypto from "crypto"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"
import { resolveAdminIdFromSession } from "@/lib/utils/admin-guard"
import { validateRequest, pinCreationSchema } from "@/lib/utils/validation"
import { generateUniquePin } from "@/lib/utils/pinGenerator"

const getLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100, limit: 30 })
const postLimiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100, limit: 10 })

export async function GET(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await getLimiter.check(identifier, 30, "get-pins")
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

    const guard = await requireAdminSession()
    if (!guard.ok) {
      return NextResponse.json({ status: "error", message: guard.message }, { status: guard.status })
    }
    const session = guard.session

    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "500", 10)
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const skip = (page - 1) * limit
    if (Number.isNaN(page) || page < 1) return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 })
    if (Number.isNaN(limit) || limit < 1 || limit > 500) {
      return NextResponse.json({ error: "Invalid limit parameter (1-500)" }, { status: 400 })
    }

    const filterUsed = searchParams.get("used")
    const filterProcessed = searchParams.get("processed")
    const searchTerm = searchParams.get("search")
    const cacheBuster = searchParams.get("_t")
    const bypassCache = !!cacheBuster || request.headers.get("cache-control")?.includes("no-cache")

    const query = {}
    if (filterUsed !== null) query.used = filterUsed === "true"
    if (filterProcessed !== null) query.processed = filterProcessed === "true"
    if (searchTerm) {
      query.$or = [
        { code: { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.nama": { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.idGame": { $regex: searchTerm, $options: "i" } },
      ]
    }

    const totalFiltered = await PinCode.countDocuments(query)
    const pins = await PinCode.find(query, {
      code: 1,
      used: 1,
      processed: 1,
      "redeemedBy.nama": 1,
      "redeemedBy.idGame": 1,
      "redeemedBy.redeemedAt": 1,
    })
      .sort({ code: 1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const [totalAll, usedAll, pendingAll, processedAll] = await Promise.all([
      PinCode.countDocuments({}),
      PinCode.countDocuments({ used: true }),
      PinCode.countDocuments({ used: true, processed: false }),
      PinCode.countDocuments({ used: true, processed: true }),
    ])

    logger.info(`Pins fetched by ${session.user?.email}, page: ${page}, limit: ${limit}`)

    const headers = {
      "X-Total-Count": totalFiltered.toString(),
      "X-Total-Pages": Math.ceil(totalFiltered / limit).toString(),
    }

    if (bypassCache) {
      headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
      headers["Pragma"] = "no-cache"
      headers["Expires"] = "0"
    } else {
      headers["Cache-Control"] = "private, max-age=30"
      const dataHash = crypto
        .createHash("md5")
        .update(JSON.stringify({ pins, stats: { totalAll, usedAll, pendingAll, processedAll } }))
        .digest("hex")
      headers["ETag"] = `"pins-${dataHash}"`
      const ifNoneMatch = request.headers.get("if-none-match")
      if (ifNoneMatch === headers["ETag"]) {
        return new NextResponse(null, { status: 304, headers })
      }
    }

    return NextResponse.json(
      {
        pins,
        total: totalFiltered,
        page,
        totalPages: Math.ceil(totalFiltered / limit),
        stats: {
          total: totalAll,
          used: usedAll,
          unused: totalAll - usedAll,
          available: totalAll - usedAll,
          pending: pendingAll,
          processed: processedAll,
        },
      },
      { headers },
    )
  } catch (error) {
    logger.error("Error fetching pins:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await postLimiter.check(identifier, 10, "generate-pins")
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

    let session
    try {
      session = await requireAdmin()
    } catch (err) {
      const status = err?.statusCode || 401
      logger.error(`[POST PINS] Auth failed: ${err?.message || "Unknown error"}`)
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

    const body = await request.json()
    const validation = await validateRequest(pinCreationSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { count = 10, prefix = "" } = body
    if (count > 1000) {
      return NextResponse.json({ error: "Maksimum 1000 PIN dapat dibuat dalam satu permintaan" }, { status: 400 })
    }

    // Validasi prefix tidak lebih dari 5 karakter
    if (prefix && prefix.length > 5) {
      return NextResponse.json({ error: "Prefix maksimal 5 karakter" }, { status: 400 })
    }

    const batchSize = 100
    const pins = []
    const now = new Date()

    for (let i = 0; i < count; i += batchSize) {
      const batchCount = Math.min(batchSize, count - i)
      const batchPins = []
      for (let j = 0; j < batchCount; j++) {
        // Generate 16 digit PIN (atau 16 - prefix.length untuk bagian random)
        const code = await generateUniquePin(prefix, 16)
        batchPins.push({ code, used: false, processed: false, createdAt: now, createdBy: adminId })
      }
      const result = await PinCode.insertMany(batchPins, { ordered: true })
      pins.push(...result)
    }

    logger.info(`${pins.length} PIN baru (16 digit) dibuat oleh ${session.user.email}`)

    return NextResponse.json(
      {
        success: true,
        count: pins.length,
        message: `Berhasil generate ${pins.length} PIN baru (16 digit)`,
        timestamp: now.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "pin-generated",
          "X-Update-Count": pins.length.toString(),
        },
      },
    )
  } catch (error) {
    logger.error("Error generating pins:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}