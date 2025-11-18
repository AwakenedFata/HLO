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

// Fungsi untuk validasi format PIN - harus huruf kapital semua
const validatePinFormat = (pin) => {
  return !/[a-z]/.test(pin)
}
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

    
    // Validasi format PIN - harus huruf kapital semua
    if (!validatePinFormat(pinCode)) {
      logger.info(`Percobaan penggunaan pin gagal: PIN mengandung huruf kecil (${pinCode})`)
      return NextResponse.json({ error: "PIN code harus huruf kapital semua" }, { status: 400 })
    }

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

    // ✅ PERBAIKAN: Simpan data dengan struktur yang benar
    const now = new Date()

    pin.used = true
    pin.redeemedBy = {
      idGame: idGame,
      nama: nama,
      redeemedAt: now,
      deviceInfo: request.headers.get("user-agent") || "Unknown",
      ipAddress: ip,
    }

    await pin.save()

    logger.info(`Penggunaan pin berhasil: ${pinCode} untuk game ${idGame} oleh ${nama}`)

    // Emit event untuk update real-time
    if (global.pinUpdateEmitter) {
      global.pinUpdateEmitter.emit("pin-redeemed", {
        pinId: pin._id,
        code: pin.code,
        redeemedBy: pin.redeemedBy,
        redeemedAt: now,
      })
    }

    return NextResponse.json(
      {
        message: "PIN code berhasil digunakan",
        data: {
          code: pin.code,
          redeemedAt: now,
          redeemedBy: {
            nama: nama,
            idGame: idGame,
          },
        },
      },
      { status: 200 },
    )
  } catch (error) {
    logger.error(`Gagal menggunakan pin: ${error}`)
    return NextResponse.json({ error: "Gagal menggunakan PIN code" }, { status: 500 })
  }
}