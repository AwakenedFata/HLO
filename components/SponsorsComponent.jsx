"use client"

import { Container, Row, Col } from "react-bootstrap"
import { partners } from "@/data/index.js"
import { useMobileDetect } from "@/hooks/use-mobile"
import Image from "next/image"

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
    <div
      id="partners" className="sponsors-section d-flex align-items-center position-relative overflow-container"
    >
      <Container>
        {/* Title */}
        <div className="sponsors-title text-center" data-aos="fade-down" data-aos-duration="600" data-aos-offset="20">
          <h1>SPONSOR & PARTNER</h1>
          <div className="title-underline"></div>
        </div>

        {/* Partners Grid */}
        <div className="partners-container">
          <Row className="justify-content-center">
            {/* Top Row - max 3 Partners */}
            <Col xs={12}>
              <Row className="justify-content-center top-row">
                {firstRow.map((partner) => (
                  <Col
                    key={partner.id}
                    lg={4}
                    md={4}
                    sm={6}
                    xs={12}
                    className="partner-col"
                    data-aos="fade-up"
                    data-aos-duration="600"
                    data-aos-offset="20"
                  >
                    <div className="partner-card-wrapper">
                      <div
                        className="partner-card"
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                      >
                        <Image
                          src="/assets/SponsorAndPartner/persegi-panjang.png"
                          alt="Card Background"
                          className="sponsor-card-bg"
                          width={350}
                          height={200}
                          style={{ width: '100%', height: 'auto' }}
                        />
                        <a href={partner.url} target="_blank" rel="noopener noreferrer">
                          <div className="partner-logo-container">
                            <Image
                              src={partner.image || "/placeholder.svg"}
                              alt={partner.name}
                              className={`partner-logo ${getPartnerClass(partner.id)}`}
                              width={200}
                              height={100}
                              style={{ width: 'auto', height: 'auto' }}
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
                <Row className="justify-content-center bottom-row">
                  {secondRow.map((partner) => (
                    <Col
                      key={partner.id}
                      lg={4}
                      md={4}
                      sm={6}
                      xs={12}
                      className="partner-col"
                      data-aos="fade-up"
                      data-aos-duration="600"
                      data-aos-offset="20"
                    >
                      <div className="partner-card-wrapper">
                        <div
                          className="partner-card"
                          onMouseEnter={handleMouseEnter}
                          onMouseLeave={handleMouseLeave}
                          onTouchStart={handleTouchStart}
                          onTouchEnd={handleTouchEnd}
                        >
                          <Image
                            src="/assets/SponsorAndPartner/persegi-panjang.png"
                            alt="Card Background"
                            className="sponsor-card-bg"
                            width={350}
                            height={200}
                            style={{ width: '100%', height: 'auto' }}
                          />
                          <a href={partner.url} target="_blank" rel="noopener noreferrer">
                            <div className="partner-logo-container">
                              <Image
                                src={partner.image || "/placeholder.svg"}
                                alt={partner.name}
                                className={`partner-logo ${getPartnerClass(partner.id)}`}
                                width={200}
                                height={100}
                                style={{ width: 'auto', height: 'auto' }}
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