"use client"

import { useEffect, useState } from "react"
import getAdminSSEClient from "@/lib/utils/sse-client"
import { isAuthenticated } from "@/lib/utils/auth-client"

export default function SSEInitializer() {
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Hanya inisialisasi SSE jika user terautentikasi
    if (!isAuthenticated()) {
      console.warn("User tidak terautentikasi, SSE tidak diinisialisasi")
      return
    }

    if (initialized) {
      return
    }

    // Inisialisasi SSE
    const initializeSSE = async () => {
      try {
        const sseClient = getAdminSSEClient()

        // Tambahkan event listener untuk mendeteksi koneksi
        const handleConnected = (data) => {
          console.log("SSE berhasil terhubung:", data)
          setInitialized(true)
          setError(null)
        }

        const handleError = (data) => {
          console.error("SSE error:", data)
          setError(data.message)
        }

        // Daftarkan event listeners
        sseClient.on("connected", handleConnected)
        sseClient.on("error", handleError)

        // Connect ke SSE server
        await sseClient.connect()

        // Cleanup function
        return () => {
          sseClient.off("connected", handleConnected)
          sseClient.off("error", handleError)
          sseClient.disconnect()
        }
      } catch (error) {
        console.error("Gagal menginisialisasi SSE:", error)
        setError(error.message)
      }
    }

    initializeSSE()
  }, [initialized])

  // Komponen ini tidak merender apa pun
  return null
}
