"use client";
import { Container, Row, Col } from "react-bootstrap";
import { FaWhatsapp, FaTelegramPlane, FaDiscord } from "react-icons/fa";
import { GrFacebookOption } from "react-icons/gr";
import { IoLogoInstagram } from "react-icons/io5";
import { FaXTwitter } from "react-icons/fa6";
import { TfiEmail } from "react-icons/tfi";
import { useMobileDetect } from "@/hooks/use-mobile";
import Image from "next/image";
import VideoBackground from "./VideoBackground";
import WelcomeComponent from "./WelcomeComponent";

const HeroComponent = () => {
  const isMobile = useMobileDetect();

  const handleTouchStart = (e) => {
    e.currentTarget.style.transform = "scale(1.2)";
  };

  const handleTouchEnd = (e) => {
    e.currentTarget.style.transform = "scale(1)";
  };

  const handleMouseEnter = (e) => {
    if (!isMobile) e.currentTarget.style.transform = "scale(1.2)";
  };

  const handleMouseLeave = (e) => {
    if (!isMobile) e.currentTarget.style.transform = "scale(1)";
  };

  const socialLinks = [
    {
      href: "https://chat.whatsapp.com/CDyNXvgyxwMG0c7idouoQR",
      icon: <FaWhatsapp />,
    },
    {
      href: "https://www.instagram.com/hoklampung.official/",
      icon: <IoLogoInstagram />,
    },
    {
      href: "https://www.facebook.com/honorofkings.og.id",
      icon: <GrFacebookOption />,
    },
    { href: "https://discord.com/invite/yM473crPms", icon: <FaDiscord /> },
    { href: "https://twitter.com/honorofkings", icon: <FaXTwitter /> },
    { href: "https://t.me/honorofkings_id", icon: <FaTelegramPlane /> },
    {
      href: "https://mail.google.com/mail/?view=cm&fs=1&to=hoklampung.official@gmail.com",
      icon: <TfiEmail />,
    },
  ];

  return (
    <div className="homepage">
      <h1 className="seo-h1">
        HOK Lampung Official - Komunitas Honor of Kings Lampung
      </h1>
      <header className="w-100 min-vh-100 d-flex align-items-center">
        <VideoBackground />
        <Container className="position-relative" style={{ zIndex: 2 }}>
          <Row className="header-box d-flex flex-lg-row flex-column align-items-center">
            <Col
              lg="6"
              style={{ overflow: "visible", minHeight: "auto", zIndex: 3 }}
            >
              <WelcomeComponent />
              <div className="social-icons">
                {socialLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.href}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.icon}
                  </a>
                ))}
              </div>
            </Col>
            <Col
              lg="6"
              className="pt-lg-0 pt-5 d-flex justify-content-center"
              style={{ overflow: "visible", zIndex: 1 }}
            >
              <Image
                src="/assets/Home/logo 3D.avif"
                alt="LOGOHOK"
                className="logo3d float-animation"
                width={1000}
                height={1000}
                style={{ zIndex: 1 }}
              />
            </Col>
          </Row>
        </Container>
      </header>
    </div>
  );
};

export default HeroComponent;
