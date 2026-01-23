"use client";

import { useEffect, useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import styled from "styled-components";
import { platforms } from "@/data/index.js";
import Image from "next/image";

const PageWrapper = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${(props) => (props.$isMobile ? "30px 15px 80px" : "50px 0 100px")};

  /* Tablet/Medium screens (576px - 1024px) - no white space */
  @media (max-width: 1024px) and (min-width: 576px) {
    min-height: 100vh;
    padding: 50px 20px 100px;
    justify-content: center;
  }

  /* Background image handled by Next.js Image component */
  `;
  
  const Title = styled.h1`
  font-family: "Nasalization", sans-serif;
  font-size: ${(props) => (props.$isMobile ? "3rem" : "5rem")};
  margin-bottom: ${(props) => (props.$isMobile ? "50px" : "40px")};
  text-align: center;
  text-transform: uppercase;
  text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.5),
  -1px -1px 2px rgba(255, 255, 255, 0.1), 0 2px 4px rgba(0, 0, 0, 0.2);
  color: #f5ab1d;
  position: relative;
  z-index: 1;

  @media (max-width: 1024px) and (min-width: 576px) {
    font-size: 4rem;
    margin-bottom: 50px;
  }

  @media (max-width: 575px) {
    padding-top: 20px;
  }
  `;

const PlatformsPage = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const handleResize = () => {
      // Mobile is below 576px only
      setIsMobile(window.innerWidth < 576);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isClient]);

  const handleTouchStart = (e) => {
    e.currentTarget.style.transform = "scale(1.05)";
  };

  const handleTouchEnd = (e) => {
    e.currentTarget.style.transform = "scale(1)";
  };

  const handleMouseEnter = (e) => {
    if (!isMobile) e.currentTarget.style.transform = "scale(1.05)";
  };

  const handleMouseLeave = (e) => {
    if (!isMobile) e.currentTarget.style.transform = "scale(1)";
  };

  const PlatformCard = ({ image, url }) => {
    // Determine card size based on screen width
    const getCardSize = () => {
      if (typeof window === "undefined") return 150;
      const width = window.innerWidth;
      if (width < 576) return 120; // Mobile
      if (width >= 576 && width <= 1024) return Math.min(Math.max(width * 0.15, 100), 160); // Tablet - scaled
      return Math.min(Math.max(width * 0.1, 120), 150); // Desktop
    };

    const [cardSize, setCardSize] = useState(150);

    useEffect(() => {
      const updateSize = () => setCardSize(getCardSize());
      updateSize();
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }, []);

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="platform-card"
        style={{
          position: "relative",
          width: `${cardSize}px`,
          height: `${cardSize}px`, // Perfect square
          aspectRatio: "1 / 1", // Ensure perfect square
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "transform 0.2s",
          textDecoration: "none",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* CSS Container - transparent, no outline, perfect square */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(255, 255, 255, 0.5)",
            borderRadius: "20px",
            zIndex: 1,
          }}
        />
        <div style={{ position: "relative", width: "60%", height: "60%", zIndex: 2 }}>
          <Image
            src={image || "/placeholder.svg"}
            alt="Platform"
            fill
            style={{
              objectFit: "contain",
            }}
          />
        </div>
      </a>
    );
  };

  return (
    <PageWrapper className="platforms-page" $isMobile={isMobile}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: -1 }}>
        <Image
          src="/assets/platforms/platforms.avif"
          alt="Platforms Background"
          fill
          style={{ objectFit: "cover", filter: "brightness(0.7)" }}
          priority
        />
      </div>
      <Title $isMobile={isMobile}>Platforms</Title>

      <Container fluid className="px-md-5">
        {isMobile ? (
          // Mobile layout (below 576px) - 2 columns grid
          <Row 
            className="justify-content-center g-2"
            data-aos="zoom-in"
            data-aos-duration="1000"
          >
            {platforms.map((platform) => (
              <Col
                key={platform.id}
                xs={6}
                className="d-flex justify-content-center"
              >
                <PlatformCard image={platform.image} url={platform.url} />
              </Col>
            ))}
          </Row>
        ) : (
          // Desktop/Tablet layout (576px and above) - 4 on top, 3 on bottom
          <>
            <Row className="justify-content-center g-3 mb-4">
              {platforms.slice(0, 4).map((platform) => (
                <Col
                  key={platform.id}
                  xs={3}
                  sm={3}
                  md={3}
                  lg={2}
                  xl={2}
                  className="d-flex justify-content-center"
                  data-aos="zoom-in"
                  data-aos-duration="1000"
                >
                  <PlatformCard image={platform.image} url={platform.url} />
                </Col>
              ))}
            </Row>
            <Row className="justify-content-center g-3">
              {platforms.slice(4, 7).map((platform) => (
                <Col
                  key={platform.id}
                  xs={3}
                  sm={3}
                  md={3}
                  lg={2}
                  xl={2}
                  className="d-flex justify-content-center"
                  data-aos="zoom-in"
                  data-aos-duration="1000"
                >
                  <PlatformCard image={platform.image} url={platform.url} />
                </Col>
              ))}
            </Row>
          </>
        )}
      </Container>
    </PageWrapper>
  );
};

export default PlatformsPage;

