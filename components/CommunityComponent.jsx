"use client"

import { useEffect, useState, useRef } from "react"
import { Container, Row, Col } from "react-bootstrap"
import styled from "styled-components"

// Global Styles with Font Face
const GlobalFonts = styled.div`
  @font-face {
    font-family: "Overpass-Bold";
    src: url("/fonts/Overpass_Bold.ttf") format("truetype");
  }
  @font-face {
    font-family: "Poppins-Light";
    src: url("/fonts/poppinslight.ttf") format("truetype");
  }
  @font-face {
    font-family: "Poppins-Reguler";
    src: url("/fonts/poppinsregular.ttf") format("truetype");
  }
  @font-face {
    font-family: "Poppins-Semibold";
    src: url("/fonts/poppinssemibold.ttf") format("truetype");
  }
  @font-face {
    font-family: "Poppins-Bold";
    src: url("/fonts/poppinsbold.ttf") format("truetype");
  }
  @font-face {
    font-family: "Poppins-MediumItalic";
    src: url("/fonts/Poppins-MediumItalic.ttf") format("truetype");
  }
  @font-face {
    font-family: "HastricoDT-Bold";
    src: url("/fonts/Fontspring-DEMO-hastricodt-bold.otf") format("opentype");
  }
`

// Styled Components
const CardContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
`

const CardImage = styled.img`
  width: 100%;
  height: auto;
  display: block;
  filter: drop-shadow(rgba(0, 0, 0, 0.5) 0px 10px 10px);
`

const TextOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8% 10% 10% 10%;
  box-sizing: border-box;
`

const HeaderSection = styled.div`
  text-align: center;
  margin-bottom: 5%;
`

const AboutUsLabel = styled.h3`
  font-family: "Overpass-Bold", "Arial", sans-serif;
  color: #ffffff;
  margin: 0 0 2% 0;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  @media (min-width: 1024px) {
    font-size: 1.1rem;
  }
  @media (max-width: 1016px) {
    font-size: 0.9rem;
  }
  @media (max-width: 992px) {
    font-size: 1.1rem;
  }
  @media (max-width: 526px) {
    font-size: 1.1rem;
  }
  @media (max-width: 476px) {
    font-size: 1.1rem;
  }
  @media (max-width: 458px) {
    font-size: 0.8rem;
  }
  @media (max-width: 426px) {
    font-size: 0.9rem;
  }
  @media (max-width: 400px) {
    font-size: 0.9rem;
  }
  @media (max-width: 380px) {
    font-size: 0.65rem;
  }
`

const MainTitle = styled.h2`
  font-family: "HastricoDT-Bold", "Arial", sans-serif;
  color: #000000;
  line-height: 1.5;
  @media (min-width: 1200px) {
    font-size: 1.5rem;
    margin-bottom: -8px;
  }
  @media (min-width: 1024px) and (max-width: 1199px) {
    font-size: 1.3rem;
  }
  @media (max-width: 1023px) {
    font-size: 1.8rem;
  }
  @media (max-width: 526px) {
    font-size: 1.6rem;
    line-height: 1.4;
  }
  @media (max-width: 476px) {
    font-size: 1.4rem;
  }
  @media (max-width: 458px) {
    font-size: 1.3rem;
  }
  @media (max-width: 426px) {
    font-size: 1.3rem;
    margin-bottom: -5px;
  }
  @media (max-width: 400px) {
    font-size: 1.3rem;
  }
  @media (max-width: 380px) {
    font-size: 0.85rem;
  }
`

const ContentSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
`

const Paragraph = styled.p`
  font-family: "Poppins-Reguler", "Arial", sans-serif;
  color: #ffffff;
  line-height: 1.3;
  text-align: justify;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  @media (max-width: 1016px) {
    font-size: 13px;
  }
  @media (max-width: 992px) {
    font-size: 17.5px;
  }
  @media (max-width: 526px) {
    font-size: 17px;
    line-height: 1.25;
  }
  @media (max-width: 500px) {
    font-size: 16px;
    line-height: 1.25;
  }
  @media (max-width: 476px) {
    font-size: 15px;
  }
  @media (max-width: 458px) {
    font-size: 14.5px;
  }
  @media (max-width: 426px) {
    font-size: 14px;
  }
  @media (max-width: 414px) {
    font-size: 13px;
  }
  @media (max-width: 400px) {
    font-size: 13.2px;
  }
  @media (max-width: 380px) {
    font-size: 11px;
  }

  &:last-child {
    margin-bottom: 0;
  }
