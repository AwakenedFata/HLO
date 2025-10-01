import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Gallery from "@/lib/models/galleryItems"
import { authorizeRequest } from "@/lib/utils/auth-server"
import { validateRequest, galleryCreationSchema, galleryQuerySchema } from "@/lib/utils/validation"
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

// GET all galleries with pagination and filtering
// Updated GET handler in route.js
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
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || undefined,
      status: searchParams.get("status") || undefined,
    }

    // Remove null/empty string values
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] === null || queryParams[key] === '') {
        delete queryParams[key]
      }
    })

    // Validate query parameters
    const queryValidation = await validateRequest(galleryQuerySchema, queryParams)

    if (!queryValidation.success) {
      logger.warn(`Gallery query validation failed:`, queryValidation.error)
      return NextResponse.json(queryValidation.error, { status: 400 })
    }

    const { 
      page = "1", 
      limit = "20", 
      search, 
      sortBy = "createdAt", 
      sortOrder = "desc", 
      status = "all" 
    } = queryValidation.data

    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    // Check for cache busting parameter
    const cacheBuster = searchParams.get("_t")
    const bypassCache = cacheBuster || request.headers.get("cache-control")?.includes("no-cache")

    // Build query filter based on status
    let query = {}
    if (status === "active") {
      query.isActive = true
    } else if (status === "inactive") {
      query.isActive = false
    }
    // If status is "all", don't add isActive filter

    // Add search filter if provided
    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { label: { $regex: search.trim(), $options: "i" } },
        { location: { $regex: search.trim(), $options: "i" } },
      ]
    }

    // Build sort object
    const sort = {}
    sort[sortBy] = sortOrder === "asc" ? 1 : -1

    const totalFiltered = await Gallery.countDocuments(query)

    const galleries = await Gallery.find(query)
      .populate("createdBy", "username")
      .populate("updatedBy", "username")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean()

    // Calculate statistics
    const [totalAll, activeAll] = await Promise.all([
      Gallery.countDocuments({}),
      Gallery.countDocuments({ isActive: true }),
    ])

    const stats = {
      total: totalAll,
      active: activeAll,
      inactive: totalAll - activeAll,
      thisMonth: await Gallery.countDocuments({
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      })
    }

    logger.info(`Galleries fetched by ${authResult.user.username}, page: ${pageNum}, limit: ${limitNum}, total: ${totalFiltered}`)

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
      const dataHash = require("crypto")
        .createHash("md5")
        .update(JSON.stringify({ galleries, stats }))
        .digest("hex")
      responseHeaders["ETag"] = `"galleries-${dataHash}"`

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

// POST create new gallery
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
    const validation = await validateRequest(galleryCreationSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { title, label, location, mapLink, uploadDate, imageUrl, imageKey } = validation.data

    // Create gallery item
    const gallery = await Gallery.create({
      title,
      label,
      location,
      mapLink,
      uploadDate: uploadDate ? new Date(uploadDate) : new Date(),
      imageUrl,
      imageKey,
      createdBy: authResult.user._id,
      isActive: true,
    })

    await gallery.populate("createdBy", "username")

    logger.info(`Gallery created by ${authResult.user.username}: ${title}`)

    return NextResponse.json(
      {
        success: true,
        gallery,
        message: "Gallery berhasil dibuat",
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
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
