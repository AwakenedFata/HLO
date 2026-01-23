"use client";

import styled, { createGlobalStyle } from "styled-components";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const GlobalFonts = createGlobalStyle`
  @font-face {
    font-family: "Gilroy-SemiBold";
    src: url("/fonts/Gilroy-SemiBold.ttf") format("truetype");
  }

  body {
    font-family: "Gilroy-SemiBold", sans-serif;
    margin: 0;
    padding: 0;
  }

  * {
    box-sizing: border-box;
  }
`;

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Background handled by Next.js Image */
  position: relative;

  @media (max-width: 768px) {
    padding: 120px 20px 40px;
    align-items: flex-start;
  }

  @media (max-width: 480px) {
    padding: 50px 15px 30px;
  }
`;

const CardsWrapper = styled.div`
  display: flex;
  gap: 60px;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 1400px;
  position: relative;
  z-index: 1; /* Ensure cards are above background */

  @media (max-width: 1024px) {
    gap: 40px;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 40px;
    padding: 20px 0;
  }

  @media (max-width: 480px) {
    gap: 30px;
    padding: 15px 0;
  }
`;

const Card = styled.div`
  width: 340px;
  height: 440px;
  border-radius: 26px;
  overflow: hidden;
  background-color: #f5a623;
  box-shadow: 5px 5px 5px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  cursor: pointer;
  position: relative;

  @media (max-width: 1024px) {
    width: 300px;
    height: 388px; /* Menjaga rasio 340:440 = 300:388 */
    border-radius: 23px;
  }

  @media (max-width: 768px) {
    width: 320px;
    height: 414px; /* Menjaga rasio 340:440 = 320:414 */
    border-radius: 24px;
  }

  @media (max-width: 480px) {
    width: 280px;
    height: 362px; /* Menjaga rasio 340:440 = 280:362 */
    border-radius: 21px;
    box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.3);
  }

  @media (max-width: 380px) {
    width: 260px;
    height: 336px; /* Menjaga rasio 340:440 = 260:336 */
    border-radius: 20px;
  }

  @media (max-width: 340px) {
    width: 240px;
    height: 310px; /* Menjaga rasio 340:440 = 240:310 */
    border-radius: 18px;
  }

  &:hover {
    transform: scale(1.02);
  }

  &:active {
    transform: scale(1.04);
  }

  @media (hover: none) {
    &:hover {
      transform: none;
    }
    &:active {
      transform: scale(0.98);
    }
  }
`;

const CardContent = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background-color: #f5a623;
`;

const ImageContainerLogo = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 68%;
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
    transition: transform 0.4s ease;
  }

  @media (max-width: 480px) {
    img {
      width: 65%;
    }
  }

  ${Card}:hover & img {
    transform: scale(1.08) rotate(2deg);
  }
`;

const ImageContainerSiluet = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  position: relative;

  img {
    width: 70%;
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
    transition: transform 0.4s ease;
  }

  @media (max-width: 480px) {
    img {
      width: 68%;
    }
  }

  ${Card}:hover & img {
    transform: scale(1.08) rotate(2deg);
  }
`;

const CardLabel = styled.div`
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.55);
  text-align: center;
  color: white;
  font-size: 24px;
  font-weight: 500;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;

  @media (max-width: 1024px) {
    font-size: 22px;
    min-height: 40px;
  }

  @media (max-width: 768px) {
    font-size: 20px;
    padding: 10px;
  }

  @media (max-width: 480px) {
    font-size: 18px;
    min-height: 36px;
    padding: 8px;
  }

  @media (max-width: 360px) {
    font-size: 16px;
    min-height: 32px;
  }

  &::before {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, #f5a623, transparent);
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  ${Card}:hover &::before {
    opacity: 1;
  }
`;

export default function AboutUsPage() {
  const router = useRouter();
  const [hoveredCard, setHoveredCard] = useState(null);

  return (
    <>
      <GlobalFonts />
      <PageContainer>
        <div style={{ position: "absolute", width: "100%", height: "100%", top: 0, left: 0, zIndex: 0 }}>
           <Image 
              src="/assets/aboutus/background.avif" 
              alt="Background" 
              fill 
              style={{ objectFit: 'cover' }} /* Changed from contain to cover */
              quality={100}
              priority
           />
        </div>
        <CardsWrapper>
          <Card
            onClick={() => router.push("/aboutus/maknalogo")}
            onMouseEnter={() => setHoveredCard(1)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <CardContent>
              <ImageContainerLogo style={{ position: 'relative' }}>
                <Image 
                  src="/assets/aboutus/logo2.avif" 
                  alt="Makna Logo HOK" 
                  width={230}
                  height={300} // Estimasi rasio
                  style={{ width: '68%', height: 'auto', objectFit: 'contain' }}
                />
              </ImageContainerLogo>
            </CardContent>
            <CardLabel>Makna Logo</CardLabel>
          </Card>

          <Card
            onMouseEnter={() => setHoveredCard(2)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <CardContent>
              <ImageContainerSiluet style={{ position: 'relative' }}>
                <Image
                  src="/assets/aboutus/personsiluet.avif"
                  alt="Member Coming Soon"
                  width={240}
                  height={310} // Estimasi rasio
                  style={{ width: '70%', height: 'auto', objectFit: 'contain' }} 
                />
              </ImageContainerSiluet>
            </CardContent>
            <CardLabel>Member (Coming Soon)</CardLabel>
          </Card>
        </CardsWrapper>
      </PageContainer>
    </>
  );
}