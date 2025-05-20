import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { promisify } from "util"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import logger from "@/lib/utils/logger-server"
import { validateRequest, refreshTokenSchema } from "@/lib/utils/validation"

// Fungsi untuk membuat token JWT
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  })
}

export async function POST(request) {
  try {
    await connectToDatabase()

    // Get refresh token from cookies or request body
    let refreshToken
    const cookieStore = request.cookies
    refreshToken = cookieStore.get("refreshToken")?.value

    if (!refreshToken) {
      const body = await request.json()
      refreshToken = body.refreshToken
    }

    if (!refreshToken) {
      return NextResponse.json({ status: "error", message: "Refresh token tidak diberikan" }, { status: 401 })
    }

    // Verify refresh token
    const decoded = await promisify(jwt.verify)(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
    )

    // Check if user still exists
    const currentUser = await Admin.findById(decoded.id)
    if (!currentUser) {
      return NextResponse.json(
        {
          status: "error",
          message: "Pengguna dengan token ini tidak ada lagi",
        },
        { status: 401 },
      )
    }

    // Create new access token
    const token = signToken(currentUser._id)

    const body = await request.json()
    const validation = await validateRequest(refreshTokenSchema, body)

    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    // Cookie options
    const cookieOptions = {
      expires: new Date(Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 1) * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    }

    // Create response
    const response = NextResponse.json({
      status: "success",
      token,
      admin: {
        id: currentUser._id,
        username: currentUser.username,
        role: currentUser.role,
        profileImage: currentUser.profileImage,
      },
    })

    // Set cookie
    response.cookies.set("jwt", token, cookieOptions)

    logger.info(`Token diperbarui untuk user: ${currentUser.username}`)

    return response
  } catch (err) {
    logger.error(`Error pada refresh token: ${err.message}`)
    return NextResponse.json(
      {
        status: "error",
        message: "Refresh token tidak valid atau kedaluwarsa",
      },
      { status: 401 },
    )
  }
}
