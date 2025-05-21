import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { pinUpdateEmitter } from "../pins/[id]/route"

// Endpoint for batch processing multiple pins at once
export async function POST(request) {
  try {
    await connectToDatabase()

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }

    const { pinIds } = await request.json()

    if (!pinIds || !Array.isArray(pinIds) || pinIds.length === 0) {
      return NextResponse.json({ error: "Valid PIN IDs array is required" }, { status: 400 })
    }

    const now = new Date()

    // Batch update all pins in a single operation with processedAt and processedBy
    const result = await PinCode.updateMany(
      { _id: { $in: pinIds }, used: true, processed: false },
      { 
        $set: { 
          processed: true,
          processedAt: now,
          processedBy: authResult.user._id
        } 
      },
    )

    if (result.modifiedCount === 0) {
      return NextResponse.json({
        message: "No pins were processed. They may already be processed or don't exist.",
        processed: 0,
      })
    }

    logger.info(`${result.modifiedCount} PINs ditandai sebagai diproses oleh ${authResult.user.username}`)

    // Emit batch update event with more comprehensive data
    pinUpdateEmitter.emit("pins-batch-processed", {
      count: result.modifiedCount,
      pinIds,
      processedAt: now,
      processedBy: {
        id: authResult.user._id,
        username: authResult.user.username
      }
    })

    // Return response with cache control headers
    return NextResponse.json(
      {
        success: true,
        message: `${result.modifiedCount} PIN berhasil diproses`,
        processed: result.modifiedCount,
        processedAt: now
      },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    )
  } catch (error) {
    logger.error("Error batch processing pins:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}