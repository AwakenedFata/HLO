import { NextResponse } from "next/server"
import crypto from "crypto"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { validateRequest, resetPasswordSchema } from "@/lib/utils/validation"
import { signToken, signRefreshToken } from "@/lib/utils/auth-server"
import RefreshToken from "@/lib/models/refreshToken" // Pastikan model ini ada

// Rate limiter for password reset (5 attempts per hour)
const limiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 500, // Max 500 users per interval
  limit: 5,
})

export async function POST(request) {
  try {
    // Apply rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Kombinasikan IP dan user-agent untuk rate limiting yang lebih akurat
    const tokenKey = `${ip}:${userAgent.substring(0, 50)}`

    const limitResult = await limiter.check(tokenKey)

    if (!limitResult.success) {
      logger.warn(`Rate limit exceeded for password reset from IP: ${ip}`)

      // Hitung waktu reset yang lebih akurat
      const retryAfter = limitResult.reset || 3600 // Default 1 jam jika tidak ada info reset

      return NextResponse.json(
        {
          status: "error",
          message: `Terlalu banyak percobaan reset password, silakan coba lagi dalam ${Math.ceil(retryAfter / 60)} menit`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(5),
            "X-RateLimit-Remaining": String(0),
            "X-RateLimit-Reset": String(retryAfter),
          },
        },
      )
    }

    // PERBAIKAN: Tambahkan timeout untuk koneksi database
    const dbConnectionPromise = connectToDatabase()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database connection timeout")), 5000),
    )

    try {
      await Promise.race([dbConnectionPromise, timeoutPromise])
    } catch (dbError) {
      logger.error(`Database connection error: ${dbError.message}`)
      return NextResponse.json(
        {
          status: "error",
          message: "Tidak dapat terhubung ke database. Silakan coba lagi.",
          errorCode: "DB_CONNECTION_ERROR",
        },
        { status: 500 },
      )
    }

    // PERBAIKAN: Tambahkan try-catch untuk parsing body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      logger.error(`Error parsing request body: ${parseError.message}`)
      return NextResponse.json(
        { status: "error", message: "Format request tidak valid", errorCode: "INVALID_REQUEST_FORMAT" },
        { status: 400 },
      )
    }

    const validation = await validateRequest(resetPasswordSchema, body)
    if (!validation.success) {
      logger.warn(`Invalid request: ${JSON.stringify(validation.error)}`)
      return NextResponse.json(validation.error, { status: 400 })
    }

    // Gunakan nama field yang sesuai dengan skema validasi yang sudah ada
    const { token, password, confirmPassword } = validation.data

    // Hash token from request
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    // Find user with valid reset token
    let user
    try {
      user = await Admin.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      })
    } catch (dbError) {
      logger.error(`Error querying database: ${dbError.message}`)
      return NextResponse.json(
        {
          status: "error",
          message: "Terjadi kesalahan saat mencari token reset",
          errorCode: "DB_QUERY_ERROR",
        },
        { status: 500 },
      )
    }

    if (!user) {
      return NextResponse.json(
        { status: "error", message: "Token tidak valid atau sudah kedaluwarsa" },
        { status: 400 },
      )
    }

    // Verify password and confirmPassword match
    if (password !== confirmPassword) {
      return NextResponse.json(
        { status: "error", message: "Password dan konfirmasi password tidak sama" },
        { status: 400 },
      )
    }

    // Update user password and clear reset token
    try {
      user.password = password
      user.passwordResetToken = undefined
      user.passwordResetExpires = undefined
      user.passwordChangedAt = Date.now() - 1000 // Set slightly in the past to ensure token is created after password change
      await user.save()
    } catch (saveError) {
      logger.error(`Error saving new password: ${saveError.message}`)
      return NextResponse.json(
        {
          status: "error",
          message: "Terjadi kesalahan saat menyimpan password baru",
          errorCode: "PASSWORD_SAVE_ERROR",
        },
        { status: 500 },
      )
    }

    // Create new tokens
    const jwtToken = signToken(user._id)
    const refreshToken = signRefreshToken(user._id)

    // Save refresh token to database
    try {
      const refreshTokenExpiry = new Date()
      refreshTokenExpiry.setDate(
        refreshTokenExpiry.getDate() + Number.parseInt(process.env.REFRESH_TOKEN_COOKIE_EXPIRES_IN || "7", 10),
      )

      await RefreshToken.create({
        token: refreshToken,
        user: user._id,
        userType: "admin",
        expiresAt: refreshTokenExpiry,
        used: false,
      })
    } catch (tokenError) {
      logger.error(`Error saving refresh token: ${tokenError.message}`)
      // Continue even if there's an error saving the refresh token
    }

    // Set cookie options
    const cookieOptions = {
      expires: new Date(Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 1) * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    }

    // Create response
    const response = NextResponse.json({
      status: "success",
      message: "Password berhasil diubah",
      token: jwtToken,
      refreshToken,
      admin: {
        id: user._id,
        username: user.username,
        role: user.role,
        profileImage: user.profileImage,
      },
    })

    // Set cookies
    response.cookies.set("jwt", jwtToken, cookieOptions)
    response.cookies.set("refreshToken", refreshToken, {
      ...cookieOptions,
      expires: new Date(Date.now() + (process.env.REFRESH_TOKEN_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000),
    })

    logger.info(`Password reset successful for user: ${user.username}`)

    return response
  } catch (err) {
    logger.error(`Error pada reset password: ${err.message}`, { stack: err.stack })
    return NextResponse.json(
      {
        status: "error",
        message: "Terjadi kesalahan pada server. Silakan coba lagi nanti.",
        errorCode: "SERVER_ERROR",
      },
      { status: 500 },
    )
  }
}
