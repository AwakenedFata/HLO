import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Article from "@/lib/models/article"
import { validateRequest, articleCreationSchema, articleQuerySchema } from "@/lib/utils/validation"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdmin, requireAdminSession } from "@/lib/utils/auth"
import { resolveAdminIdFromSession } from "@/lib/utils/admin-guard"

const getLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 100, limit: 30 })
const postLimiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 100, limit: 10 })

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

    await connectToDatabase()

  const guard = await requireAdminSession()
  if (!guard.ok) {
    return NextResponse.json({ status: "error", message: guard.message }, { status: guard.status })
  }
  const { session } = guard

    const { searchParams } = new URL(request.url)
    const rawParams = {
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || undefined,
      status: searchParams.get("status") || undefined,
      relatedGallery: searchParams.get("relatedGallery") || undefined,
    }
    Object.keys(rawParams).forEach((k) => {
      if (rawParams[k] === null || rawParams[k] === "") delete rawParams[k]
    })

    const queryValidation = await validateRequest(articleQuerySchema, rawParams)
    if (!queryValidation.success) {
      logger.warn(`Article query validation failed:`, queryValidation.error)
      return NextResponse.json(queryValidation.error, { status: 400 })
    }

    const {
      page = "1",
      limit = "20",
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      status = "all",
      relatedGallery,
    } = queryValidation.data

    const pageNum = Number.parseInt(page, 10)
    const limitNum = Number.parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    const cacheBuster = searchParams.get("_t")
    const bypassCache = cacheBuster || request.headers.get("cache-control")?.includes("no-cache")

    const query = {}
    if (status === "published") query.status = "published"
    else if (status === "draft") query.status = "draft"
    else if (status === "archived") query.status = "archived"

    if (relatedGallery) query.relatedGallery = relatedGallery

    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { content: { $regex: search.trim(), $options: "i" } },
        { excerpt: { $regex: search.trim(), $options: "i" } },
        { tags: { $in: [new RegExp(search.trim(), "i")] } },
      ]
    }

    const sort = {}
    sort[sortBy] = sortOrder === "asc" ? 1 : -1

    const totalFiltered = await Article.countDocuments(query)
    const articles = await Article.find(query)
      .populate("createdBy", "username")
      .populate("updatedBy", "username")
      .populate("relatedGallery", "title label")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean()

    const [totalAll, publishedAll, draftAll, archivedAll, thisMonth] = await Promise.all([
      Article.countDocuments({}),
      Article.countDocuments({ status: "published" }),
      Article.countDocuments({ status: "draft" }),
      Article.countDocuments({ status: "archived" }),
      Article.countDocuments({
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      }),
    ])

    const stats = { total: totalAll, published: publishedAll, draft: draftAll, archived: archivedAll, thisMonth }

    logger.info
      (`Articles fetched by ${session.user.email}, page: ${pageNum}, limit: ${limitNum}, total: ${totalFiltered}`,
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
      const crypto = await import("crypto")
      const dataHash = crypto.createHash("md5").update(JSON.stringify({ articles, stats })).digest("hex")
      responseHeaders["ETag"] = `"articles-${dataHash}"`
      const ifNoneMatch = request.headers.get("if-none-match")
      if (ifNoneMatch === responseHeaders["ETag"]) {
        return new NextResponse(null, { status: 304, headers: responseHeaders })
      }
    }

    return NextResponse.json(
      {
        articles,
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
    logger.error("Error fetching articles:", error)
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

    let session
    try {
      session = await requireAdmin()
    } catch (err) {
      const status = err?.statusCode || 401
      logger.error(`[POST ARTICLE] Auth failed: ${err?.message || "Unknown error"}`)
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
    
    if (!adminId) {
      logger.error(`[POST ARTICLE] Failed to resolve admin ID from session`)
      return NextResponse.json(
        { 
          status: "error", 
          message: "Failed to identify admin user",
          error: "Admin ID resolution failed"
        }, 
        { status: 401 }
      )
    }

    const body = await request.json()
    
    logger.info(`[POST ARTICLE] Raw body received:`, {
      hasTitle: !!body.title,
      hasContent: !!body.content,
      status: body.status,
      publishedAt: body.publishedAt,
      publishedAtType: typeof body.publishedAt,
      tagsType: typeof body.tags,
      tagsLength: Array.isArray(body.tags) ? body.tags.length : 'not-array',
    })
    
    // Normalisasi tags jika string
    if (body.tags && typeof body.tags === "string") {
      body.tags = body.tags
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#/, "").trim())
        .filter(Boolean)
    }

    // CRITICAL FIX: Clean publishedAt sebelum validasi
    if (body.publishedAt === null || body.publishedAt === "" || body.publishedAt === undefined) {
      delete body.publishedAt
    }
    
    // Jika draft/archived, hapus publishedAt
    if (body.status === "draft" || body.status === "archived") {
      delete body.publishedAt
    }

    logger.info(`[POST ARTICLE] After normalization:`, {
      status: body.status,
      hasPublishedAt: 'publishedAt' in body,
      publishedAt: body.publishedAt,
      tags: body.tags,
    })

    const validation = await validateRequest(articleCreationSchema, body)
    if (!validation.success) {
      logger.error(`[POST ARTICLE] Validation failed:`, validation.error)
      return NextResponse.json({
        status: "error",
        message: "Validation failed",
        errors: validation.error,
      }, { status: 400 })
    }

    const {
      title,
      content,
      excerpt,
      coverImage,
      coverImageKey,
      relatedGallery,
      tags,
      status,
      publishedAt,
      contentImages,
    } = validation.data

    logger.info(`[POST ARTICLE] Creating article: "${title}" by admin ID: ${adminId}`)

    // Prepare publishedAt
    let finalPublishedAt = undefined
    if (status === "published") {
      if (publishedAt) {
        finalPublishedAt = new Date(publishedAt)
      } else {
        finalPublishedAt = new Date()
      }
    }

    const article = await Article.create({
      title,
      content,
      excerpt: excerpt || "",
      coverImage: coverImage || "",
      coverImageKey: coverImageKey || "",
      relatedGallery: relatedGallery || undefined,
      tags: Array.isArray(tags) ? tags : [],
      status: status || "draft",
      publishedAt: finalPublishedAt,
      contentImages: Array.isArray(contentImages) ? contentImages : [],
      createdBy: adminId,
      isActive: true,
    })

    await article.populate([
      { path: "createdBy", select: "username" },
      { path: "relatedGallery", select: "title label" },
    ])

    logger.info(`[POST ARTICLE] Article created successfully: ${article._id}`)

    return NextResponse.json(
      { success: true, article, message: "Artikel berhasil dibuat" },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "article-created",
        },
      },
    )
  } catch (error) {
    logger.error("[POST ARTICLE] Error:", error)
    logger.error("[POST ARTICLE] Stack:", error.stack)
    
    return NextResponse.json(
      { 
        status: "error",
        error: "Server error", 
        message: error.message || "An unexpected error occurred",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    )
  }
}