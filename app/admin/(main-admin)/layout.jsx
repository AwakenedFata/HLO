"use client"

import { useEffect, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import { useRouter } from "next/navigation"
import { invalidateAllCaches } from "@/lib/utils/cache-utils"
import "@/styles/adminstyles.css"

export default function AdminWrappedLayout({ children }) {
  const router = useRouter()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Only run this once
    if (isInitialized) return

    // Check authentication
    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      router.push("/admin/login")
      return
    }

    // Immediately mark as initialized to prevent multiple executions
    setIsInitialized(true)

    // Clear all caches first
    if (typeof window !== "undefined") {
      try {
        // Force clear all localStorage cache items
        for (const key in localStorage) {
          if (key.includes("_cache") || key.includes("last_fetch")) {
            localStorage.removeItem(key)
          }
        }

        // Then invalidate through our utility
        invalidateAllCaches()

        console.log("All caches cleared on initial load")
      } catch (error) {
        console.error("Error clearing caches:", error)
      }
    }

    // Force immediate data refresh
    setTimeout(() => {
      router.refresh()
      console.log("Initial router.refresh() called")

      // Add a second refresh after a short delay to ensure data loads
      setTimeout(() => {
        router.refresh()
        console.log("Follow-up router.refresh() called")
      }, 1000)
    }, 100)

    // Set up event listeners for data updates
    const handleDataUpdate = () => {
      console.log("Data update event received, refreshing UI")
      router.refresh()
    }

    window.addEventListener("cache-invalidated", handleDataUpdate)
    window.addEventListener("pin-data-updated", handleDataUpdate)

    return () => {
      window.removeEventListener("cache-invalidated", handleDataUpdate)
      window.removeEventListener("pin-data-updated", handleDataUpdate)
    }
  }, [router, isInitialized])

  return <AdminLayout>{children}</AdminLayout>
}
