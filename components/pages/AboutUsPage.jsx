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
  }
`;

// Layout utama halaman
const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-image: url("/assets/aboutus/background.avif");
  background-size: auto;
  background-repeat: repeat;
  background-position: 0 0;
`;

const CardsWrapper = styled.div`
  display: flex;
  gap: 60px;
  justify-content: center;
  align-items: center;
  width: 100%;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 30px;
  }
`;

// Struktur dasar card
const Card = styled.div`
  width: 340px;
  height: 440px;
  border-radius: 26px;
  overflow: hidden;
  background-color: #f5a623;
  box-shadow: 5px 5px 5px  rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  cursor: pointer;
  position: relative;

  &:hover {
    transform: scale(1.02);
  }

  &:active {
    transform: scale(1.04);
  }
`;

// Isi card (konten utama)
const CardContent = styled.div`
  flex: 1;
  display: flex;
  align-items: center; /* Tengahkan secara vertikal */
  justify-content: center;
  position: relative;
  background-color: #f5a623;
`;

// Container untuk gambar logo HOK (benar-benar di tengah card)
const ImageContainerLogo = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center; /* logo benar-benar di tengah */
  justify-content: center;

  img {
    width: 68%;
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
    transition: transform 0.4s ease;
  }

  ${Card}:hover & img {
    transform: scale(1.08) rotate(2deg);
  }
`;

// Container untuk gambar siluet (bagian bawah harus nempel)
const ImageContainerSiluet = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end; /* dorong gambar ke bawah */
  justify-content: center;
  position: relative;

  img {
    width: 70%;
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
    transition: transform 0.4s ease;
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
    transform: scale(0)
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
          {/* Card 1: Logo */}
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

          {/* Card 2: Member Coming Soon */}
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
