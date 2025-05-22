"use client"

import { useEffect, useState, useRef } from "react"
import getAdminSSEClient from "@/lib/utils/sse-client"
import { useRouter } from "next/navigation"

export default function SSEInitializer() {
  const [initialized, setInitialized] = useState(false)
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const router = useRouter()
  const sseClientRef = useRef(null)

  useEffect(() => {
    console.log("SSEInitializer: Component mounted")

    // Check if user is authenticated
    const token = typeof window !== "undefined" ? sessionStorage.getItem("adminToken") : null
    if (!token) {
      console.warn("SSEInitializer: User not authenticated, SSE not initialized")
      return
    }

    if (initialized && sseClientRef.current?.isConnected()) {
      console.log("SSEInitializer: Already initialized and connected")
      return
    }

    console.log("SSEInitializer: Initializing SSE")

    // Initialize SSE
    const sseClient = getAdminSSEClient()
    sseClientRef.current = sseClient

    // Add event listeners
    const handleConnected = (data) => {
      console.log("SSEInitializer: SSE connected", data)
      setInitialized(true)
      setConnectionAttempts(0)

      // Trigger data refresh
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cache-invalidated"))
      }

      // Force refresh UI
      router.refresh()
    }

    const handleError = (data) => {
      console.error("SSEInitializer: SSE error", data)
      setConnectionAttempts((prev) => prev + 1)

      // Even on error, trigger data refresh
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cache-invalidated"))
      }
    }

    const handleDataEvent = (data) => {
      console.log("SSEInitializer: Data event received", data)

      // Trigger refresh only if we're on a relevant page
      const path = window.location.pathname
      if (path.includes("/admin/pins") || path.includes("/admin/pending-pins") || path.includes("/admin/dashboard")) {
        router.refresh()
      }

      // Trigger cache invalidation event
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cache-invalidated", { detail: data }))
      }
    }

    // Register event listeners
    sseClient.on("connected", handleConnected)
    sseClient.on("error", handleError)
    sseClient.on("pin-processed", handleDataEvent)
    sseClient.on("pins-batch-processed", handleDataEvent)
    sseClient.on("pin-updated", handleDataEvent)
    sseClient.on("pin-deleted", handleDataEvent)

    // Connect to SSE server
    sseClient.connect()

    // Force an immediate refresh
    router.refresh()

    // Trigger data loading
    if (typeof window !== "undefined") {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("cache-invalidated"))
      }, 100)
    }

    // Cleanup function
    return () => {
      console.log("SSEInitializer: Cleaning up")
      sseClient.off("connected", handleConnected)
      sseClient.off("error", handleError)
      sseClient.off("pin-processed", handleDataEvent)
      sseClient.off("pins-batch-processed", handleDataEvent)
      sseClient.off("pin-updated", handleDataEvent)
      sseClient.off("pin-deleted", handleDataEvent)
      sseClient.disconnect()
    }
  }, [initialized, router, connectionAttempts])

  // Reconnect if token changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "adminToken") {
        console.log("SSEInitializer: Token changed, reinitializing")
        setInitialized(false)
        if (sseClientRef.current) {
          sseClientRef.current.disconnect()
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  return null
}
