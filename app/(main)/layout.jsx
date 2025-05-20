"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import NavbarComponent from "@/components/NavbarComponent"
import FooterComponent from "@/components/FooterComponent"
import WelcomePopup from "@/components/WelcomePopup"
import "@/styles/main.css"

export default function MainLayout({ children }) {
  const pathname = usePathname()
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => {
    // Logika popup Anda di sini
    if (pathname === "/") {
      const lastPath = sessionStorage.getItem("lastPath")
      if (!lastPath || lastPath === "/") {
        setShowPopup(true)
      }
    }

    sessionStorage.setItem("lastPath", pathname)
  }, [pathname])

  return (
    <>
      <NavbarComponent />
      {showPopup && pathname === "/" && <WelcomePopup />}
      {children}
      <FooterComponent />
    </>
  )
}
