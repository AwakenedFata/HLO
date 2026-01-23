import { NextResponse } from "next/server"
import connectDB from "@/lib/db"
import Frame from "@/lib/models/frame"
import Gallery from "@/lib/models/galleryItems"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"
import { validateRequest, frameCreationSchema, frameQuerySchema } from "@/lib/utils/validation"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { resolveAdminIdFromSession } from "@/lib/utils/admin-guard"

const getLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 100, limit: 30 })
const postLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 100, limit: 10 })

export async function GET(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await getLimiter.check(identifier, 30)
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

    // PERBAIKAN: Gunakan pattern yang sama dengan Gallery
    const guard = await requireAdminSession()
    if (!guard.ok) {
      return NextResponse.json({ status: "error", message: guard.message }, { status: guard.status })
    }
    const { session } = guard

    await connectDB()

    const { searchParams } = new URL(request.url)
    const queryParams = {
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      relatedGallery: searchParams.get("relatedGallery") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || undefined,
      status: searchParams.get("status") || undefined,
    }
    Object.keys(queryParams).forEach((k) => {
      if (queryParams[k] === null || queryParams[k] === "") delete queryParams[k]
    })

    const queryValidation = await validateRequest(frameQuerySchema, queryParams)
    if (!queryValidation.success) {
      logger.warn("Frame query validation failed:", queryValidation.error)
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

    const query = {}
    if (status === "active") query.isActive = true
    else if (status === "inactive") query.isActive = false
    if (relatedGallery) query.relatedGallery = relatedGallery

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

    const [totalAll, activeAll, thisMonth] = await Promise.all([
      Frame.countDocuments({}),
      Frame.countDocuments({ isActive: true }),
      Frame.countDocuments({
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      }),
    ])

    const stats = { total: totalAll, active: activeAll, inactive: totalAll - activeAll, thisMonth }

    logger.info(
      `Frames fetched by ${session.user.email}, page: ${pageNum}, limit: ${limitNum}, total: ${totalFiltered}`
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

export async function POST(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await postLimiter.check(identifier, 10)
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

    await connectDB()

    // PERBAIKAN: Gunakan pattern yang sama dengan Gallery
    let session
    try {
      session = await requireAdmin()
    } catch (err) {
      const status = err?.statusCode || 401
      return NextResponse.json({ status: "error", message: err?.message || "Unauthorized" }, { status })
    }
    const adminId = await resolveAdminIdFromSession(session)

    const body = await request.json()
    const validation = await validateRequest(frameCreationSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { imageUrl, imageKey, relatedGallery, originalName, fileSize, mimeType } = validation.data

    const gallery = await Gallery.findById(relatedGallery)
    if (!gallery) {
      return NextResponse.json({ error: "Gallery tidak ditemukan" }, { status: 404 })
    }

    const frame = await Frame.create({
      imageUrl,
      imageKey,
      relatedGallery,
      originalName,
      fileSize,
      mimeType,
      isActive: true,
      createdBy: adminId,
    })

    await frame.populate([
      { path: "relatedGallery", select: "title label" },
      { path: "createdBy", select: "username" },
    ])

    logger.info(`Frame created by ${session.user.email} for gallery: ${gallery.title}`)

    return NextResponse.json(
      { success: true, frame, message: "Frame berhasil ditambahkan" },
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