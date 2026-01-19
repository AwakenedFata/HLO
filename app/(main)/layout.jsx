"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import NavbarComponent from "@/components/NavbarComponent"
import FooterComponent from "@/components/FooterComponent"
import WelcomePopup from "@/components/WelcomePopup"
import SecurityProtection from "@/components/SecurityProtection"

export default function MainLayout({ children }) {
  const pathname = usePathname()
  const [showPopup, setShowPopup] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    if (pathname === "/") {
      const isPageRefresh = !sessionStorage.getItem("navigationOccurred")

      const popupClosed = sessionStorage.getItem("welcomePopupShown")

      if (isPageRefresh || !popupClosed) {
        setShowPopup(true)
      } else {
        setShowPopup(false)
      }

      sessionStorage.setItem("navigationOccurred", "true")
    } else {
      setShowPopup(false)
      sessionStorage.setItem("navigationOccurred", "true")
    }
  }, [pathname, isClient])

  useEffect(() => {
    if (!isClient) return

    const handleBeforeUnload = () => {
      sessionStorage.removeItem("navigationOccurred")
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isClient])

  return (
    <>
      {/* <SecurityProtection /> */}
      <NavbarComponent />
      {isClient && showPopup && pathname === "/" && <WelcomePopup />}
      <main>{children}</main>
      <FooterComponent />
    </>
  )
}