import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import logger from "@/lib/utils/logger-server"
import { validateRequest, pinRedemptionSchema } from "@/lib/utils/validation"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for PIN redemption (5 attempts per hour)
const limiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 500, // Max 500 users per interval
  limit: 5,
})

export async function POST(request) {
  try {
    // Apply rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown"
    const limitResult = await limiter.check(ip)

    if (!limitResult.success) {
      return NextResponse.json(
        {
          error: "Terlalu banyak percobaan penggunaan pin dari IP ini, silakan coba lagi setelah satu jam",
        },
        { status: 429 },
      )
    }

    await connectToDatabase()

    const body = await request.json()

    // Validate request
    const validation = await validateRequest(pinRedemptionSchema, body)
    if (!validation.success) {
      logger.warn(`Invalid PIN redemption request: ${JSON.stringify(validation.error)}`)
      return NextResponse.json(validation.error, { status: 400 })
    }

    // Sanitasi input untuk mencegah NoSQL injection
    const { pinCode, idGame, nama } = validation.data

    // Cari pin di database
    const pin = await PinCode.findOne({ code: pinCode })

    if (!pin) {
      logger.info(`Percobaan penggunaan pin gagal: Pin tidak ditemukan (${pinCode})`)
      return NextResponse.json({ error: "PIN code tidak ditemukan" }, { status: 404 })
    }

    // Periksa apakah pin masih valid
    if (pin.used) {
      logger.info(`Percobaan penggunaan pin gagal: Pin sudah digunakan (${pinCode})`)
      return NextResponse.json({ error: "PIN code sudah digunakan" }, { status: 409 })
    }

    // Catat penggunaan pin
    pin.used = true
    pin.idGame = idGame
    pin.namaPengguna = nama
    pin.tanggalPenggunaan = new Date()

    await pin.save()

    logger.info(`Penggunaan pin berhasil: ${pinCode} untuk game ${idGame} oleh ${nama}`)
    return NextResponse.json({ message: "PIN code berhasil digunakan" }, { status: 200 })
  } catch (error) {
    logger.error(`Gagal menggunakan pin: ${error}`)
    return NextResponse.json({ error: "Gagal menggunakan PIN code" }, { status: 500 })
  }
}
