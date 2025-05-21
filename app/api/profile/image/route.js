import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import { authenticateRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"

export async function GET(request) {
  try {
    await connectToDatabase()

    const authResult = await authenticateRequest(request)

    // Tambahkan pengecekan error DI SINI
    if (authResult.error) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: 401 })
    }

    logger.info("GET /api/profile/image endpoint hit, user:", authResult.user._id)

    const admin = await Admin.findById(authResult.user._id)

    if (!admin) {
      return NextResponse.json({ success: false, message: "Admin not found" }, { status: 404 })
    }

    if (!admin.profileImage) {
      return NextResponse.json({ success: false, message: "No profile image found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        profileImage: admin.profileImage,
      },
    })
  } catch (error) {
    logger.error("Error fetching profile image:", error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}
