import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import { validateRequest, pinCreationSchema } from "@/lib/utils/validation"
import { generateUniquePin } from "@/lib/utils/pinGenerator"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Create a rate limiter for pins endpoint
const pinsRateLimiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  limit: 15, // 15 requests per minute
  identifier: "pins",
})

// Create a stricter rate limiter for pins creation endpoint
const createRateLimiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  limit: 5, // 5 requests per minute for creation
  identifier: "pins-create",
})

// GET all pins with pagination and optimization
export async function GET(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || request.ip || "anonymous"
    const rateLimitResult = await pinsRateLimiter.check(identifier)

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
            "X-RateLimit-Limit": "15",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": "60",
          },
        },
      )
    }

    await connectToDatabase()

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    // Get URL parameters for pagination
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "100", 10) // Default to 100 pins
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const skip = (page - 1) * limit

    // Get filter parameters if any
    const status = searchParams.get("status") || "all"
    const searchTerm = searchParams.get("search") || ""

    // Build query object based on status
    const query = {}
    if (status === "available") {
      query.used = false
    } else if (status === "pending") {
      query.used = true
      query.processed = false
    } else if (status === "processed") {
      query.used = true
      query.processed = true
    }

    // Add search filter if provided
    if (searchTerm) {
      query.$or = [
        { code: { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.nama": { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.idGame": { $regex: searchTerm, $options: "i" } },
      ]
    }

    // Execute queries in parallel for better performance
    const [pins, totalCount] = await Promise.all([
      PinCode.find(query, {
        _id: 1,
        code: 1,
        used: 1,
        processed: 1,
        "redeemedBy.nama": 1,
        "redeemedBy.idGame": 1,
        "redeemedBy.redeemedAt": 1,
        createdAt: 1,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean() // Use lean() for better performance
        .hint({ createdAt: -1 }), // Add index hint for better query performance

      PinCode.countDocuments(query),
    ])

    logger.info(`Pins fetched by ${authResult.user.username}, page: ${page}, limit: ${limit}, status: ${status}`)

    return NextResponse.json(
      {
        pins,
        total: totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
      },
      {
        headers: {
          // Add cache control headers
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    )
  } catch (error) {
    logger.error("Error fetching pins:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST generate new pins - optimized for batch operations
export async function POST(request) {
  try {
    // Apply rate limiting - stricter for creation
    const identifier = request.headers.get("x-forwarded-for") || request.ip || "anonymous"
    const rateLimitResult = await createRateLimiter.check(identifier)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          reset: 60,
        },
        { status: 429 },
      )
    }

    await connectToDatabase()

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const body = await request.json()

    // Validate request
    const validation = await validateRequest(pinCreationSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { count = 10, prefix = "" } = body

    // Limit the maximum number of pins that can be generated at once
    const maxPinsPerRequest = 1000
    if (count > maxPinsPerRequest) {
      return NextResponse.json(
        { error: `Maksimum ${maxPinsPerRequest} PIN dapat dibuat dalam satu permintaan` },
        { status: 400 },
      )
    }

    // Generate PINs in batches for better performance
    const batchSize = 100
    const pins = []
    const now = new Date()
    const userId = authResult.user._id

    for (let i = 0; i < count; i += batchSize) {
      const batchCount = Math.min(batchSize, count - i)
      const batchPins = []

      for (let j = 0; j < batchCount; j++) {
        const code = await generateUniquePin(prefix)
        batchPins.push({
          code,
          used: false,
          processed: false,
          createdAt: now,
          createdBy: userId,
        })
      }

      // Insert batch
      const result = await PinCode.insertMany(batchPins, { ordered: true })
      pins.push(...result)
    }

    logger.info(`${pins.length} PIN baru dibuat oleh ${authResult.user.username}`)

    return NextResponse.json({
      success: true,
      count: pins.length,
      message: `Berhasil generate ${pins.length} PIN baru`,
    })
  } catch (error) {
    logger.error("Error generating pins:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
