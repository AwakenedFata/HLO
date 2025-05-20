import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import { validateRequest } from "@/lib/utils/validation"
import { loginSchema } from "@/lib/schemas/auth-schemas"
import { rateLimit } from "@/lib/utils/rate-limit"
import logger from "@/lib/utils/logger-server"

// Rate limiter untuk login (5 attempts per 15 minutes)
const limiter = rateLimit({
  interval: 15 * 60 * 1000, // 15 menit
  limit: 5,
  uniqueTokenPerInterval: 500,
})

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
    // Apply rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Kombinasikan IP dan user-agent untuk rate limiting yang lebih akurat
    // Ini mencegah satu IP menggunakan banyak browser berbeda untuk bypass rate limit
    const tokenKey = `${ip}:${userAgent.substring(0, 50)}`

    const limitResult = await limiter.check(tokenKey)

    if (!limitResult.success) {
      logger.warn(`Rate limit exceeded for login attempt from IP: ${ip}, attempts: ${limitResult.count}`)

      // Hitung waktu reset yang lebih akurat
      const retryAfter = limitResult.reset || 60 // Default 60 detik jika tidak ada info reset

      return NextResponse.json(
        {
          status: "error",
          message: `Terlalu banyak percobaan login. Silakan coba lagi dalam ${retryAfter} detik.`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(limitResult.limit),
            "X-RateLimit-Remaining": String(limitResult.remaining),
            "X-RateLimit-Reset": String(limitResult.reset),
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        },
      )
    }

    await connectToDatabase()

    const body = await request.json()

    // Validate request
    const validation = await validateRequest(loginSchema, body)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { username, password } = body

    // Check if user exists and password is correct
    const user = await Admin.findOne({ username }).select("+password")

    if (!user || !(await user.comparePassword(password))) {
      logger.warn(`Percobaan login gagal untuk username: ${username} dari IP: ${ip}`)

      // Tambahkan delay untuk mencegah timing attacks
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500))

      // Jangan reset rate limit untuk login yang gagal
      return NextResponse.json(
        {
          status: "error",
          message: "Username atau password salah",
        },
        {
          status: 401,
          headers: {
            "X-RateLimit-Limit": String(limitResult.limit),
            "X-RateLimit-Remaining": String(limitResult.remaining),
            "X-RateLimit-Reset": String(limitResult.reset),
          },
        },
      )
    }

    // Login berhasil, reset rate limit untuk IP ini
    limiter.reset(tokenKey)

    // Log successful login
    logger.info(`Login berhasil untuk user: ${username} dari IP: ${ip}`)

    // Create tokens
    const token = signToken(user._id)
    const refreshToken = signRefreshToken(user._id)

    // Cookie options
    const cookieOptions = {
      expires: new Date(Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 1) * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    }

    // Remove password from output
    user.password = undefined

    // Create response with cookies
    const response = NextResponse.json({
      status: "success",
      token,
      admin: {
        id: user._id,
        username: user.username,
        role: user.role,
        profileImage: user.profileImage,
      },
    })

    // Set cookies
    response.cookies.set("jwt", token, cookieOptions)
    response.cookies.set("refreshToken", refreshToken, {
      ...cookieOptions,
      expires: new Date(Date.now() + (process.env.REFRESH_TOKEN_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000),
    })

    return response
  } catch (err) {
    logger.error(`Error pada login: ${err.message}`)
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 })
  }
}
