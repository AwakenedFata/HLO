import { NextResponse } from "next/server"
import { WebSocketServer } from "ws"
import { pinUpdateEmitter } from "../pins/[id]/route"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"

// Variable untuk menyimpan instance WebSocketServer
let wss = null

// Inisialisasi WebSocket server jika belum ada
if (!wss && typeof process !== "undefined") {
  wss = new WebSocketServer({ noServer: true })
  
  // Handle koneksi WebSocket
  wss.on("connection", (ws) => {
    logger.info("Admin WebSocket client connected")
    
    // Kirim konfirmasi koneksi awal
    ws.send(JSON.stringify({ 
      type: "connected", 
      message: "WebSocket connected",
      timestamp: new Date().toISOString()
    }))
    
    // Handler untuk event pin-processed
    const pinProcessedHandler = (data) => {
      ws.send(JSON.stringify({ 
        type: "pin-processed", 
        data,
        timestamp: new Date().toISOString()
      }))
    }
    
    // Handler untuk event pins-batch-processed
    const batchProcessedHandler = (data) => {
      ws.send(JSON.stringify({ 
        type: "pins-batch-processed", 
        data,
        timestamp: new Date().toISOString()
      }))
    }
    
    // Handler untuk event pin-updated
    const pinUpdatedHandler = (data) => {
      ws.send(JSON.stringify({ 
        type: "pin-updated", 
        data,
        timestamp: new Date().toISOString()
      }))
    }
    
    // Handler untuk event pin-deleted
    const pinDeletedHandler = (data) => {
      ws.send(JSON.stringify({ 
        type: "pin-deleted", 
        data,
        timestamp: new Date().toISOString()
      }))
    }
    
    // Daftarkan event listeners
    pinUpdateEmitter.on("pin-processed", pinProcessedHandler)
    pinUpdateEmitter.on("pins-batch-processed", batchProcessedHandler)
    pinUpdateEmitter.on("pin-updated", pinUpdatedHandler)
    pinUpdateEmitter.on("pin-deleted", pinDeletedHandler)
    
    // Kirim heartbeat setiap 30 detik untuk menjaga koneksi tetap aktif
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ 
          type: "heartbeat", 
          timestamp: new Date().toISOString()
        }))
      }
    }, 30000)
    
    // Handle pesan dari klien
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message)
        
        // Handle pesan ping dari klien
        if (data.type === "ping") {
          ws.send(JSON.stringify({ 
            type: "pong", 
            timestamp: new Date().toISOString()
          }))
        }
      } catch (error) {
        logger.error("Error parsing WebSocket message:", error)
      }
    })
    
    // Handle penutupan koneksi WebSocket
    ws.on("close", () => {
      logger.info("Admin WebSocket client disconnected")
      
      // Hapus event listeners
      pinUpdateEmitter.off("pin-processed", pinProcessedHandler)
      pinUpdateEmitter.off("pins-batch-processed", batchProcessedHandler)
      pinUpdateEmitter.off("pin-updated", pinUpdatedHandler)
      pinUpdateEmitter.off("pin-deleted", pinDeletedHandler)
      
      // Hapus interval heartbeat
      clearInterval(heartbeatInterval)
    })
    
    // Handle error koneksi WebSocket
    ws.on("error", (error) => {
      logger.error("WebSocket connection error:", error)
    })
  })
  
  // Handle error server WebSocket
  wss.on("error", (error) => {
    logger.error("WebSocket server error:", error)
  })
  
  logger.info("Admin WebSocket server initialized")
}

// Endpoint HTTP untuk upgrade ke WebSocket
export async function GET(request) {
  try {
    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ error: authResult.message }, { status: 401 })
    }
    
    // Endpoint ini hanya untuk upgrade WebSocket, bukan untuk request HTTP biasa
    return new NextResponse("WebSocket endpoint", { 
      status: 426, 
      headers: {
        "Upgrade": "websocket",
        "Connection": "Upgrade"
      }
    })
  } catch (error) {
    logger.error("Error in WebSocket route:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// Export WebSocket server untuk digunakan oleh server.js
export { wss }