"use client"

import { useState, useEffect } from "react"
import { setupInactivityTimer, logout } from "@/lib/utils/authUtils"
import AOS from "aos"

export function Providers({ children }) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    AOS.init()

    setupInactivityTimer(() => {
      logout()
      window.location.href = "/admin/login"
    }, 15)
  }, [isClient])

  return <>{children}</>
}
