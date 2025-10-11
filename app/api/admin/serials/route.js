import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import SerialNumber from "@/lib/models/serialNumber"
import { serialManualCreateSchema, serialQuerySchema } from "@/lib/utils/validation"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"
import { rateLimit } from "@/lib/utils/rate-limit"

const getLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
  limit: 30,
})
const postLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
  limit: 10,
})

export async function GET(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await getLimiter.check(identifier, 30)
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

    const guard = await requireAdminSession()
    if (!guard.ok) {
      return NextResponse.json({ status: "error", message: guard.message }, { status: guard.status })
    }

    await connectToDatabase()
    const { searchParams } = new URL(request.url)
    const parsed = serialQuerySchema.safeParse({
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "50",
      search: searchParams.get("search") || "",
      active: searchParams.get("active") || undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 })
    }

    const page = Number.parseInt(parsed.data.page || "1", 10)
    const limit = Math.min(Number.parseInt(parsed.data.limit || "50", 10), 200)
    const skip = (page - 1) * limit
    const search = parsed.data.search?.trim()
    const active = parsed.data.active

    const query = {}
    if (search) {
      query.$or = [{ code: { $regex: search, $options: "i" } }, { "product.name": { $regex: search, $options: "i" } }]
    }
    if (active === "true") query.isActive = true
    if (active === "false") query.isActive = false

    // ✅ FIX: Use aggregation for numeric sorting
    const [totalResult, items] = await Promise.all([
      SerialNumber.countDocuments(query),
      SerialNumber.aggregate([
        { $match: query },
        {
          $addFields: {
            codeAsNumber: { $toLong: "$code" },
          },
        },
        { $sort: { codeAsNumber: 1 } }, // Sort numerically ascending
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            codeAsNumber: 0, // Remove temporary field from output
          },
        },
      ]),
    ])

    const total = totalResult

    return NextResponse.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    })
  } catch (error) {
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await postLimiter.check(identifier, 10)
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

    const body = await request.json().catch(() => ({}))
    const parsed = serialManualCreateSchema.safeParse({
      code: body?.code,
      productName: body?.productName,
      issuedDate: body?.issuedDate,
      productionDate: body?.productionDate,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { code, productName = "", issuedDate, productionDate = "" } = parsed.data
    
    const exists = await SerialNumber.findOne({ code })
    if (exists) {
      return NextResponse.json({ error: `Serial ${code} sudah ada` }, { status: 409 })
    }

    // Determine issuedDate value
    const finalIssuedDate = issuedDate ? new Date(issuedDate) : new Date()

    const doc = await SerialNumber.create({
      code,
      product: { name: productName, productionDate },
      issuedDate: finalIssuedDate,
    })
    
    return NextResponse.json({
      success: true,
      item: { 
        code: doc.code, 
        product: { name: doc.product.name, productionDate: doc.product.productionDate },
        issuedDate: doc.issuedDate,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}