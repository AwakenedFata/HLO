import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Create a rate limiter for pending pins endpoint
const pendingPinsRateLimiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  limit: 20, // 20 requests per minute
  identifier: "pending-pins",
})

export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || request.ip || "anonymous"
    const rateLimitResult = await pendingPinsRateLimiter.check(identifier)

    // If rate limit exceeded, return 429 response
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          reset: 60,
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Limit": "20",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": "60",
          },
        },
      )
    }

    // Get token from Authorization header
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    if (!token) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 401 })
    }

    // Verify token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (error) {
      logger.warn(`Invalid token: ${error.message}`)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    await connectToDatabase()

    // Find admin user
    const Admin = require("@/lib/models/admin").default
    const admin = await Admin.findById(decoded.id)
    if (!admin) {
      return NextResponse.json({ error: "User not found" }, { status: 401 })
    }

    // Check if user has admin role
    if (!["admin", "super-admin"].includes(admin.role)) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    // Get URL parameters for pagination
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10)
    const page = Number.parseInt(searchParams.get("page") || "1", 10)

    // Validate pagination parameters
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid pagination parameters" }, { status: 400 })
    }

    const skip = (page - 1) * limit

    // Use a more efficient query with projection and pagination
    // Only select fields we actually need to reduce data transfer
    const [pendingPins, totalCount] = await Promise.all([
      PinCode.find(
        { used: true, processed: false },
        {
          _id: 1,
          code: 1,
          "redeemedBy.nama": 1,
          "redeemedBy.idGame": 1,
          "redeemedBy.redeemedAt": 1,
        },
      )
        .sort({ "redeemedBy.redeemedAt": -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for better performance

      // Get total count in parallel
      PinCode.countDocuments({ used: true, processed: false }),
    ])

    logger.info(`Pending pins fetched by ${admin.username}, page: ${page}, limit: ${limit}`)

    return NextResponse.json(
      {
        pins: pendingPins,
        count: pendingPins.length,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      {
        headers: {
          // Add cache control headers
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": "19",
          "X-RateLimit-Reset": "60",
        },
      },
    )
  } catch (error) {
    logger.error("Error fetching pending pins:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
