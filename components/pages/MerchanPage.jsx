"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import Image from "next/image";

const PageContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  background-color: #cdcdcd;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
`;

const ComingSoonImage = styled(Image)`
  width: 100%;
  height: 100vh;
  object-fit: cover;
`;

function MerchanPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isClient]);

  const desktopImage = "/assets/Merchandise/comingsoon.avif";
  const mobileImage = "/assets/Merchandise/comingsoonvertikal.webp";

  if (!isClient) {
    return (
      <PageContainer>
        <ComingSoonImage
          src={desktopImage}
          alt="Coming Soon"
          width={1920}
          height={1080}
          priority
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ComingSoonImage
        src={isMobile ? mobileImage : desktopImage}
        alt="Coming Soon"
        width={isMobile ? 768 : 1920}
        height={isMobile ? 1024 : 1080}
        priority
      />
    </PageContainer>
  );
}

export default MerchanPage;
