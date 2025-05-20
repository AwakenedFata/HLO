import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"

// GET all users
export async function GET(request) {
  try {
    await connectToDatabase()

    // Authenticate and authorize user (only super-admin)
    const authResult = await authorizeRequest(["super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const users = await Admin.find().select("-password")

    return NextResponse.json({ users })
  } catch (error) {
    logger.error("Error fetching users:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// POST create new user
export async function POST(request) {
  try {
    await connectToDatabase()

    // Authenticate and authorize user (only super-admin)
    const authResult = await authorizeRequest(["super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    const body = await request.json()
    const { username, email, password, role = "admin" } = body

    // Validate input
    if (!username || username.length < 4) {
      return NextResponse.json({ error: "Username must be at least 4 characters" }, { status: 400 })
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    // Check if username or email already exists
    const existingUser = await Admin.findOne({
      $or: [{ username }, { email }],
    })

    if (existingUser) {
      return NextResponse.json(
        { error: existingUser.username === username ? "Username already exists" : "Email already exists" },
        { status: 400 },
      )
    }

    // Create new user
    const newUser = new Admin({
      username,
      email,
      password,
      role,
    })

    await newUser.save()

    // Remove password from response
    newUser.password = undefined

    logger.info(`New user ${username} created by ${authResult.user.username}`)

    return NextResponse.json({
      status: "success",
      message: "User created successfully",
      user: newUser,
    })
  } catch (error) {
    logger.error("Error creating user:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
