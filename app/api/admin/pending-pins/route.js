import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import crypto from "crypto"

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
        .lean(),

      // Get total count in parallel
      PinCode.countDocuments({ used: true, processed: false }),
    ])

    logger.info(`Pending pins fetched by ${authResult.user.username}, page: ${page}, limit: ${limit}`)

    // Create a response object
    const responseData = {
      pins: pendingPins,
      count: pendingPins.length,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    }

    // Generate ETag based on response data
    const dataHash = crypto
      .createHash('md5')
      .update(JSON.stringify(responseData))
      .digest('hex')
    const etag = `"pins-${dataHash}"`
    
    // Check if client has a valid cached version
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { 
        status: 304, 
        headers: {
          'ETag': etag,
          'Cache-Control': 'private, max-age=10',
        }
      })
    }

    // Return response with caching headers
    return NextResponse.json(
      responseData,
      { 
        headers: {
          'ETag': etag,
          'Cache-Control': 'private, max-age=10',
        }
      }
    )
  } catch (error) {
    logger.error("Error fetching pending pins:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}