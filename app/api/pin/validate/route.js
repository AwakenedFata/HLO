import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for PIN validation (10 attempts per hour)
const limiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 500, // Max 500 users per interval
  limit: 10,
})

export async function POST(request) {
  try {
    // Apply rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown"
    const limitResult = await limiter.check(ip)

    if (!limitResult.success) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan validasi pin dari IP ini, silakan coba lagi setelah satu jam" },
        { status: 429 },
      )
    }

    await connectToDatabase()

    const body = await request.json()
    const { pinCode } = body

    if (!pinCode) {
      return NextResponse.json({ error: "Kode pin harus diisi" }, { status: 400 })
    }

    // Cari pin di database
    const pin = await PinCode.findOne({ code: pinCode })

    if (!pin) {
      logger.info(`Percobaan validasi pin gagal: Pin tidak ditemukan (${pinCode})`)
      return NextResponse.json({ error: "PIN code tidak ditemukan" }, { status: 404 })
    }

    // Periksa apakah pin masih valid
    if (pin.used) {
      logger.info(`Percobaan validasi pin gagal: Pin sudah digunakan (${pinCode})`)
      return NextResponse.json({ error: "PIN code sudah digunakan" }, { status: 400 })
    }

    // Pin valid
    logger.info(`Pin berhasil divalidasi: ${pinCode}`)
    return NextResponse.json({
      status: "success",
      message: "PIN code valid",
      data: {
        pin: {
          id: pin._id,
          code: pin.code,
          isValid: pin.isValid,
        },
      },
    })
  } catch (err) {
    logger.error(`Error validating pin: ${err.message}`)
    return NextResponse.json({ error: "Terjadi kesalahan saat memvalidasi pin" }, { status: 500 })
  }
}
