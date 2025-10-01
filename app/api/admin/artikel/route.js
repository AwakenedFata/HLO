import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import Article from "@/lib/models/article";
import { authorizeRequest } from "@/lib/utils/auth-server";
import { validateRequest } from "@/lib/utils/validation";
import {
  articleCreationSchema,
  articleQuerySchema,
} from "@/lib/utils/validation";
import logger from "@/lib/utils/logger-server";
import { rateLimit } from "@/lib/utils/rate-limit";

// Rate limiter for GET endpoint
const getLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 30, // 30 requests per minute
});

// Rate limiter for POST endpoint
const postLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 10, // 10 requests per minute
});

// GET all articles with pagination and filtering
export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous";
    const rateLimitResult = await getLimiter.check(identifier, 30);

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
        }
      );
    }

    await connectToDatabase();

    // Authentication and authorization
    const authResult = await authorizeRequest(["admin", "super-admin"])(
      request
    );
    if (authResult.error) {
      return NextResponse.json(
        { status: "error", message: authResult.message },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Extract and clean query parameters
    const queryParams = {
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
      search: searchParams.get("search") || undefined,
      sortBy: searchParams.get("sortBy") || undefined,
      sortOrder: searchParams.get("sortOrder") || undefined,
      status: searchParams.get("status") || undefined,
      relatedGallery: searchParams.get("relatedGallery") || undefined,
    };

    // Remove null/empty string values
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] === null || queryParams[key] === "") {
        delete queryParams[key];
      }
    });

    // Validate query parameters
    const queryValidation = await validateRequest(
      articleQuerySchema,
      queryParams
    );

    if (!queryValidation.success) {
      logger.warn(`Article query validation failed:`, queryValidation.error);
      return NextResponse.json(queryValidation.error, { status: 400 });
    }

    const {
      page = "1",
      limit = "20",
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      status = "all",
      relatedGallery,
    } = queryValidation.data;

    const pageNum = Number.parseInt(page, 10);
    const limitNum = Number.parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Check for cache busting parameter
    const cacheBuster = searchParams.get("_t");
    const bypassCache =
      cacheBuster || request.headers.get("cache-control")?.includes("no-cache");

    // Build query filter based on status
    const query = {};
    if (status === "published") {
      query.status = "published";
    } else if (status === "draft") {
      query.status = "draft";
    } else if (status === "archived") {
      query.status = "archived";
    }
    // If status is "all", don't add status filter

    // Add related gallery filter if provided
    if (relatedGallery) {
      query.relatedGallery = relatedGallery;
    }

    // Add search filter if provided
    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { content: { $regex: search.trim(), $options: "i" } },
        { excerpt: { $regex: search.trim(), $options: "i" } },
        { tags: { $in: [new RegExp(search.trim(), "i")] } },
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const totalFiltered = await Article.countDocuments(query);

    const articles = await Article.find(query)
      .populate("createdBy", "username")
      .populate("updatedBy", "username")
      .populate("relatedGallery", "title label")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Calculate statistics
    const [totalAll, publishedAll, draftAll, archivedAll] = await Promise.all([
      Article.countDocuments({}),
      Article.countDocuments({ status: "published" }),
      Article.countDocuments({ status: "draft" }),
      Article.countDocuments({ status: "archived" }),
    ]);

    const stats = {
      total: totalAll,
      published: publishedAll,
      draft: draftAll,
      archived: archivedAll,
      thisMonth: await Article.countDocuments({
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      }),
    };

    logger.info(
      `Articles fetched by ${authResult.user.username}, page: ${pageNum}, limit: ${limitNum}, total: ${totalFiltered}`
    );

    // Prepare response headers
    const responseHeaders = {
      "X-Total-Count": totalFiltered.toString(),
      "X-Total-Pages": Math.ceil(totalFiltered / limitNum).toString(),
    };

    // Handle caching
    if (bypassCache) {
      responseHeaders["Cache-Control"] = "no-store, no-cache, must-revalidate";
      responseHeaders["Pragma"] = "no-cache";
      responseHeaders["Expires"] = "0";
    } else {
      responseHeaders["Cache-Control"] = "private, max-age=30";

      // Generate ETag
      const dataHash = require("crypto")
        .createHash("md5")
        .update(JSON.stringify({ articles, stats }))
        .digest("hex");
      responseHeaders["ETag"] = `"articles-${dataHash}"`;

      // Check if client has cached version
      const ifNoneMatch = request.headers.get("if-none-match");
      if (ifNoneMatch === responseHeaders["ETag"]) {
        return new NextResponse(null, {
          status: 304,
          headers: responseHeaders,
        });
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
      { headers: responseHeaders }
    );
  } catch (error) {
    logger.error("Error fetching articles:", error);
    return NextResponse.json(
      { error: "Server error", message: error.message },
      { status: 500 }
    );
  }
}

// POST create new article
export async function POST(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous";
    const rateLimitResult = await postLimiter.check(identifier, 10);

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
        }
      );
    }

    await connectToDatabase();

    // Authentication and authorization
    const authResult = await authorizeRequest(["admin", "super-admin"])(
      request
    );
    if (authResult.error) {
      return NextResponse.json(
        { status: "error", message: authResult.message },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (body.tags && typeof body.tags === "string") {
      body.tags = body.tags
        .split(" ")
        .map((tag) => tag.replace(/^#/, "").trim())
        .filter(Boolean);
    }

    // Validate request
    const validation = await validateRequest(articleCreationSchema, body);
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 });
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
    } = validation.data;

    // Create article
    const article = await Article.create({
      title,
      content,
      excerpt,
      coverImage,
      coverImageKey,
      relatedGallery: relatedGallery || undefined,
      tags: tags || [],
      status: status || "draft",
      publishedAt: publishedAt
        ? new Date(publishedAt)
        : status === "published"
        ? new Date()
        : undefined,
      contentImages: contentImages || [],
      createdBy: authResult.user._id,
      isActive: true,
    });

    await article.populate([
      { path: "createdBy", select: "username" },
      { path: "relatedGallery", select: "title label" },
    ]);

    logger.info(`Article created by ${authResult.user.username}: ${title}`);

    return NextResponse.json(
      {
        success: true,
        article,
        message: "Artikel berhasil dibuat",
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Data-Updated": "true",
          "X-Update-Type": "article-created",
        },
      }
    );
  } catch (error) {
    logger.error("Error creating article:", error);
    return NextResponse.json(
      { error: "Server error", message: error.message },
      { status: 500 }
    );
  }
}