`

const FooterSection = styled.div`
  text-align: center;
  margin-top: 25px;

  @media (max-width: 526px) {
    margin-top: 15px;
  }
  @media (max-width: 400px) {
    margin-top: 25px;
  }
`

const Hashtag = styled.h4`
  font-family: "Poppins-MediumItalic", "Arial", sans-serif;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  margin: 0;
  letter-spacing: 0.05em;
  @media (min-width: 1024px) {
    font-size: 1.3rem;
  }
  @media (max-width: 1016px) {
    font-size: 1rem;
  }
  @media (max-width: 992px) {
    font-size: 1.3rem;
  }
  @media (max-width: 526px) {
    font-size: 1.2rem;
  }
  @media (max-width: 500px) {
    font-size: 1.1rem;
  }
  @media (max-width: 475px) {
    font-size: 1rem;
  }
  @media (max-width: 450px) {
    font-size: 0.95rem;
  }
  @media (max-width: 426px) {
    font-size: 1rem;
  }
  @media (max-width: 400px) {
    font-size: 1.05rem;
  }
  @media (max-width: 380px) {
    font-size: 0.75rem;
  }
`

// About Us Card Component
const AboutUsCard = () => {
  return (
    <GlobalFonts>
      <CardContainer>
        <CardImage src="/assets/aboutus/card.avif" alt="About Us Card Background" />
        <TextOverlay>
          <HeaderSection>
            <AboutUsLabel>ABOUT US</AboutUsLabel>
            <MainTitle>
              Community Honor Of Kings
              <br />
              Lampung Official
            </MainTitle>
          </HeaderSection>

          <ContentSection>
            <Paragraph>
              Komunitas Honor of Kings Lampung Official berdiri pada Februari 2024 sebagai komunitas pertama yang hadir
              di Domisili Lampung. Komunitas ini bertujuan menjadi wadah bagi para pemain game, khususnya Honor of
              Kings, agar memiliki teman mabar yang berasal dari daerah yang sama. Harapannya, komunitas ini dapat terus
              berkembang di Lampung, meluas ke luar domisili, hingga dikenal di tingkat nasional maupun internasional
            </Paragraph>

            <Paragraph>
              Tidak hanya sebagai komunitas offline yang fokus di Domisili Lampung, Honor of Kings Lampung Official juga
              hadir sebagai komunitas online terbuka untuk semua pemain dari berbagai daerah, bahkan luar negeri. Dengan
              konsep inklusif ini, komunitas ini menjadi ruang bagi para player untuk terhubung, berinteraksi, serta
              mengikuti berbagai kegiatan baik online maupun offline secara aktif dan menyenangkan
            </Paragraph>
          </ContentSection>

          <FooterSection>
            <Hashtag>#OURALLCOMMUNITY</Hashtag>
          </FooterSection>
        </TextOverlay>
      </CardContainer>
    </GlobalFonts>
  )
}

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
    <div id="aboutus" className="aboutus-section w-100 min-vh-100 d-flex align-items-center">
      <Container>
        <Row className="align-items-center">
          {/* Kiri - About Us Card */}
          <Col lg={5} className="about-card-col">
            <AboutUsCard />
          </Col>

          {/* Kanan - Logo, Foto Member, dan Stats */}
          <Col lg={7} className="right-content-col">
            {/* Logo di atas */}
            <div className="logo-container">
              <img src="/assets/aboutus/logobaru.avif" alt="Community Logo" className="community-logo" />
            </div>

            {/* Foto Member */}
            <div className="community-image-container">
              <img src="/assets/aboutus/fotbar.avif" alt="Community Members" className="community-image img-fluid" />
            </div>

            {/* Stat Cards */}
            <Row className="stat-cards-row">
              {/* StatCard 1 + Count */}
              <Col xs="auto" className="stat-card-col" >
                <div
                  className="stat-card-container hover-zoom"
                  ref={memberCardRef}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <img src="/assets/aboutus/kiri 2.avif" alt="Stat 1" className="statcard1 img-fluid" />
                  {startCountMember && (
                    <div className="count-wrappermember">
                      <div className="count-text">{memberCount}</div>
                    </div>
                  )}
                </div>
              </Col>

              {/* StatCard 2 + Count */}
              <Col xs="auto" className="stat-card-col" >
                <div
                  className="stat-card-container hover-zoom"
                  ref={teamCardRef}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <img src="/assets/aboutus/tengah 2.avif" alt="Stat 2" className="statcard2 img-fluid" />
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
                  <img src="/assets/aboutus/info kanan.avif" alt="Stat 3" className="statcard3 img-fluid" />
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
