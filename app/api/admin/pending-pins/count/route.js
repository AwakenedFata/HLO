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

    // Only count pending pins (used but not processed)
    const count = await PinCode.countDocuments({ used: true, processed: false })

    logger.info(`Pending pins count fetched by ${authResult.user.username}: ${count}`)

    // Generate ETag based on count
    const etag = `"count-${count}"`
    
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
      { count },
      { 
        headers: {
          'ETag': etag,
          'Cache-Control': 'private, max-age=10',
        }
      }
    )
  } catch (error) {
    logger.error("Error fetching pending pins count:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}