import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { pinUpdateEmitter } from "../pins/[id]/route"

// Endpoint for processing pins with optimized performance
export async function POST(request) {
  try {
    await connectToDatabase()

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    const { pinId } = await request.json()

    if (!pinId) {
      return NextResponse.json({ error: "PIN ID is required" }, { status: 400 })
    }

    // Find and update the pin in a single operation
    const updatedPin = await PinCode.findByIdAndUpdate(pinId, { processed: true }, { new: true })

    if (!updatedPin) {
      return NextResponse.json({ error: "PIN tidak ditemukan" }, { status: 404 })
    }

    logger.info(`PIN ${updatedPin.code} ditandai sebagai diproses oleh ${authResult.user.username}`)

    // Emit event for pin update
    pinUpdateEmitter.emit("pin-processed", {
      pinId,
      code: updatedPin.code,
      processed: true,
    })

    // Return minimal data to reduce response size
    return NextResponse.json({
      success: true,
      message: "PIN berhasil diproses",
      code: updatedPin.code,
    })
  } catch (error) {
    logger.error("Error processing pin:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
