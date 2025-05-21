import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import logger from "@/lib/utils/logger-server"

export async function GET(request) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get("Authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ status: "error", message: "No token provided", valid: false }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]

    if (!token) {
      return NextResponse.json({ status: "error", message: "Invalid token format", valid: false }, { status: 401 })
    }

    // Verify token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (error) {
      logger.warn(`Invalid token: ${error.message}`)
      return NextResponse.json({ status: "error", message: "Invalid token", valid: false }, { status: 401 })
    }

    // Connect to database
    await connectToDatabase()

    // Find user
    const admin = await Admin.findById(decoded.id)
    if (!admin) {
      return NextResponse.json({ status: "error", message: "User not found", valid: false }, { status: 401 })
    }

    // Return success
    return NextResponse.json({
      status: "success",
      valid: true,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        profileImage: admin.profileImage,
      },
    })
  } catch (error) {
    logger.error(`Token verification error: ${error.message}`)
    return NextResponse.json({ status: "error", message: "Token verification failed", valid: false }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get("Authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ status: "error", message: "No token provided", valid: false }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]

    if (!token) {
      return NextResponse.json({ status: "error", message: "Invalid token format", valid: false }, { status: 401 })
    }

    // Verify token
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (error) {
      logger.warn(`Invalid token: ${error.message}`)
      return NextResponse.json({ status: "error", message: "Invalid token", valid: false }, { status: 401 })
    }

    // Connect to database
    await connectToDatabase()

    // Find user
    const admin = await Admin.findById(decoded.id)
    if (!admin) {
      return NextResponse.json({ status: "error", message: "User not found", valid: false }, { status: 401 })
    }

    // Return success
    return NextResponse.json({
      status: "success",
      valid: true,
      admin: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        profileImage: admin.profileImage,
      },
    })
  } catch (error) {
    logger.error(`Token verification error: ${error.message}`)
    return NextResponse.json({ status: "error", message: "Token verification failed", valid: false }, { status: 500 })
  }
}
