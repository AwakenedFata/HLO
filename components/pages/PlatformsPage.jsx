"use client";

import { useEffect, useState } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { platforms } from "@/data/index.js";

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

  const PlatformCard = ({ image, url }) => (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none" }}
    >
      <div
        className="platform-card"
        style={{
          position: "relative",
          width: isMobile ? "120px" : "150px",
          height: isMobile ? "120px" : "150px",
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
    </a>
  );

  return (
    <div
      className="platforms-page w-100 min-vh-100"
      style={{
        backgroundImage: "url(/assets/platforms/platforms.avif)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "30px 15px" : "50px 0",
      }}
    >
      <h1
        className="platforms-title"
        style={{
          fontSize: isMobile ? "3rem" : "5rem",
          marginBottom: isMobile ? "30px" : "50px",
          textAlign: "center",
          textTransform: "uppercase",
        }}
      >
        Platforms
      </h1>

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
            <Row className="justify-content-center g-4">
              {platforms.slice(0, 5).map((platform) => (
                <Col
                  key={platform.id}
                  md={2}
                  className="d-flex justify-content-center"
                  data-aos="zoom-in"
                  data-aos-duration="1000"
                >
                  <PlatformCard image={platform.image} url={platform.url} />
                </Col>
              ))}
            </Row>
            <Row className="justify-content-center g-4 mt-3">
              {platforms.slice(5, 10).map((platform) => (
                <Col
                  key={platform.id}
                  md={2}
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
    </div>
  );
};

export default PlatformsPage;
