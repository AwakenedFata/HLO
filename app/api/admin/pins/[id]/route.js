import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { EventEmitter } from "events"

// Create a global event emitter for pin updates
export const pinUpdateEmitter = new EventEmitter()
// Increase max listeners to avoid memory leak warnings
pinUpdateEmitter.setMaxListeners(50)

export async function DELETE(request, { params }) {
  try {
    await connectToDatabase()

    // Autentikasi
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    const pinId = params.id

    // Cari PIN
    const pin = await PinCode.findById(pinId)

    if (!pin) {
      return NextResponse.json({ error: "PIN tidak ditemukan" }, { status: 404 })
    }

    if (pin.used) {
      return NextResponse.json({ error: "PIN sudah digunakan dan tidak bisa dihapus" }, { status: 400 })
    }

    await PinCode.findByIdAndDelete(pinId)

    logger.info(`PIN ${pin.code} dihapus oleh ${authResult.user.username}`)

    // Emit event for pin deletion
    pinUpdateEmitter.emit("pin-deleted", { pinId })

    return NextResponse.json({ message: "PIN berhasil dihapus" })
  } catch (error) {
    logger.error("Gagal menghapus PIN:", error)
    return NextResponse.json({ error: "Terjadi kesalahan saat menghapus PIN" }, { status: 500 })
  }
}

// Add PATCH endpoint to update PIN (mark as processed)
export async function PATCH(request, { params }) {
  try {
    await connectToDatabase()

    // Autentikasi
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    const pinId = params.id
    const data = await request.json()

    // Cari PIN
    const pin = await PinCode.findById(pinId)

    if (!pin) {
      return NextResponse.json({ error: "PIN tidak ditemukan" }, { status: 404 })
    }

    // Update PIN
    const updatedPin = await PinCode.findByIdAndUpdate(pinId, { processed: data.processed }, { new: true })

    logger.info(`PIN ${pin.code} ditandai sebagai diproses oleh ${authResult.user.username}`)

    // Emit event for pin update
    pinUpdateEmitter.emit("pin-processed", {
      pinId,
      code: pin.code,
      processed: data.processed,
    })

    return NextResponse.json({
      message: "PIN berhasil diupdate",
      pin: updatedPin,
    })
  } catch (error) {
    logger.error("Gagal mengupdate PIN:", error)
    return NextResponse.json({ error: "Terjadi kesalahan saat mengupdate PIN" }, { status: 500 })
  }
}
