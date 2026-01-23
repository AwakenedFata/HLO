"use client"

import { useEffect, useState, useRef } from "react"
import { Container, Row, Col } from "react-bootstrap"
import AboutUsCardComponent from "@/components/cards/AboutUsCard"
import Image from "next/image"

// Main Community Component
function CommunityComponent() {
  const [isClient, setIsClient] = useState(false)
  const [memberCount, setMemberCount] = useState(0)
  const [teamCount, setTeamCount] = useState(0)
  const [startCountMember, setStartCountMember] = useState(false)
  const [startCountTeam, setStartCountTeam] = useState(false)
  const memberCardRef = useRef(null)
  const teamCardRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const isInViewport = (element) => {
    if (!element || !isClient) return false
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }

  useEffect(() => {
    if (!isClient) return

    const handleScroll = () => {
      if (memberCardRef.current && isInViewport(memberCardRef.current) && !startCountMember) {
        setStartCountMember(true)
      }
      if (teamCardRef.current && isInViewport(teamCardRef.current) && !startCountTeam) {
        setStartCountTeam(true)
      }
    }

    window.addEventListener("scroll", handleScroll)
    handleScroll()

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [startCountMember, startCountTeam, isClient])

  useEffect(() => {
    if (!isClient) return

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isClient])

  useEffect(() => {
    let interval
    if (startCountMember && memberCount < 250) {
      interval = setInterval(() => {
        setMemberCount((prevCount) => {
          const increment = Math.max(1, Math.floor((250 - prevCount) / 10))
          const newCount = prevCount + increment
          return newCount >= 250 ? 250 : newCount
        })
      }, 30)
    }
    return () => clearInterval(interval)
  }, [startCountMember, memberCount])

  useEffect(() => {
    let interval
    if (startCountTeam && teamCount < 20) {
      interval = setInterval(() => {
        setTeamCount((prevCount) => {
          const increment = Math.max(1, Math.floor((20 - prevCount) / 10))
          const newCount = prevCount + increment
          return newCount >= 20 ? 20 : newCount
        })
      }, 50)
    }
    return () => clearInterval(interval)
  }, [startCountTeam, teamCount])

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
                  ref={memberCardRef}
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
                  {startCountMember && (
                    <div className="count-wrappermember">
                      <div className="count-text">{memberCount}</div>
                    </div>
                  )}
                </div>
              </Col>

              {/* StatCard 2 + Count */}
              <Col xs="auto" className="stat-card-col">
                <div
                  className="stat-card-container hover-zoom"
                  ref={teamCardRef}
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
                  {startCountTeam && (
                    <div className="count-wrapperteam">
                      <div className="count-text">{teamCount}</div>
                    </div>
                  )}
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