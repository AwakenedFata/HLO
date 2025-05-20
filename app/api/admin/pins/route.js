import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import { validateRequest, pinCreationSchema } from "@/lib/utils/validation"
import { generateUniquePin } from "@/lib/utils/pinGenerator"
import logger from "@/lib/utils/logger-server"

// GET all pins with pagination and optimization
export async function GET(request) {
  try {
    await connectToDatabase()

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    // Get URL parameters for pagination
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "500", 10) // Default to 500 pins
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const skip = (page - 1) * limit

    // Get filter parameters if any
    const filterUsed = searchParams.get("used")
    const filterProcessed = searchParams.get("processed")
    const searchTerm = searchParams.get("search")

    // Build query object
    const query = {}
    if (filterUsed !== null) {
      query.used = filterUsed === "true"
    }
    if (filterProcessed !== null) {
      query.processed = filterProcessed === "true"
    }
    if (searchTerm) {
      query.code = { $regex: searchTerm, $options: "i" }
    }

    // Get total count for pagination info (with applied filters)
    const totalCount = await PinCode.countDocuments(query)

    // Get pins with pagination and projection to reduce data size
    const pins = await PinCode.find(query, {
      code: 1,
      used: 1,
      processed: 1,
      "redeemedBy.nama": 1,
      "redeemedBy.idGame": 1,
      "redeemedBy.redeemedAt": 1,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean() // Use lean() for better performance

    // Get counts for dashboard stats (do this in a separate query to avoid filtering issues)
    const [usedCount, pendingCount] = await Promise.all([
      PinCode.countDocuments({ used: true }),
      PinCode.countDocuments({ used: true, processed: false }),
    ])

    return NextResponse.json({
      pins,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      stats: {
        total: totalCount,
        used: usedCount,
        unused: totalCount - usedCount,
        pending: pendingCount,
        processed: usedCount - pendingCount,
      },
    })
  } catch (error) {
    logger.error("Error fetching pins:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST generate new pins - optimized for batch operations
export async function POST(request) {
  try {
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
