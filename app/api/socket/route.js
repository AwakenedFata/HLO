import { NextResponse } from "next/server"
import { Server } from "socket.io"
import { pinUpdateEmitter } from "@/app/api/admin/pins/[id]/route"
import logger from "@/lib/utils/logger-server"
import { authenticateRequest } from "@/lib/utils/auth-server"

export async function GET(req) {
  try {
    // Buat response untuk mendapatkan akses ke server HTTP
    const res = new NextResponse()

    // Jika Socket.io sudah diinisialisasi, tidak perlu melakukan apa-apa
    if (res.socket?.server?.io) {
      logger.info("Socket.io server sudah berjalan")
      return NextResponse.json({ success: true, message: "Socket.io server sudah berjalan" })
    }

    // Inisialisasi Socket.io dengan konfigurasi yang benar
    const io = new Server(res.socket.server, {
      path: "/api/socket",
      addTrailingSlash: false, // Penting untuk Next.js
      cors: {
        origin: "*", // Izinkan semua origin untuk debugging
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"], // Pastikan polling diaktifkan
      pingTimeout: 60000, // Tingkatkan timeout
      pingInterval: 25000, // Tingkatkan interval ping
    })

    // Simpan instance Socket.io di server
    res.socket.server.io = io

    // Namespace untuk admin
    const adminNamespace = io.of("/admin")

    // Middleware autentikasi untuk namespace admin
    adminNamespace.use(async (socket, next) => {
      try {
        // Dapatkan token dari handshake
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1]

        if (!token) {
          logger.warn("Socket.io: No token provided")
          return next(new Error("Authentication error: No token provided"))
        }

        // Buat request object untuk authenticateRequest
        const mockRequest = {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cookies: {},
        }

        // Verifikasi token menggunakan authenticateRequest
        const authResult = await authenticateRequest(mockRequest)

        if (authResult.error) {
          logger.warn(`Socket.io: Authentication error: ${authResult.message}`)
          return next(new Error(`Authentication error: ${authResult.message}`))
        }

        if (!["admin", "super-admin"].includes(authResult.user.role)) {
          logger.warn(`Socket.io: Unauthorized role: ${authResult.user.role}`)
          return next(new Error("Unauthorized: Admin role required"))
        }

        // Simpan data user di socket
        socket.user = authResult.user
        next()
      } catch (error) {
        logger.error("Socket authentication error:", error)
        return next(new Error("Authentication failed"))
      }
    })

    // Handle koneksi ke namespace admin
    adminNamespace.on("connection", (socket) => {
      logger.info(`Admin Socket.io client connected: ${socket.user.username}`)

      // Kirim konfirmasi koneksi
      socket.emit("connected", {
        message: "Socket.io connected",
        user: {
          id: socket.user._id,
          username: socket.user.username,
          role: socket.user.role,
        },
      })

      // Handler untuk event pin-processed
      const pinProcessedHandler = (data) => {
        socket.emit("pin-processed", data)
      }

      // Handler untuk event pins-batch-processed
      const batchProcessedHandler = (data) => {
        socket.emit("pins-batch-processed", data)
      }

      // Handler untuk event pin-updated
      const pinUpdatedHandler = (data) => {
        socket.emit("pin-updated", data)
      }

      // Handler untuk event pin-deleted
      const pinDeletedHandler = (data) => {
        socket.emit("pin-deleted", data)
      }

      // Daftarkan event listeners
      pinUpdateEmitter.on("pin-processed", pinProcessedHandler)
      pinUpdateEmitter.on("pins-batch-processed", batchProcessedHandler)
      pinUpdateEmitter.on("pin-updated", pinUpdatedHandler)
      pinUpdateEmitter.on("pin-deleted", pinDeletedHandler)

      // Handle penutupan koneksi
      socket.on("disconnect", () => {
        logger.info(`Admin Socket.io client disconnected: ${socket.user.username}`)

        // Hapus event listeners
        pinUpdateEmitter.off("pin-processed", pinProcessedHandler)
        pinUpdateEmitter.off("pins-batch-processed", batchProcessedHandler)
        pinUpdateEmitter.off("pin-updated", pinUpdatedHandler)
        pinUpdateEmitter.off("pin-deleted", pinDeletedHandler)
      })
    })

    logger.info("Admin Socket.io server initialized")

    // Penting: Gunakan 200 OK untuk respons
    return NextResponse.json({ success: true, message: "Socket.io server initialized" })
  } catch (error) {
    logger.error("Error initializing Socket.io server:", error)
    return NextResponse.json({ success: false, error: "Failed to initialize Socket.io server" }, { status: 500 })
  }
}
