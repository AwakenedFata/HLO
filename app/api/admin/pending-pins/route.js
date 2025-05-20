import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"

export async function GET(request) {
  try {
    await connectToDatabase()

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    // Get URL parameters for pagination
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10)
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
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

    logger.info(`Pending pins fetched by ${authResult.user.username}, page: ${page}, limit: ${limit}`)

    return NextResponse.json({
      pins: pendingPins,
      count: pendingPins.length,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    })
  } catch (error) {
    logger.error("Error fetching pending pins:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
