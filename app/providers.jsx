"use client"

import { useState, useEffect } from "react"
import { SessionProvider } from "next-auth/react"
import AOS from "aos"

export function Providers({ children }) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return
    AOS.init()
  }, [isClient])

  return <SessionProvider>{children}</SessionProvider>
}
