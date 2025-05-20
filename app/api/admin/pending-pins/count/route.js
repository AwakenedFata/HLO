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

    return NextResponse.json({ count })
  } catch (error) {
    logger.error("Error fetching pending pins count:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
