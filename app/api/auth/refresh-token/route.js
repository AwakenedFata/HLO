import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { promisify } from "util"
import { connectToDatabase } from "@/lib/db"
import Admin from "@/lib/models/admin"
import RefreshToken from "@/lib/models/refreshToken" // Pastikan model ini ada
import logger from "@/lib/utils/logger-server"
import { validateRequest } from "@/lib/utils/validation"
import { refreshTokenSchema } from "@/lib/schemas/auth-schemas" // Import dari file auth-schemas

// Fungsi untuk membuat token JWT
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  })
}

// Fungsi untuk membuat refresh token
const signRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  })
}

export async function POST(request) {
  try {
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

    // Get refresh token from cookies or request body
    let refreshToken
    const cookieStore = request.cookies
    refreshToken = cookieStore.get("refreshToken")?.value

    // PERBAIKAN: Tambahkan try-catch untuk parsing body
    let body
    try {
      body = await request.json()

      // Validate request menggunakan refreshTokenSchema dari auth-schemas.js
      const validation = await validateRequest(refreshTokenSchema, body)
      if (!validation.success) {
        logger.warn(`Refresh token validation failed: ${JSON.stringify(validation.error)}`)
        return NextResponse.json(validation.error, { status: 400 })
      }

      // Jika tidak ada di cookie, gunakan dari body
      if (!refreshToken && validation.data.refreshToken) {
        refreshToken = validation.data.refreshToken
      }
    } catch (parseError) {
      logger.error(`Error parsing request body: ${parseError.message}`)
      // Jika tidak ada body, tetap lanjutkan dengan refresh token dari cookie
    }

    if (!refreshToken) {
      logger.warn("Refresh token tidak diberikan")
      return NextResponse.json(
        { status: "error", message: "Refresh token tidak diberikan", errorCode: "MISSING_REFRESH_TOKEN" },
        { status: 401 },
      )
    }

    // PERBAIKAN: Cek apakah refresh token ada di database dan belum digunakan
    try {
      const existingToken = await RefreshToken.findOne({ token: refreshToken })

      if (!existingToken) {
        logger.warn(`Refresh token tidak ditemukan di database: ${refreshToken.substring(0, 10)}...`)
        return NextResponse.json(
          { status: "error", message: "Refresh token tidak valid", errorCode: "INVALID_REFRESH_TOKEN" },
          { status: 401 },
        )
      }

      if (existingToken.used) {
        logger.warn(`Refresh token sudah digunakan: ${refreshToken.substring(0, 10)}...`)
        return NextResponse.json(
          { status: "error", message: "Refresh token sudah digunakan", errorCode: "TOKEN_ALREADY_USED" },
          { status: 401 },
        )
      }

      if (existingToken.expiresAt < new Date()) {
        logger.warn(`Refresh token sudah kedaluwarsa: ${refreshToken.substring(0, 10)}...`)
        return NextResponse.json(
          { status: "error", message: "Refresh token sudah kedaluwarsa", errorCode: "TOKEN_EXPIRED" },
          { status: 401 },
        )
      }

      // Tandai token sebagai sudah digunakan
      existingToken.used = true
      await existingToken.save()
    } catch (dbError) {
      logger.error(`Error checking refresh token in database: ${dbError.message}`)
    }

    // Verify refresh token
    let decoded
    try {
      decoded = await promisify(jwt.verify)(refreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET)
    } catch (jwtError) {
      logger.warn(`Invalid refresh token: ${jwtError.message}`)
      return NextResponse.json(
        {
          status: "error",
          message: "Refresh token tidak valid atau kedaluwarsa",
          errorCode: "INVALID_REFRESH_TOKEN",
        },
        { status: 401 },
      )
    }

    // Check if user still exists
    let currentUser
    try {
      currentUser = await Admin.findById(decoded.id)
    } catch (dbError) {
      logger.error(`Error querying database for user: ${dbError.message}`)
      return NextResponse.json(
        {
          status: "error",
          message: "Terjadi kesalahan saat memeriksa pengguna",
          errorCode: "DB_QUERY_ERROR",
        },
        { status: 500 },
      )
    }

    if (!currentUser) {
      logger.warn(`User not found for refresh token: ${refreshToken.substring(0, 10)}...`)
      return NextResponse.json(
        {
          status: "error",
          message: "Pengguna dengan token ini tidak ada lagi",
          errorCode: "USER_NOT_FOUND",
        },
        { status: 401 },
      )
    }

    // Create new access token
    const token = signToken(currentUser._id)

    // Create new refresh token
    const newRefreshToken = signRefreshToken(currentUser._id)

    // PERBAIKAN: Simpan refresh token baru di database
    try {
      const refreshTokenExpiry = new Date()
      refreshTokenExpiry.setDate(
        refreshTokenExpiry.getDate() + Number.parseInt(process.env.REFRESH_TOKEN_COOKIE_EXPIRES_IN || "7", 10),
      )

      await RefreshToken.create({
        token: newRefreshToken,
        user: currentUser._id,
        userType: "admin",
        expiresAt: refreshTokenExpiry,
        used: false,
      })
    } catch (dbError) {
      logger.error(`Error saving new refresh token: ${dbError.message}`)
      // Lanjutkan meskipun ada error, karena token masih bisa digunakan
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
      refreshToken: newRefreshToken,
      // PERBAIKAN: Tambahkan informasi expiry untuk client
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      admin: {
        id: currentUser._id,
        username: currentUser.username,
        role: currentUser.role,
        profileImage: currentUser.profileImage,
      },
    })

    // Set cookie
    try {
      response.cookies.set("jwt", token, cookieOptions)

      // PERBAIKAN: Set refresh token cookie
      response.cookies.set("refreshToken", newRefreshToken, {
        ...cookieOptions,
        expires: new Date(Date.now() + (process.env.REFRESH_TOKEN_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000),
      })
    } catch (cookieError) {
      logger.error(`Error setting cookies: ${cookieError.message}`)
      // Lanjutkan meskipun ada error cookies, karena token sudah dikirim dalam response body
    }

    logger.info(`Token diperbarui untuk user: ${currentUser.username}`)

    return response
  } catch (err) {
    logger.error(`Error pada refresh token: ${err.message}`, { stack: err.stack })
    return NextResponse.json(
      {
        status: "error",
        message: "Refresh token tidak valid atau kedaluwarsa",
        errorCode: "REFRESH_TOKEN_ERROR",
      },
      { status: 401 },
    )
  }
}
