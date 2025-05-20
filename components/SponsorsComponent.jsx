"use client"

import { Container, Row, Col } from "react-bootstrap"
import { partners } from "@/data/index.js"
import { useMobileDetect } from "@/hooks/use-mobile"

function SponsorsComponent() {
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

  // Pisahkan jadi dua grup
  const firstRow = partners.slice(0, 3)
  const secondRow = partners.slice(3)

  // Fungsi bantu untuk kasih class special berdasarkan id
  const getPartnerClass = (id) => {
    if (id === 1) return "partner-logo-special1"
    if (id === 2) return "partner-logo-special2"
    if (id === 4) return "partner-logo-special4"
    if (id === 5) return "partner-logo-special5"
    return ""
  }

  return (
    <div className="sponsors-section w-100 min-vh-100 d-flex align-items-center position-relative overflow-container">
      <Container>
        {/* Title */}
        <div className="sponsors-title text-center" data-aos="fade-down" data-aos-duration="1000">
          <h1>SPONSOR & PARTNER</h1>
          <div className="title-underline"></div>
        </div>

        {/* Partners Grid */}
        <div className="partners-container">
          <Row className="justify-content-center">
            {/* Top Row - max 3 Partners */}
            <Col xs={12}>
              <Row className="justify-content-center top-row" data-aos="fade-up" data-aos-duration="1000">
                {firstRow.map((partner) => (
                  <Col key={partner.id} lg={4} md={4} sm={6} xs={12} className="partner-col">
                    <div className="partner-card-wrapper">
                      <div
                        className="partner-card"
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                      >
                        <img
                          src="/assets/Sponsor & Partner/persegi panjang.png"
                          alt="Card Background"
                          className="sponsor-card-bg"
                        />
                        <a href={partner.url} target="_blank" rel="noopener noreferrer">
                          <div className="partner-logo-container">
                            <img
                              src={partner.image || "/placeholder.svg"}
                              alt={partner.name}
                              className={`partner-logo ${getPartnerClass(partner.id)}`}
                            />
                          </div>
                        </a>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Col>

            {/* Bottom Row - sisa Partners */}
            {secondRow.length > 0 && (
              <Col xs={12}>
                <Row className="justify-content-center bottom-row" data-aos="fade-up" data-aos-duration="1000">
                  {secondRow.map((partner) => (
                    <Col key={partner.id} lg={4} md={4} sm={6} xs={12} className="partner-col">
                      <div className="partner-card-wrapper">
                        <div
                          className="partner-card"
                          onMouseEnter={handleMouseEnter}
                          onMouseLeave={handleMouseLeave}
                          onTouchStart={handleTouchStart}
                          onTouchEnd={handleTouchEnd}
                        >
                          <img
                            src="/assets/Sponsor & Partner/persegi panjang.png"
                            alt="Card Background"
                            className="sponsor-card-bg"
                          />
                          <a href={partner.url} target="_blank" rel="noopener noreferrer">
                            <div className="partner-logo-container">
                              <img
                                src={partner.image || "/placeholder.svg"}
                                alt={partner.name}
                                className={`partner-logo ${getPartnerClass(partner.id)}`}
                              />
                            </div>
                          </a>
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Col>
            )}
          </Row>
        </div>
      </Container>
    </div>
  )
}

export default SponsorsComponent
