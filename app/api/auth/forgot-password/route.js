import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import sendEmail from "@/lib/utils/email"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { validateRequest } from "@/lib/utils/validation"
import { forgotPasswordSchema } from "@/lib/utils/validation"

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
    const limitResult = await limiter.check(ip)

    if (!limitResult.success) {
      return NextResponse.json(
        { status: "error", message: "Terlalu banyak permintaan reset password, silakan coba lagi setelah satu jam" },
        { status: 429 },
      )
    }

    await connectToDatabase()

    const body = await request.json()

    const validation = await validateRequest(forgotPasswordSchema, body)
    if (!validation.success) {
      logger.warn(`Invalid request: ${JSON.stringify(validation.error)}`)
      return NextResponse.json(validation.error, { status: 400 })
    }

    const {email} = validation.data

    // Find user by username or email
    const user = await Admin.findOne({
      $or: [{ username }, { email }],
    })

    if (!user) {
      return NextResponse.json(
        { status: "error", message: "Tidak ada pengguna dengan username atau email ini" },
        { status: 404 },
      )
    }

    // Generate random reset token
    const resetToken = user.createPasswordResetToken()
    await user.save({ validateBeforeSave: false })

    // Create reset URL
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`

    const message = `Lupa password Anda? Klik link berikut untuk reset password Anda: ${resetURL}\nJika Anda tidak lupa password, abaikan email ini!`
    const html = `
      <p>Lupa password Anda?</p>
      <p>Klik <a href="${resetURL}">link ini</a> untuk reset password Anda.</p>
      <p>Link ini akan kedaluwarsa dalam 10 menit.</p>
      <p>Jika Anda tidak lupa password, abaikan email ini!</p>
    `

    try {
      await sendEmail({
        email: user.email,
        subject: "Reset Password (berlaku selama 10 menit)",
        message,
        html,
      })

      return NextResponse.json({
        status: "success",
        message: "Token telah dikirim ke email",
      })
    } catch (err) {
      user.passwordResetToken = undefined
      user.passwordResetExpires = undefined
      await user.save({ validateBeforeSave: false })

      logger.error(`Gagal mengirim email reset password: ${err.message}`)
      return NextResponse.json(
        { status: "error", message: "Ada kesalahan saat mengirim email. Coba lagi nanti!" },
        { status: 500 },
      )
    }
  } catch (err) {
    logger.error(`Error pada forgot password: ${err.message}`)
    return NextResponse.json({ status: "error", message: err.message }, { status: 400 })
  }
}
