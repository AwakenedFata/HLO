"use client";

import styled, { createGlobalStyle } from "styled-components";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
  padding: 20px;
  background-image: url("/assets/aboutus/background.avif");
  background-size: contain;
  background-repeat: repeat;
  background-position: 0 0;

  @media (max-width: 480px) {
    padding: 15px;
  }
`;

const CardsWrapper = styled.div`
  display: flex;
  gap: 60px;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 1400px;

  @media (max-width: 1024px) {
    gap: 40px;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 30px;
  }

  @media (max-width: 480px) {
    gap: 20px;
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
        <CardsWrapper>
          <Card
            onClick={() => router.push("/aboutus/maknalogo")}
            onMouseEnter={() => setHoveredCard(1)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <CardContent>
              <ImageContainerLogo>
                <img src="/assets/aboutus/logo hok 2.png" alt="Makna Logo HOK" />
              </ImageContainerLogo>
            </CardContent>
            <CardLabel>Makna Logo</CardLabel>
          </Card>

          <Card
            onMouseEnter={() => setHoveredCard(2)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <CardContent>
              <ImageContainerSiluet>
                <img
                  src="/assets/aboutus/personsiluet.avif"
                  alt="Member Coming Soon"
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