import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import sendEmail from "@/lib/utils/email"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { validateRequest } from "@/lib/utils/validation"
import { forgotPasswordSchema } from "@/lib/schemas/auth-schemas"
// Rate limiter for password reset (3 attempts per hour)
const limiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 500, // Max 500 users per interval
  limit: 3,
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
          message: `Terlalu banyak permintaan reset password, silakan coba lagi dalam ${Math.ceil(retryAfter / 60)} menit`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(3),
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

    const validation = await validateRequest(forgotPasswordSchema, body)
    if (!validation.success) {
      logger.warn(`Invalid request: ${JSON.stringify(validation.error)}`)
      return NextResponse.json(validation.error, { status: 400 })
    }

    // Gunakan email dari skema validasi yang sudah ada
    const { email } = validation.data

    // Find user by email
    let user
    try {
      user = await Admin.findOne({ email })
    } catch (dbError) {
      logger.error(`Error querying database: ${dbError.message}`)
      return NextResponse.json(
        {
          status: "error",
          message: "Terjadi kesalahan saat mencari pengguna",
          errorCode: "DB_QUERY_ERROR",
        },
        { status: 500 },
      )
    }

    if (!user) {
      // PERBAIKAN: Tambahkan delay untuk mencegah timing attacks
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000))

      return NextResponse.json({ status: "error", message: "Tidak ada pengguna dengan email ini" }, { status: 404 })
    }

    // Generate random reset token
    let resetToken
    try {
      resetToken = user.createPasswordResetToken()
      await user.save({ validateBeforeSave: false })
    } catch (tokenError) {
      logger.error(`Error generating reset token: ${tokenError.message}`)
      return NextResponse.json(
        {
          status: "error",
          message: "Terjadi kesalahan saat membuat token reset",
          errorCode: "TOKEN_GENERATION_ERROR",
        },
        { status: 500 },
      )
    }

    // Create reset URL
    const resetURL = `${process.env.FRONTEND_URL}/admin/reset-password/${resetToken}`

    const message = `Lupa password Anda? Klik link berikut untuk reset password Anda: ${resetURL}\nJika Anda tidak lupa password, abaikan email ini!`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Reset Password</h2>
        <p>Halo ${user.username || "Admin"},</p>
        <p>Kami menerima permintaan untuk reset password akun admin Anda.</p>
        <p>Klik tombol di bawah ini untuk reset password Anda:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetURL}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
        </div>
        <p>Atau copy dan paste link berikut ke browser Anda:</p>
        <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">${resetURL}</p>
        <p><strong>Perhatian:</strong> Link ini akan kedaluwarsa dalam 10 menit.</p>
        <p>Jika Anda tidak meminta reset password, abaikan email ini dan password Anda akan tetap sama.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="color: #777; font-size: 12px; text-align: center;">Email ini dikirim secara otomatis, mohon jangan membalas email ini.</p>
      </div>
    `

    try {
      await sendEmail({
        email: user.email,
        subject: "Reset Password Admin (berlaku selama 10 menit)",
        message,
        html,
      })

      logger.info(`Reset password email sent to: ${user.email}`)

      return NextResponse.json({
        status: "success",
        message: "Token telah dikirim ke email",
      })
    } catch (err) {
      // PERBAIKAN: Tambahkan try-catch untuk reset token jika email gagal
      try {
        user.passwordResetToken = undefined
        user.passwordResetExpires = undefined
        await user.save({ validateBeforeSave: false })
      } catch (saveError) {
        logger.error(`Error resetting token after email failure: ${saveError.message}`)
      }

      logger.error(`Gagal mengirim email reset password: ${err.message}`)
      return NextResponse.json(
        {
          status: "error",
          message: "Ada kesalahan saat mengirim email. Coba lagi nanti!",
          errorCode: "EMAIL_SEND_ERROR",
        },
        { status: 500 },
      )
    }
  } catch (err) {
    logger.error(`Error pada forgot password: ${err.message}`, { stack: err.stack })
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
