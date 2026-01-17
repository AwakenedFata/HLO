"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import { marketPlace } from "@/data/index.js";
import { createGlobalStyle } from "styled-components";
import Image from "next/image";

const GlobalFonts = createGlobalStyle`
  @font-face {
    font-family: "Gilroy-SemiBold";
    src: url("/fonts/Gilroy-SemiBold.ttf") format("truetype");
  }

  body {
    font-family: "Gilroy-SemiBold", sans-serif;
  }
`;

const PageContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  background-color: #cdcdcd;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;

  @media (max-width: 768px) {
    padding: 50px 20px 70px;
    min-height: 100vh;
  }

  @media (max-width: 480px) {
    padding: 60px 20px 80px;
  }
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 1400px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0px;

  @media (max-width: 1024px) {
    gap: 0px;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 20px;
    justify-content: center;
  }

`;

const ProductSection = styled.div`
  flex: 1.5;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500px;

  @media (max-width: 768px) {
    flex: 1;
    min-height: auto;
    width: 100%;
    max-width: 100%;
    padding: 0 10px;
  }

  @media (max-width: 480px) {
    padding: 20px 5px 0;
  }
`;

const ProductImage = styled(Image)`
  width: 150%;
  height: auto;
  max-width: 850px;
  object-fit: contain;
  filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.2));
  margin-left: 40px;

  @media (max-width: 1024px) {
    max-width: 650px;
    margin-left: 0px;
  }

  @media (max-width: 768px) {
    width: 100%;
    max-width: 500px;
  }

  @media (max-width: 480px) {
    width: 150%;
    max-width: 360px;
  }

  @media (max-width: 375px) {
    max-width: 300px;
  }
`;

const InfoSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;

  @media (max-width: 768px) {
    align-items: center;
    text-align: center;
    width: 100%;
    gap: 40px;
  }

  @media (max-width: 480px) {
    gap: 35px;
  }
`;

const Title = styled.h1`
  font-size: 2rem;
  color: #c41e3a;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin: 0;
  line-height: 1.2;

  @media (max-width: 1024px) {
    font-size: 2.2rem;
  }

  @media (max-width: 768px) {
    font-size: 2.8rem;
  }

  @media (max-width: 480px) {
    font-size: 2.3rem;
    letter-spacing: 1.5px;
  }

  @media (max-width: 375px) {
    font-size: 2rem;
  }
`;

const MarketplaceBox = styled.div`
  width: 75%;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  align-items: center;
  justify-items: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);

  @media (max-width: 1024px) {
    padding: 25px;
    width: 90%;
    gap: 15px;
  }

  @media (max-width: 768px) {
    padding: 35px 30px;
    gap: 25px;
    width: 85%;
    max-width: 500px;
  }

  @media (max-width: 480px) {
    padding: 32px 28px;
    gap: 22px;
    border-radius: 18px;
    width: 90%;
  }

  @media (max-width: 375px) {
    padding: 28px 24px;
    gap: 20px;
    width: 92%;
  }
`;

const MarketplaceIcon = styled(Image)`
  width: 70px;
  height: 70px;
  object-fit: contain;
  transition: transform 0.3s ease, filter 0.3s ease;
  cursor: pointer;

  &:hover {
    transform: scale(1.1);
    filter: brightness(1.1);
  }

  @media (max-width: 1024px) {
    width: 55px;
    height: 55px;
  }

  @media (max-width: 768px) {
    width: 75px;
    height: 75px;
  }

  @media (max-width: 480px) {
    width: 68px;
    height: 68px;
  }

  @media (max-width: 375px) {
    width: 62px;
    height: 62px;
  }
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
      const width = window.innerWidth;
      setIsMobile(width <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isClient]);

  const productImage = "/assets/Merchandise/product.avif";

  return (
    <>
    <GlobalFonts />
      <PageContainer>
        <ContentWrapper>
          <ProductSection>
            <ProductImage 
              src={productImage} 
              alt="Merchandise Products" 
              width={850} 
              height={500} 
              priority 
            />
          </ProductSection>

          <InfoSection>
            <Title>Available On</Title>
            <MarketplaceBox>
              {marketPlace.map((marketplace) => (
                <MarketplaceIcon
                  key={marketplace.id}
                  src={marketplace.image || "/placeholder.svg"}
                  alt={`Marketplace ${marketplace.id}`}
                  width={70}
                  height={70}
                />
              ))}
            </MarketplaceBox>
          </InfoSection>
        </ContentWrapper>
      </PageContainer>
    </>
  );
}

export default MerchanPage;
