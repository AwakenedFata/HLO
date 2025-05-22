"use client"

import { useEffect, useState } from "react"
import getAdminSSEClient from "@/lib/utils/sse-client"
import { isAuthenticated } from "@/lib/utils/auth-client"
import { useRouter } from "next/navigation"

export default function SSEInitializer() {
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState(null)
  const router = useRouter()

  // Update the useEffect hook to ensure data loads properly on first render
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

          // Dispatch a custom event that the layout can listen for
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("sse-connected", { detail: data }))

            // Trigger an immediate data refresh when SSE connects
            window.dispatchEvent(new CustomEvent("cache-invalidated"))
          }

          // Force refresh UI when SSE connects
          router.refresh()
        }

        const handleError = (data) => {
          console.error("SSE error:", data)
          setError(data.message)

          // Even on error, we should still try to load initial data
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("cache-invalidated"))
          }
        }

        // Add handlers for data events that will trigger UI refreshes
        const handlePinProcessed = (data) => {
          console.log("SSE: Pin processed event received:", data)
          router.refresh() // Force refresh the UI when data changes
        }

        const handleBatchProcessed = (data) => {
          console.log("SSE: Batch processed event received:", data)
          router.refresh() // Force refresh the UI when data changes
        }

        const handlePinUpdated = (data) => {
          console.log("SSE: Pin updated event received:", data)
          router.refresh() // Force refresh the UI when data changes
        }

        const handlePinDeleted = (data) => {
          console.log("SSE: Pin deleted event received:", data)
          router.refresh() // Force refresh the UI when data changes
        }

        // Daftarkan event listeners
        sseClient.on("connected", handleConnected)
        sseClient.on("error", handleError)
        sseClient.on("pin-processed", handlePinProcessed)
        sseClient.on("pins-batch-processed", handleBatchProcessed)
        sseClient.on("pin-updated", handlePinUpdated)
        sseClient.on("pin-deleted", handlePinDeleted)

        // Connect ke SSE server
        await sseClient.connect()

        // Cleanup function
        return () => {
          sseClient.off("connected", handleConnected)
          sseClient.off("error", handleError)
          sseClient.off("pin-processed", handlePinProcessed)
          sseClient.off("pins-batch-processed", handleBatchProcessed)
          sseClient.off("pin-updated", handlePinUpdated)
          sseClient.off("pin-deleted", handlePinDeleted)
          sseClient.disconnect()
        }
      } catch (error) {
        console.error("Gagal menginisialisasi SSE:", error)
        setError(error.message)

        // Even on error, we should still try to load initial data
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cache-invalidated"))
        }
      }
    }

    // Initialize SSE and force a refresh immediately
    initializeSSE()

    // Force an immediate refresh regardless of SSE connection
    router.refresh()

    // Trigger data loading even if SSE fails
    if (typeof window !== "undefined") {
      // Use setTimeout to ensure this happens after component mount
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("cache-invalidated"))
      }, 100)
    }
  }, [initialized, router])

  // Komponen ini tidak merender apa pun
  return null
}
