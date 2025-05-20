"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

export default function ScrollToTop() {
  const pathname = usePathname()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (isClient) {
      window.scrollTo(0, 0)
    }
  }, [pathname, isClient])

  return null
}