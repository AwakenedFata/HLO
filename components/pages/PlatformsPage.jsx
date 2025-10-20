"use client";

import { useEffect, useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import styled from "styled-components";
import { platforms } from "@/data/index.js";

const PageWrapper = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${(props) => (props.$isMobile ? "30px 15px" : "50px 0")};

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url(/assets/platforms/platforms.avif);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    filter: brightness(0.7);
    z-index: -1;
  }
  `;
  
  const Title = styled.h1`
  font-family: "Nasalization", sans-serif;
  font-size: ${(props) => (props.$isMobile ? "3rem" : "5rem")};
  margin-bottom: ${(props) => (props.$isMobile ? "30px" : "25px")};
  text-align: center;
  text-transform: uppercase;
  text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.5),
  -1px -1px 2px rgba(255, 255, 255, 0.1), 0 2px 4px rgba(0, 0, 0, 0.2);
  color: #f5ab1d;
  position: relative;
  z-index: 1;
  @media (max-width: 768px) {
    padding-top: 30px;
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
      setIsMobile(window.innerWidth <= 768);
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
    const cardSize = isMobile ? "120px" : "clamp(120px, 12vw, 150px)";

    return (
      <div
        className="platform-card"
        style={{
          position: "relative",
          width: cardSize,
          height: cardSize,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "transform 0.2s",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src="/assets/platforms/kotak.png"
          alt="Platform Background"
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "contain",
            zIndex: 1,
          }}
        />
        <img
          src={image || "/placeholder.svg"}
          alt="Platform"
          style={{
            position: "relative",
            width: "60%",
            height: "60%",
            objectFit: "contain",
            zIndex: 2,
          }}
        />
      </div>
    );
  };

  return (
    <PageWrapper className="platforms-page" $isMobile={isMobile}>
      <Title $isMobile={isMobile}>Platforms</Title>

      <Container fluid className="px-md-5">
        {isMobile ? (
          <Row className="justify-content-center g-2">
            {platforms.map((platform) => (
              <Col
                key={platform.id}
                xs={6}
                className="d-flex justify-content-center"
                data-aos="zoom-in"
                data-aos-duration="1000"
              >
                <PlatformCard image={platform.image} url={platform.url} />
              </Col>
            ))}
          </Row>
        ) : (
          <>
            <Row className="justify-content-center g-3 mb-4">
              {platforms.slice(0, 4).map((platform) => (
                <Col
                  key={platform.id}
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
