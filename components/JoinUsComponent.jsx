"use client"

import { Container, Row, Col } from "react-bootstrap"
import { useMobileDetect } from "@/hooks/use-mobile"

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
    <div className="joinus-section w-100 min-vh-100 d-flex align-items-center">
      <Container>
        <Row className="align-items-center">
          {/* Left Column - Logo, Text, QR */}
          <Col lg={6} className="left-content" data-aos="fade-right" data-aos-duration="1000">
            <div className="logo-container mb-4">
              <img src="/assets/Join & Follow/logo.png" alt="HOK Logo" className="hok-logo" />
            </div>

            <div className="joinus-text">
              <h1 className="main-title">Join & Follow Us</h1>
              <h2 className="hashtag">#ourallcommunity</h2>
            </div>

            <div className="qr-container">
              <div className="button-container mb-3">
                <img src="/assets/Join & Follow/click.png" alt="Click QR Here" className="click-button" />
              </div>
              <div
                className="qr-code-container"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <a href="https://chat.whatsapp.com/CDyNXvgyxwMG0c7idouoQR" target="_blank" rel="noopener noreferrer">
                  <img src="/assets/Join & Follow/qr code.png" alt="QR Code" className="qr-code" />
                </a>
              </div>
            </div>
          </Col>

          {/* Right Column - Phone Images */}
          <Col lg={6} className="right-content" data-aos="fade-left" data-aos-duration="1000">
            <div className="phone-container float-animation">
              <img src="/assets/Join & Follow/iphone.png" alt="Phone Preview" className="phone-image" />
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default JoinUsComponent
