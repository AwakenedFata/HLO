"use client"

import { useEffect, useState, useRef } from "react"
import { Container, Row, Col } from "react-bootstrap"
import AboutUsCardComponent from "@/components/cards/AboutUsCard"
import Image from "next/image"
import { motion, useSpring, useTransform, useInView } from "framer-motion"

// Global state to track if animation has run in this session (browser refresh resets this)
const animationState = {
  hasRunMember: false,
  hasRunTeam: false,
}

const Counter = ({ target, stateKey, className }) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })
  
  // Initialize start value: if already run, start at target (no anim), else 0
  const initialValue = animationState[stateKey] ? target : 0
  
  const spring = useSpring(initialValue, { mass: 0.8, stiffness: 75, damping: 15 })
  const display = useTransform(spring, (current) => Math.round(current))

  useEffect(() => {
    if (isInView && !animationState[stateKey]) {
      spring.set(target)
      animationState[stateKey] = true
    }
  }, [isInView, spring, target, stateKey])

  return <motion.div ref={ref} className={className}>{display}</motion.div>
}

// Main Community Component
function CommunityComponent() {
  const [isClient, setIsClient] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isClient])

  const handleTouchStart = (e) => {
    e.currentTarget.style.transform = "scale(1.05)"
  }

  const handleTouchEnd = (e) => {
    e.currentTarget.style.transform = "scale(1)"
  }

  const handleMouseEnter = (e) => {
    if (!isMobile) e.currentTarget.style.transform = "scale(1.05)"
  }

  const handleMouseLeave = (e) => {
    if (!isMobile) e.currentTarget.style.transform = "scale(1)"
  }

  return (
    <div id="community" className="aboutus-section d-flex align-items-center">
      <Container>
        <Row className="align-items-center">
          {/* Kiri - About Us Card */}
          <Col lg={5} className="about-card-col">
            <AboutUsCardComponent />
          </Col>

          {/* Kanan - Logo, Foto Member, dan Stats */}
          <Col lg={7} className="right-content-col">
            {/* Logo di atas */}
            <div className="logo-container">
              <Image 
                src="/assets/aboutus/logo.avif" 
                alt="Community Logo" 
                className="community-logo"
                fill
                priority
              />
            </div>

            {/* Foto Member */}
            <div className="community-image-container">
              <Image 
                src="/assets/aboutus/fotbar.avif" 
                alt="Community Members" 
                className="community-image img-fluid"
                width={800}
                height={450}
                style={{ width: '100%', height: 'auto' }}
              />
            </div>

            {/* Stat Cards */}
            <Row className="stat-cards-row">
              {/* StatCard 1 + Count */}
              <Col xs="auto" className="stat-card-col">
                <div
                  className="stat-card-container hover-zoom"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <Image 
                    src="/assets/aboutus/kiri.avif" 
                    alt="Stat 1" 
                    className="statcard1 img-fluid"
                    width={150}
                    height={200}
                    style={{ width: '100%', height: 'auto' }}
                  />
                  <div className="count-wrappermember">
                    <Counter target={250} stateKey="hasRunMember" className="count-text" />
                  </div>
                </div>
              </Col>

              {/* StatCard 2 + Count */}
              <Col xs="auto" className="stat-card-col">
                <div
                  className="stat-card-container hover-zoom"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <Image 
                    src="/assets/aboutus/tengah.avif" 
                    alt="Stat 2" 
                    className="statcard2 img-fluid"
                    width={150}
                    height={200}
                    style={{ width: '100%', height: 'auto' }}
                  />
                  <div className="count-wrapperteam">
                    <Counter target={20} stateKey="hasRunTeam" className="count-text" />
                  </div>
                </div>
              </Col>

              {/* StatCard 3 - No counter needed */}
              <Col xs="auto" className="stat-card-col">
                <div
                  className="stat-card-container hover-zoom"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <Image 
                    src="/assets/aboutus/kanan.avif" 
                    alt="Stat 3" 
                    className="statcard3 img-fluid"
                    width={150}
                    height={200}
                    style={{ width: '100%', height: 'auto' }}
                  />
                </div>
              </Col>
            </Row>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default CommunityComponent