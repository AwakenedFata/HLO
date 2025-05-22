import { NextResponse } from "next/server"
import { pinUpdateEmitter } from "@/app/api/admin/pins/[id]/route"
import logger from "@/lib/utils/logger-server"
import { authenticateRequest } from "@/lib/utils/auth-server"

// Simpan semua koneksi klien aktif
const clients = new Map()

// Fungsi untuk mengirim event ke klien tertentu
function sendEventToClient(clientId, event, data) {
  const client = clients.get(clientId)
  if (!client) return false

  try {
    client.write(`event: ${event}\n`)
    client.write(`data: ${JSON.stringify(data)}\n\n`)
    return true
  } catch (error) {
    logger.error(`Error sending event to client ${clientId}:`, error)
    return false
  }
}

// Fungsi untuk mengirim event ke semua klien
function broadcastEvent(event, data) {
  let activeClients = 0
  let failedClients = 0

  for (const [clientId, client] of clients.entries()) {
    try {
      client.write(`event: ${event}\n`)
      client.write(`data: ${JSON.stringify(data)}\n\n`)
      activeClients++
    } catch (error) {
      logger.error(`Error broadcasting to client ${clientId}:`, error)
      failedClients++
      clients.delete(clientId)
    }
  }

  logger.info(`Broadcast ${event}: ${activeClients} active clients, ${failedClients} failed`)
}

// Setup event listeners untuk pin updates
function setupPinEventListeners() {
  // Handler untuk event pin-processed
  const pinProcessedHandler = (data) => {
    broadcastEvent("pin-processed", data)
  }

  // Handler untuk event pins-batch-processed
  const batchProcessedHandler = (data) => {
    broadcastEvent("pins-batch-processed", data)
  }

  // Handler untuk event pin-updated
  const pinUpdatedHandler = (data) => {
    broadcastEvent("pin-updated", data)
  }

  // Handler untuk event pin-deleted
  const pinDeletedHandler = (data) => {
    broadcastEvent("pin-deleted", data)
  }

  // Daftarkan event listeners
  pinUpdateEmitter.on("pin-processed", pinProcessedHandler)
  pinUpdateEmitter.on("pins-batch-processed", batchProcessedHandler)
  pinUpdateEmitter.on("pin-updated", pinUpdatedHandler)
  pinUpdateEmitter.on("pin-deleted", pinDeletedHandler)

  // Return cleanup function
  return () => {
    pinUpdateEmitter.off("pin-processed", pinProcessedHandler)
    pinUpdateEmitter.off("pins-batch-processed", batchProcessedHandler)
    pinUpdateEmitter.off("pin-updated", pinUpdatedHandler)
    pinUpdateEmitter.off("pin-deleted", pinDeletedHandler)
  }
}

// Setup event listeners sekali saja
const cleanupEventListeners = setupPinEventListeners()

export async function GET(req) {
  try {
    // Autentikasi request
    const authResult = await authenticateRequest(req)
    if (authResult.error) {
      return NextResponse.json({ error: "Unauthorized", message: authResult.message }, { status: 401 })
    }

    // Verifikasi role admin
    if (!["admin", "super-admin"].includes(authResult.user.role)) {
      return NextResponse.json({ error: "Forbidden", message: "Admin role required" }, { status: 403 })
    }

    // Buat response stream
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    const encoder = new TextEncoder()

    // Generate unique client ID
    const clientId = `${authResult.user._id}-${Date.now()}`

    // Simpan writer untuk client ini
    clients.set(clientId, {
      write: async (data) => {
        await writer.write(encoder.encode(data))
      },
      user: authResult.user,
    })

    logger.info(`SSE: Client connected: ${authResult.user.username} (${clientId})`)

    // Kirim event koneksi berhasil IMMEDIATELY
    await writer.write(
      encoder.encode(
        `event: connected\ndata: ${JSON.stringify({
          message: "SSE connected",
          user: {
            id: authResult.user._id,
            username: authResult.user.username,
            role: authResult.user.role,
          },
          clientId,
          timestamp: Date.now(),
        })}\n\n`,
      ),
    )

    // Send an immediate heartbeat to confirm connection
    await writer.write(encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`))

    // Kirim heartbeat setiap 30 detik untuk menjaga koneksi tetap hidup
    const heartbeatInterval = setInterval(async () => {
      try {
        await writer.write(encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`))
      } catch (error) {
        logger.error(`Heartbeat failed for client ${clientId}:`, error)
        clearInterval(heartbeatInterval)
        clients.delete(clientId)
      }
    }, 30000)

    // Setup cleanup ketika koneksi ditutup
    req.signal.addEventListener("abort", () => {
      clearInterval(heartbeatInterval)
      clients.delete(clientId)
      logger.info(`SSE: Client disconnected: ${authResult.user.username} (${clientId})`)
    })

    // Return response stream
    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Untuk Nginx
      },
    })
  } catch (error) {
    logger.error("Error in SSE handler:", error)
    return NextResponse.json({ error: "Internal Server Error", message: error.message }, { status: 500 })
  }
}

// Cleanup event listeners ketika server restart
process.on("beforeExit", () => {
  if (cleanupEventListeners) {
    cleanupEventListeners()
  }
})
