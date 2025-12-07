import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import logger from "@/lib/utils/logger-server"
import { validateRequest, pinRedemptionSchema } from "@/lib/utils/validation"
import { rateLimit } from "@/lib/utils/rate-limit"

const limiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 500, // Max 500 users per interval
  limit: 5,
})

// Validasi format PIN untuk 16 digit
const validatePinFormat = (pin) => {
  // Cek tidak ada huruf kecil
  if (/[a-z]/.test(pin)) {
    return { valid: false, reason: "lowercase" }
  }
  // Cek hanya mengandung huruf kapital, angka, dan tanda hubung
  if (!/^[A-Z0-9-]+$/.test(pin)) {
    return { valid: false, reason: "invalid_chars" }
  }
  // Cek panjang: minimal 16, maksimal 21 (16 + prefix 5)
  if (pin.length < 16 || pin.length > 21) {
    return { valid: false, reason: "invalid_length" }
  }
  return { valid: true }
}

export async function POST(request) {
  try {
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

    const validation = await validateRequest(pinRedemptionSchema, body)
    if (!validation.success) {
      logger.warn(`Invalid PIN redemption request: ${JSON.stringify(validation.error)}`)
      return NextResponse.json(validation.error, { status: 400 })
    }

    const { pinCode, idGame, nama } = validation.data

    // Validasi format PIN dengan detail error
    const formatValidation = validatePinFormat(pinCode)
    if (!formatValidation.valid) {
      let errorMessage = "PIN code tidak valid"
      
      switch (formatValidation.reason) {
        case "lowercase":
          errorMessage = "PIN code harus huruf kapital semua"
          logger.info(`Percobaan penggunaan pin gagal: PIN mengandung huruf kecil (${pinCode})`)
          break
        case "invalid_chars":
          errorMessage = "PIN code hanya boleh berisi huruf kapital, angka, dan tanda (-)"
          logger.info(`Percobaan penggunaan pin gagal: PIN mengandung karakter tidak valid (${pinCode})`)
          break
        case "invalid_length":
          errorMessage = "PIN code harus 16-21 karakter"
          logger.info(`Percobaan penggunaan pin gagal: PIN panjang tidak sesuai (${pinCode.length} karakter)`)
          break
      }
      
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    // Cari pin di database
    const pin = await PinCode.findOne({ code: pinCode })

    if (!pin) {
      logger.info(`Percobaan penggunaan pin gagal: Pin tidak ditemukan (${pinCode})`)
      return NextResponse.json({ error: "PIN code tidak ditemukan" }, { status: 404 })
    }

    if (pin.used) {
      logger.info(`Percobaan penggunaan pin gagal: Pin sudah digunakan (${pinCode})`)
      return NextResponse.json({ error: "PIN code sudah digunakan" }, { status: 409 })
    }

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

    logger.info(`Penggunaan pin berhasil: ${pinCode} (16 digit) untuk game ${idGame} oleh ${nama}`)

    // Emit event untuk update real-time
    if (global.pinUpdateEmitter) {
      global.pinUpdateEmitter.emit("pin-redeemed", {
        pinId: pin._id,
        code: pin.code,
        redeemedBy: pin.redeemedBy,
        redeemedAt: now,
      })
    }

    // Broadcast event untuk komponen lain
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pin-redeemed"))
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