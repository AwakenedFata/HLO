import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"

// GET user by ID
export async function GET(request, { params }) {
  try {
    await connectToDatabase()

    // Authenticate and authorize user (only super-admin)
    const authResult = await authorizeRequest(["super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const user = await Admin.findById(params.id).select("-password")

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    logger.error("Error fetching user:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH update user
export async function PATCH(request, { params }) {
  try {
    await connectToDatabase()

    // Authenticate and authorize user (only super-admin)
    const authResult = await authorizeRequest(["super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const body = await request.json()
    const { username, email, role } = body

    // Find user
    const user = await Admin.findById(params.id)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Update user fields if provided
    if (username) {
      // Check if username already exists
      if (username !== user.username) {
        const existingUser = await Admin.findOne({ username })
        if (existingUser) {
          return NextResponse.json({ error: "Username already exists" }, { status: 400 })
        }
        user.username = username
      }
    }

    if (email) {
      // Check if email already exists
      if (email !== user.email) {
        const existingUser = await Admin.findOne({ email })
        if (existingUser) {
          return NextResponse.json({ error: "Email already exists" }, { status: 400 })
        }
        user.email = email
      }
    }

    if (role && (role === "admin" || role === "super-admin")) {
      user.role = role
    }

    await user.save()

    logger.info(`User ${user.username} updated by ${authResult.user.username}`)

    return NextResponse.json({
      status: "success",
      message: "User updated successfully",
      user,
    })
  } catch (error) {
    logger.error("Error updating user:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE user
export async function DELETE(request, { params }) {
  try {
    await connectToDatabase()

    // Authenticate and authorize user (only super-admin)
    const authResult = await authorizeRequest(["super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    // Prevent deleting yourself
    if (params.id === authResult.user._id.toString()) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 })
    }

    const user = await Admin.findById(params.id)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const username = user.username

    await Admin.findByIdAndDelete(params.id)

    logger.info(`User ${username} deleted by ${authResult.user.username}`)

    return NextResponse.json({
      status: "success",
      message: "User deleted successfully",
    })
  } catch (error) {
    logger.error("Error deleting user:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
