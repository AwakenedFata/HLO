import { NextResponse } from "next/server"
import crypto from "crypto"
import connectToDatabase from "@/lib/db"
import Banner from "@/lib/models/banner"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"
import { validateRequest, bannerCreationSchema } from "@/lib/utils/validation"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { resolveAdminIdFromSession } from "@/lib/utils/admin-guard"

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

    const guard = await requireAdminSession()
    if (!guard.ok) {
      return NextResponse.json({ error: guard.message }, { status: guard.status })
    }
    const { session } = guard

    await connectToDatabase()
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const limit = Number.parseInt(searchParams.get("limit") || "20", 10)
    const search = searchParams.get("search") || undefined
    const sortBy = searchParams.get("sortBy") || "createdAt"
    const sortOrder = searchParams.get("sortOrder") || "desc"
    const status = searchParams.get("status") || "all"
    const skip = (page - 1) * limit

    const cacheBuster = searchParams.get("_t")
    const bypassCache = !!cacheBuster || request.headers.get("cache-control")?.includes("no-cache")

    const query = {}
    if (status === "active") query.isActive = true
    else if (status === "inactive") query.isActive = false

    if (search && search.trim()) {
      query.$or = [
        { imageUrl: { $regex: search.trim(), $options: "i" } },
        { imageKey: { $regex: search.trim(), $options: "i" } },
      ]
    }

    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 }

    const totalFiltered = await Banner.countDocuments(query)
    const banners = await Banner.find(query)
      .populate("createdBy", "username")
      .populate("updatedBy", "username")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()

    const [totalAll, activeAll, thisMonth] = await Promise.all([
      Banner.countDocuments({}),
      Banner.countDocuments({ isActive: true }),
      Banner.countDocuments({
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      }),
    ])

    const stats = {
      total: totalAll,
      active: activeAll,
      inactive: totalAll - activeAll,
      thisMonth,
    }

    logger.info(`Banners fetched by ${session.user.email}, page: ${page}, limit: ${limit}, total: ${totalFiltered}`)

    const responseHeaders = {
      "X-Total-Count": totalFiltered.toString(),
      "X-Total-Pages": Math.ceil(totalFiltered / limit).toString(),
    }

    if (bypassCache) {
      responseHeaders["Cache-Control"] = "no-store, no-cache, must-revalidate"
      responseHeaders["Pragma"] = "no-cache"
      responseHeaders["Expires"] = "0"
    } else {
      responseHeaders["Cache-Control"] = "private, max-age=30"
      const dataHash = crypto.createHash("md5").update(JSON.stringify({ banners, stats })).digest("hex")
      responseHeaders["ETag"] = `"banners-${dataHash}"`
      const ifNoneMatch = request.headers.get("if-none-match")
      if (ifNoneMatch === responseHeaders["ETag"]) {
        return new NextResponse(null, { status: 304, headers: responseHeaders })
      }
    }

    return NextResponse.json(
      {
        banners,
        stats,
        pagination: {
          current: page,
          total: Math.ceil(totalFiltered / limit),
          totalItems: totalFiltered,
          limit,
        },
      },
      { headers: responseHeaders },
    )
  } catch (error) {
    const status = error?.statusCode || 500
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: error.message }, { status })
    }
    logger.error("Error fetching banners:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await postLimiter.check(identifier, 10)
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
    const session = await requireAdmin()

    const body = await request.json()
    const validation = await validateRequest(bannerCreationSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { imageUrl, imageKey } = validation.data

    const adminId = await resolveAdminIdFromSession(session)

    const banner = await Banner.create({
      imageUrl,
      imageKey,
      isActive: true,
      createdBy: adminId,
    })

    logger.info(`Banner created by ${session.user.email}: ${imageKey}`)

    return NextResponse.json(
      { success: true, banner, message: "Banner berhasil dibuat" },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "banner-created",
        },
      },
    )
  } catch (error) {
    const status = error?.statusCode || 500
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: error.message }, { status })
    }
    logger.error("Error creating banner:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
