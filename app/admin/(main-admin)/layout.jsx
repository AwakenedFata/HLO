"use client"

import { useEffect } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import SSEInitializer from "@/components/admin/SSEInitializer"
import { useRouter } from "next/navigation"
import { invalidateAllCaches } from "@/lib/utils/cache-utils"
import "@/styles/adminstyles.css"

export default function AdminWrappedLayout({ children }) {
  const router = useRouter()

  useEffect(() => {
    // Check authentication
    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      router.push("/admin/login")
      return
    }

    // Invalidate all caches on first load to ensure fresh data
    invalidateAllCaches()

    // Force an initial refresh when the layout mounts
    // This ensures data is loaded on first visit
    router.refresh()

    // Set up event listeners for cache invalidation
    const handleCacheInvalidated = () => {
      router.refresh()
    }

    const handleDataUpdated = () => {
      router.refresh()
    }

    window.addEventListener("cache-invalidated", handleCacheInvalidated)
    window.addEventListener("pin-data-updated", handleDataUpdated)
    window.addEventListener("sse-pin-processed", handleDataUpdated)
    window.addEventListener("sse-pins-batch-processed", handleDataUpdated)
    window.addEventListener("sse-pin-updated", handleDataUpdated)
    window.addEventListener("sse-pin-deleted", handleDataUpdated)

    return () => {
      window.removeEventListener("cache-invalidated", handleCacheInvalidated)
      window.removeEventListener("pin-data-updated", handleDataUpdated)
      window.removeEventListener("sse-pin-processed", handleDataUpdated)
      window.removeEventListener("sse-pins-batch-processed", handleDataUpdated)
      window.removeEventListener("sse-pin-updated", handleDataUpdated)
      window.removeEventListener("sse-pin-deleted", handleDataUpdated)
    }
  }, [router])

  return (
    <AdminLayout>
      {/* Inisialisasi SSE di level layout */}
      <SSEInitializer />
      {children}
    </AdminLayout>
  )
}
