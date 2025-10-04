"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import NavbarComponent from "@/components/NavbarComponent"
import FooterComponent from "@/components/FooterComponent"
import WelcomePopup from "@/components/WelcomePopup"

export default function MainLayout({ children }) {
  const pathname = usePathname()
  const [showPopup, setShowPopup] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    // Hanya tampilkan popup di homepage
    if (pathname === "/") {
      // Cek apakah ini adalah page refresh
      const isPageRefresh = !sessionStorage.getItem("navigationOccurred")

      // Cek apakah popup sudah pernah ditutup dalam sesi ini
      const popupClosed = sessionStorage.getItem("welcomePopupShown")

      console.log("Debug popup logic:", {
        isPageRefresh,
        popupClosed,
        pathname,
      })

      // Tampilkan popup jika:
      // 1. Ini adalah page refresh (tidak ada navigationOccurred), ATAU
      // 2. Popup belum pernah ditutup dalam sesi ini
      if (isPageRefresh || !popupClosed) {
        setShowPopup(true)
      } else {
        setShowPopup(false)
      }

      // Tandai bahwa navigasi telah terjadi (bukan refresh)
      sessionStorage.setItem("navigationOccurred", "true")
    } else {
      // Jika bukan homepage, pastikan popup tidak ditampilkan
      setShowPopup(false)
      // Tandai bahwa navigasi telah terjadi
      sessionStorage.setItem("navigationOccurred", "true")
    }
  }, [pathname, isClient])

  // Reset navigation flag saat page di-refresh
  useEffect(() => {
    if (!isClient) return

    const handleBeforeUnload = () => {
      // Hapus flag navigasi saat page akan di-refresh
      // Tapi JANGAN hapus welcomePopupShown karena itu untuk tracking dalam sesi
      sessionStorage.removeItem("navigationOccurred")
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isClient])

  return (
    <>
      <NavbarComponent />
      {isClient && showPopup && pathname === "/" && <WelcomePopup />}
      <main>{children}</main>
      <FooterComponent />
    </>
  )
}