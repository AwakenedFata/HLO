import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import fs from "fs"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import { authenticateRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"

export async function POST(request) {
  try {
    await connectToDatabase()

    // Authenticate user
    const authResult = await authenticateRequest(request)
    if (authResult.error) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: 401 })
    }

    logger.info("POST /api/profile/upload-image endpoint hit")

    const formData = await request.formData()
    const file = formData.get("file")

    if (!file) {
      return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ success: false, message: "Only image files are allowed" }, { status: 400 })
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: "File size exceeds 5MB limit" }, { status: 400 })
    }

    const admin = await Admin.findById(authResult.user._id)

    if (!admin) {
      return NextResponse.json({ success: false, message: "Admin not found" }, { status: 404 })
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "profiles")
    if (!fs.existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Delete old profile image if it exists
    if (admin.profileImage) {
      const oldImagePath = path.join(process.cwd(), "public", admin.profileImage)
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath)
      }
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const fileExt = path.extname(file.name)
    const filename = `profile-${uniqueSuffix}${fileExt}`
    const filepath = path.join(uploadsDir, filename)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Set the new profile image path (relative to public directory)
    const relativePath = `/uploads/profiles/${filename}`
    admin.profileImage = relativePath

    await admin.save()

    return NextResponse.json({
      success: true,
      message: "Profile image updated successfully",
      data: {
        profileImage: admin.profileImage,
      },
    })
  } catch (error) {
    logger.error("Error uploading profile image:", error)
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}

// Increase payload size limit for file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
}
