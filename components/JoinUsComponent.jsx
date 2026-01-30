"use client"

import { Container, Row, Col } from "react-bootstrap"
import { useMobileDetect } from "@/hooks/use-mobile"
import Image from "next/image"

function JoinUsComponent() {
  const isMobile = useMobileDetect()

  const handleTouchStart = (e) => {
    e.currentTarget.style.transform = "scale(1.05)"
  }

  const handleTouchEnd = (e) => {
    e.currentTarget.style.transform = "scale(1)"
  }

  const handleMouseEnter = (e) => {
    if (!isMobile) e.currentTarget.style.transform = "scale(1.03)"
  }

  const handleMouseLeave = (e) => {
    if (!isMobile) e.currentTarget.style.transform = "scale(1)"
  }

  return (
    <div className="joinus-section d-flex align-items-center">
      <Container>
        <Row className="align-items-center">
          {/* Left Column - Logo, Text, QR */}
          <Col lg={6} className="left-content" data-aos="fade-up" data-aos-duration="400" data-aos-offset="20">
            <div className="logo-container mb-4">
              <Image 
                src="/assets/JoinAndFollow/logo-hok-1.avif" 
                alt="HOK Logo" 
                className="hok-logo" 
                width={300}
                height={100}
                style={{ width: 'auto', height: 'auto' }}
              />
            </div>

            <div className="joinus-text">
              <h1 className="main-title">Join & Follow Us</h1>
              <h2 className="hashtag">#ourallcommunity</h2>
            </div>

            <div className="qr-container">
              <div className="button-container mb-3">
                <Image 
                  src="/assets/JoinAndFollow/click.avif" 
                  alt="Click QR Here" 
                  className="click-button" 
                  width={220}
                  height={50}
                  style={{ width: 'auto', height: 'auto' }}
                />
              </div>
              <div
                className="qr-code-container"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <a href="https://chat.whatsapp.com/CDyNXvgyxwMG0c7idouoQR" target="_blank" rel="noopener noreferrer">
                  <Image 
                    src="/assets/JoinAndFollow/qr-code.avif" 
                    alt="QR Code" 
                    className="qr-code" 
                    width={220}
                    height={220}
                    style={{ width: 'auto', height: 'auto' }}
                  />
                </a>
              </div>
            </div>
          </Col>

          {/* Right Column - Phone Images */}
          <Col lg={6} className="right-content" data-aos="fade-up" data-aos-duration="400" data-aos-offset="20">
            <div className="phone-container float-animation">
              <Image 
                src="/assets/JoinAndFollow/iphone.avif" 
                alt="Phone Preview" 
                className="phone-image" 
                width={500}
                height={600}
                style={{ width: 'auto', height: 'auto' }}
                priority
              />
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default JoinUsComponent