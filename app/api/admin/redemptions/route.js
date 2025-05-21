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
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const redemptions = await PinCode.find({ used: true }).sort({ "redeemedBy.redeemedAt": -1 })

    return NextResponse.json({ redemptions })
  } catch (error) {
    logger.error("Error fetching redemptions:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
