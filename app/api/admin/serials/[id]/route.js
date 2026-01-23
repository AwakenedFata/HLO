import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import SerialNumber from "@/lib/models/serialNumber"
import { serialUpdateSchema } from "@/lib/utils/validation"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"
import { rateLimit } from "@/lib/utils/rate-limit"

const getLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
  limit: 20,
})
const patchLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
  limit: 15,
})
const deleteLimiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
  limit: 10,
})

export async function GET(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await getLimiter.check(identifier, 20)
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
    const item = await SerialNumber.findById(params.id).lean()
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(item)
  } catch (error) {
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await patchLimiter.check(identifier, 15)
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

    const raw = await request.json().catch(() => ({}))
    const parsed = serialUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const update = {}
    
    // Handle isActive
    if (typeof parsed.data.isActive === "boolean") {
      update.isActive = parsed.data.isActive
    }
    
    if (parsed.data.issuedDate) {
      update.issuedDate = new Date(parsed.data.issuedDate)
    }
    
    // Handle product fields
    const productName = parsed.data.product?.name ?? (typeof raw.productName === "string" ? raw.productName : undefined)
    if (typeof productName === "string") {
      update["product.name"] = productName
    }
    
    if (typeof parsed.data.product?.productionDate === "string") {
      update["product.productionDate"] = parsed.data.product.productionDate
      
      if (!parsed.data.issuedDate && parsed.data.product.productionDate) {
        update.issuedDate = new Date(parsed.data.product.productionDate)
      }
    }

    const updated = await SerialNumber.findByIdAndUpdate(params.id, { $set: update }, { new: true })
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ success: true, item: updated })
  } catch (error) {
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await deleteLimiter.check(identifier, 10)
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

    const deleted = await SerialNumber.findByIdAndDelete(params.id)
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
