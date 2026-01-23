"use client"

import { useState, useEffect, useRef } from "react"
import { Navbar, Nav, Container } from "react-bootstrap"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { navLinks } from "@/data/index"
import Image from "next/image"

function NavbarComponent() {
  const [changeColor, setChangeColor] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()

  const navbarRef = useRef(null)

  useEffect(() => {
    setHasMounted(true)

    // Check if screen is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    // Initial check
    checkMobile()

    // Add event listener for window resize
    window.addEventListener("resize", checkMobile)

    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    if (!hasMounted) return

    const isHomePage = pathname === "/"

    const changeBackgroundColor = () => {
      // If mobile and expanded, always set color to true
      if (isMobile && expanded) {
        setChangeColor(true)
        return
      }

      if (isHomePage && window.scrollY <= 10) {
        setChangeColor(false)
      } else {
        setChangeColor(true)
      }
    }

    // Force an initial check
    if (isHomePage) {
      // Set initial state explicitly based on current scroll position and expanded state
      setChangeColor(window.scrollY > 10 || (isMobile && expanded))

      window.addEventListener("scroll", changeBackgroundColor)
      return () => window.removeEventListener("scroll", changeBackgroundColor)
    } else {
      // For non-home pages, always set color
      setChangeColor(true)
    }
  }, [pathname, hasMounted, expanded, isMobile])

  // Handle click outside to close navbar on mobile
  useEffect(() => {
    if (!hasMounted) return

    const handleClickOutside = (event) => {
      // Only apply on mobile devices (below 992px)
      if (window.innerWidth >= 992) return
      
      // Check if navbar is expanded and click is outside navbar
      if (expanded && navbarRef.current && !navbarRef.current.contains(event.target)) {
        setExpanded(false)
        
        // Reset color based on current page and scroll position
        if (pathname === "/" && window.scrollY <= 10) {
          setChangeColor(false)
        }
      }
    }

    // Add event listener when navbar is expanded
    if (expanded) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [expanded, pathname, hasMounted])

  const handleLinkClick = () => {
    setExpanded(false)
  }

  const toggleNavbar = () => {
    // When toggling, if we're expanding and on mobile, force color
    if (!expanded && isMobile) {
      setChangeColor(true)
    } else if (!expanded && pathname === "/" && window.scrollY <= 10) {
      // If we're collapsing, on home page, and scroll is at top, remove color
      setChangeColor(false)
    }

    setExpanded(!expanded)
  }

  if (!hasMounted) return null // Mencegah render sebelum client siap

  return (
    <Navbar expand="lg" className={changeColor ? "color-active" : ""} expanded={expanded} onToggle={toggleNavbar} ref={navbarRef}>
      <Container>
        <Link href="/" className="navbar-brand logo-navbar">
          <Image
            src="/assets/Home/logo.avif"
            alt="Logo Komunitas HOK Lampung"
            width={100}
            height={31}
            className="d-inline-block align-top logo-navbar"
            priority
          />
        </Link>
        <Navbar.Toggle aria-controls="basic-navbar-nav" className="custom-toggler">
          <span className="navbar-toggler-icon">
            <span></span>
          </span>
        </Navbar.Toggle>
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="mx-auto">
            {navLinks.map((link) => {
              const isMerchandise = link.path === "/merchan"
              // Check if current path exactly matches link path
              const isActive =
                link.path === "/" ? pathname === "/" : pathname === link.path || pathname.startsWith(`${link.path}/`)

              // Apply different classes based on link type and active state
              let linkClass = "nav-link"
              if (isActive) linkClass += " nav-active"
              if (isMerchandise) linkClass += " merch-button"

              return (
                <Link key={link.id} href={link.path} className={linkClass} onClick={handleLinkClick}>
                  <span className={isMerchandise ? "merch-text" : ""}>{link.text}</span>
                </Link>
              )
            })}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}

export default NavbarComponent