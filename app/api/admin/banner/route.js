import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Banner from "@/lib/models/banner"
import { authorizeRequest } from "@/lib/utils/auth-server"
import { validateRequest, bannerCreationSchema } from "@/lib/utils/validation"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for GET endpoint
const getLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 30, // 30 requests per minute
})

// Rate limiter for POST endpoint
const postLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 10, // 10 requests per minute
})

// GET all banners with pagination and filtering
export async function GET(request) {
  try {
    // Apply rate limiting
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

    await connectToDatabase()

    // Authentication and authorization
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Extract and clean query parameters
    const queryParams = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "20",
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
      status: searchParams.get("status") || "all",
    }

    // Remove null/empty string values
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] === null || queryParams[key] === "") {
        delete queryParams[key]
      }
    })

    const { page = "1", limit = "20", search, sortBy = "createdAt", sortOrder = "desc", status = "all" } = queryParams

    const pageNum = Number.parseInt(page, 10)
    const limitNum = Number.parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    // Check for cache busting parameter
    const cacheBuster = searchParams.get("_t")
    const bypassCache = cacheBuster || request.headers.get("cache-control")?.includes("no-cache")

    // Build query filter based on status
    const query = {}
    if (status === "active") {
      query.isActive = true
    } else if (status === "inactive") {
      query.isActive = false
    }
    // If status is "all", don't add isActive filter

    // Add search filter if provided
    if (search && search.trim()) {
      query.$or = [
        { imageUrl: { $regex: search.trim(), $options: "i" } },
        { imageKey: { $regex: search.trim(), $options: "i" } },
      ]
    }

    // Build sort object
    const sort = {}
    sort[sortBy] = sortOrder === "asc" ? 1 : -1

    const totalFiltered = await Banner.countDocuments(query)

    const banners = await Banner.find(query)
      .populate("createdBy", "username")
      .populate("updatedBy", "username")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean()

    // Calculate statistics
    const [totalAll, activeAll] = await Promise.all([
      Banner.countDocuments({}),
      Banner.countDocuments({ isActive: true }),
    ])

    const stats = {
      total: totalAll,
      active: activeAll,
      inactive: totalAll - activeAll,
      thisMonth: await Banner.countDocuments({
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      }),
    }

    logger.info(
      `Banners fetched by ${authResult.user.username}, page: ${pageNum}, limit: ${limitNum}, total: ${totalFiltered}`,
    )

    // Prepare response headers
    const responseHeaders = {
      "X-Total-Count": totalFiltered.toString(),
      "X-Total-Pages": Math.ceil(totalFiltered / limitNum).toString(),
    }

    // Handle caching
    if (bypassCache) {
      responseHeaders["Cache-Control"] = "no-store, no-cache, must-revalidate"
      responseHeaders["Pragma"] = "no-cache"
      responseHeaders["Expires"] = "0"
    } else {
      responseHeaders["Cache-Control"] = "private, max-age=30"

      // Generate ETag
      const dataHash = require("crypto").createHash("md5").update(JSON.stringify({ banners, stats })).digest("hex")
      responseHeaders["ETag"] = `"banners-${dataHash}"`

      // Check if client has cached version
      const ifNoneMatch = request.headers.get("if-none-match")
      if (ifNoneMatch === responseHeaders["ETag"]) {
        return new NextResponse(null, {
          status: 304,
          headers: responseHeaders,
        })
      }
    }

    return NextResponse.json(
      {
        banners,
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
    logger.error("Error fetching banners:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

// POST create new banner
export async function POST(request) {
  try {
    // Apply rate limiting
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

    // Authentication and authorization
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const body = await request.json()

    // Validate request
    const validation = await validateRequest(bannerCreationSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { imageUrl, imageKey } = validation.data

    // Create banner item
    const banner = await Banner.create({
      imageUrl,
      imageKey,
      createdBy: authResult.user._id,
      isActive: true,
    })

    await banner.populate("createdBy", "username")

    logger.info(`Banner created by ${authResult.user.username}: ${imageKey}`)

    return NextResponse.json(
      {
        success: true,
        banner,
        message: "Banner berhasil dibuat",
      },
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
    logger.error("Error creating banner:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
