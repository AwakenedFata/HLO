"use client"

import { useState, useEffect } from "react"
import { Navbar, Nav, Container } from "react-bootstrap"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { navLinks } from "@/data/index"

function NavbarComponent() {
  const [changeColor, setChangeColor] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setHasMounted(true)
  }, [])

  useEffect(() => {
    if (!hasMounted) return

    const isHomePage = pathname === "/"

    const changeBackgroundColor = () => {
      if (isHomePage && window.scrollY <= 10) {
        setChangeColor(false)
      } else {
        setChangeColor(true)
      }
    }

    // Force an initial check
    if (isHomePage) {
      // Set initial state explicitly based on current scroll position
      setChangeColor(window.scrollY > 10)

      window.addEventListener("scroll", changeBackgroundColor)
      return () => window.removeEventListener("scroll", changeBackgroundColor)
    } else {
      // For non-home pages, always set color
      setChangeColor(true)
    }

    setExpanded(false)
  }, [pathname, hasMounted])

  const handleLinkClick = () => {
    setExpanded(false)
  }

  if (!hasMounted) return null // Mencegah render sebelum client siap

  return (
    <Navbar
      expand="lg"
      className={changeColor ? "color-active" : ""}
      expanded={expanded}
      onToggle={() => setExpanded((prev) => !prev)}
    >
      <Container>
        <Link href="/" className="navbar-brand logo-navbar">
          <img
            src="/assets/Home/logo.png"
            alt="Logo Komunitas HOK Lampung"
            width="100"
            height="31.3"
            className="d-inline-block align-top"
          />
        </Link>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="mx-auto">
            {navLinks.map((link) => {
              const isMerchandise = link.path === "/merchan"
              const isActive = pathname === link.path

              return (
                <Link
                  key={link.id}
                  href={link.path}
                  className={isMerchandise ? "nav-link merch-button" : isActive ? "nav-link active" : "nav-link"}
                  onClick={handleLinkClick}
                >
                  {link.text}
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
