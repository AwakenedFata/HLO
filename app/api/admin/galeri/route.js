import { NextResponse } from "next/server"
import crypto from "crypto"
import connectToDatabase from "@/lib/db"
import Gallery from "@/lib/models/galleryItems"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"
import { validateRequest, galleryCreationSchema, galleryQuerySchema } from "@/lib/utils/validation"
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
    // rate limit
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
    const { session } = guard

    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const queryParams = {
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || undefined,
      status: searchParams.get("status") || undefined,
    }
    Object.keys(queryParams).forEach((k) => {
      if (queryParams[k] === null || queryParams[k] === "") delete queryParams[k]
    })

    const queryValidation = await validateRequest(galleryQuerySchema, queryParams)
    if (!queryValidation.success) {
      logger.warn("Gallery query validation failed:", queryValidation.error)
      return NextResponse.json(queryValidation.error, { status: 400 })
    }

    const {
      page = "1",
      limit = "20",
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      status = "all",
    } = queryValidation.data

    const pageNum = Number.parseInt(page, 10)
    const limitNum = Number.parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    // cache controls
    const cacheBuster = searchParams.get("_t")
    const bypassCache = !!cacheBuster || request.headers.get("cache-control")?.includes("no-cache")

    // build query
    const query = {}
    if (status === "active") query.isActive = true
    else if (status === "inactive") query.isActive = false

    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { label: { $regex: search.trim(), $options: "i" } },
        { location: { $regex: search.trim(), $options: "i" } },
      ]
    }

    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 }

    const totalFiltered = await Gallery.countDocuments(query)
    const galleries = await Gallery.find(query)
      .populate("createdBy", "username")
      .populate("updatedBy", "username")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean()

    const [totalAll, activeAll, thisMonth] = await Promise.all([
      Gallery.countDocuments({}),
      Gallery.countDocuments({ isActive: true }),
      Gallery.countDocuments({
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      }),
    ])

    const stats = {
      total: totalAll,
      active: activeAll,
      inactive: totalAll - activeAll,
      thisMonth,
    }

    logger.info(
      `Galleries fetched by ${session.user.email}, page: ${pageNum}, limit: ${limitNum}, total: ${totalFiltered}`,
    )

    const responseHeaders = {
      "X-Total-Count": totalFiltered.toString(),
      "X-Total-Pages": Math.ceil(totalFiltered / limitNum).toString(),
    }

    if (bypassCache) {
      responseHeaders["Cache-Control"] = "no-store, no-cache, must-revalidate"
      responseHeaders["Pragma"] = "no-cache"
      responseHeaders["Expires"] = "0"
    } else {
      responseHeaders["Cache-Control"] = "private, max-age=30"
      const dataHash = crypto.createHash("md5").update(JSON.stringify({ galleries, stats })).digest("hex")
      responseHeaders["ETag"] = `"galleries-${dataHash}"`
      const ifNoneMatch = request.headers.get("if-none-match")
      if (ifNoneMatch === responseHeaders["ETag"]) {
        return new NextResponse(null, { status: 304, headers: responseHeaders })
      }
    }

    return NextResponse.json(
      {
        galleries,
        stats,
        pagination: {
          current: pageNum,
          total: Math.ceil(totalFiltered / limitNum),
          totalItems: totalFiltered,
          limit: limitNum,
        },
      },
      { headers: responseHeaders },
    )
  } catch (error) {
    logger.error("Error fetching galleries:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    // rate limit
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

    let session
    try {
      session = await requireAdmin()
    } catch (err) {
      const status = err?.statusCode || 401
      return NextResponse.json({ status: "error", message: err?.message || "Unauthorized" }, { status })
    }
    const adminId = await resolveAdminIdFromSession(session)

    const body = await request.json()
    const validation = await validateRequest(galleryCreationSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { title, label, location, mapLink, uploadDate, imageUrl, imageKey } = validation.data

    const gallery = await Gallery.create({
      title,
      label,
      location,
      mapLink,
      uploadDate: uploadDate ? new Date(uploadDate) : new Date(),
      imageUrl,
      imageKey,
      createdBy: adminId, // use Admin ObjectId
      isActive: true,
    })

    await gallery.populate("createdBy", "username")
    logger.info(`Gallery created by ${session.user.email}: ${title}`)

    return NextResponse.json(
      { success: true, gallery, message: "Gallery berhasil dibuat" },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "gallery-created",
        },
      },
    )
  } catch (error) {
    logger.error("Error creating gallery:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
