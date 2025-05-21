"use client"

import { useEffect, useState } from "react"
import getAdminSocketClient from "@/lib/utils/socket-client"
import { isAuthenticated } from "@/lib/utils/auth-client"

export default function SocketInitializer() {
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Hanya inisialisasi Socket.io jika user terautentikasi
    if (!isAuthenticated()) {
      console.warn("User tidak terautentikasi, Socket.io tidak diinisialisasi")
      return
    }

    if (initialized) {
      return
    }

    // Inisialisasi Socket.io
    const initializeSocket = async () => {
      try {
        const socketClient = getAdminSocketClient()

        // Tambahkan event listener untuk mendeteksi koneksi
        const handleConnected = (data) => {
          console.log("Socket.io berhasil terhubung:", data)
          setInitialized(true)
          setError(null)
        }

        const handleError = (data) => {
          console.error("Socket.io error:", data)
          setError(data.message)

          // Coba lagi setelah 5 detik jika terjadi error
          setTimeout(() => {
            if (!socketClient.isConnected()) {
              console.log("Mencoba menghubungkan kembali Socket.io...")
              socketClient.reconnect()
            }
          }, 5000)
        }

        // Daftarkan event listeners
        socketClient.on("connected", handleConnected)
        socketClient.on("error", handleError)

        // Connect ke Socket.io server
        await socketClient.connect()

        // Cleanup function
        return () => {
          socketClient.off("connected", handleConnected)
          socketClient.off("error", handleError)
        }
      } catch (error) {
        console.error("Gagal menginisialisasi Socket.io:", error)
        setError(error.message)
      }
    }

    initializeSocket()
  }, [initialized])

  // Komponen ini tidak merender apa pun
  return null
}
