import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"

// POST reset password
export async function POST(request, { params }) {
  try {
    await connectToDatabase()

    // Authenticate and authorize user (only super-admin)
    const authResult = await authorizeRequest(["super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const body = await request.json()
    const { password } = body

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const user = await Admin.findById(params.id)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Update password
    user.password = password
    await user.save()

    logger.info(`Password reset for user ${user.username} by ${authResult.user.username}`)

    return NextResponse.json({
      status: "success",
      message: "Password reset successfully",
    })
  } catch (error) {
    logger.error("Error resetting password:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
