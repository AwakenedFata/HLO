import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Frame from "@/lib/models/frame"
import Gallery from "@/lib/models/galleryItems"
import { authorizeRequest } from "@/lib/utils/auth-server"
import { validateRequest, frameCreationSchema, frameQuerySchema } from "@/lib/utils/validation"
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

// GET all frames with pagination and filtering
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
      relatedGallery: searchParams.get("relatedGallery") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || undefined,
      status: searchParams.get("status") || undefined,
    }

    // Remove null/empty string values
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] === null || queryParams[key] === "") {
        delete queryParams[key]
      }
    })

    // Validate query parameters
    const queryValidation = await validateRequest(frameQuerySchema, queryParams)

    if (!queryValidation.success) {
      logger.warn(`Frame query validation failed:`, queryValidation.error)
      return NextResponse.json(queryValidation.error, { status: 400 })
    }

    const {
      page = "1",
      limit = "20",
      relatedGallery,
      sortBy = "createdAt",
      sortOrder = "desc",
      status = "all",
    } = queryValidation.data

    const pageNum = Number.parseInt(page, 10)
    const limitNum = Number.parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    // Build query filter based on status and gallery
    const query = {}
    if (status === "active") {
      query.isActive = true
    } else if (status === "inactive") {
      query.isActive = false
    }

    if (relatedGallery) {
      query.relatedGallery = relatedGallery
    }

    // Build sort object
    const sort = {}
    sort[sortBy] = sortOrder === "asc" ? 1 : -1

    const totalFiltered = await Frame.countDocuments(query)

    const frames = await Frame.find(query)
      .populate("relatedGallery", "title label")
      .populate("createdBy", "username")
      .populate("updatedBy", "username")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean()

    // Calculate statistics
    const [totalAll, activeAll] = await Promise.all([
      Frame.countDocuments({}),
      Frame.countDocuments({ isActive: true }),
    ])

    const stats = {
      total: totalAll,
      active: activeAll,
      inactive: totalAll - activeAll,
      thisMonth: await Frame.countDocuments({
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      }),
    }

    logger.info(
      `Frames fetched by ${authResult.user.username}, page: ${pageNum}, limit: ${limitNum}, total: ${totalFiltered}`,
    )

    return NextResponse.json(
      {
        frames,
        stats,
        pagination: {
          current: pageNum,
          total: Math.ceil(totalFiltered / limitNum),
          totalItems: totalFiltered,
          limit: limitNum,
        },
      },
      {
        headers: {
          "X-Total-Count": totalFiltered.toString(),
          "X-Total-Pages": Math.ceil(totalFiltered / limitNum).toString(),
          "Cache-Control": "private, max-age=30",
        },
      },
    )
  } catch (error) {
    logger.error("Error fetching frames:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}

// POST create new frame
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
    const validation = await validateRequest(frameCreationSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { imageUrl, imageKey, relatedGallery, originalName, fileSize, mimeType } = validation.data

    // Verify that the gallery exists
    const gallery = await Gallery.findById(relatedGallery)
    if (!gallery) {
      return NextResponse.json({ error: "Gallery tidak ditemukan" }, { status: 404 })
    }

    // Create frame
    const frame = await Frame.create({
      imageUrl,
      imageKey,
      relatedGallery,
      originalName,
      fileSize,
      mimeType,
      createdBy: authResult.user._id,
      isActive: true,
    })

    await frame.populate([
      { path: "relatedGallery", select: "title label" },
      { path: "createdBy", select: "username" },
    ])

    logger.info(`Frame created by ${authResult.user.username} for gallery: ${gallery.title}`)

    return NextResponse.json(
      {
        success: true,
        frame,
        message: "Frame berhasil ditambahkan",
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "frame-created",
        },
      },
    )
  } catch (error) {
    logger.error("Error creating frame:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
