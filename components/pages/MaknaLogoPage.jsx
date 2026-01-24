"use client";

import styled, { createGlobalStyle } from "styled-components";
import HotspotLogoComponent from "@/components/HotspotLogoComponent";

const GlobalStyle = createGlobalStyle`
  @font-face {
    font-family: 'Gilroy-Bold';
    src: url('/fonts/Gilroy-Bold.ttf') format('truetype');
    font-weight: bold;
    font-style: normal;
  }

  @font-face {
    font-family: 'Gilroy-Medium';
    src: url('/fonts/Gilroy-Medium.ttf') format('truetype');
    font-weight: 500;
    font-style: normal;
  }

  @font-face {
    font-family: 'Calibri-Bold';
    src: url('/fonts/Calibri-Bold.ttf') format('truetype');
    font-weight: bold;
    font-style: normal;
  }

  @font-face {
    font-family: 'Calibri-Regular';
    src: url('/fonts/Calibri-Regular.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
  }
`;

const MainContainer = styled.div`
  display: flex;
  background-color: #ffffff;
  padding: 60px;
  gap: 80px;
  min-height: 100vh;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  /* Large Desktop */
  @media (min-width: 1200px) {
    padding: 60px 80px;
    gap: 100px;
  }

  /* Tablet Vertical (1024px - 768px) */
  @media (max-width: 1024px) and (min-width: 769px) {
    flex-direction: column;
    padding: 30px 0;
    padding-top: 140px;
    justify-content: flex-start;
    gap: 25px;
    min-height: auto;
  }

  /* Tablet & Mobile (Vertical Layout) */
  @media (max-width: 768px) {
    flex-direction: column;
    padding: 30px 20px;
    justify-content: flex-start;
    gap: 25px;
    padding-top: 80px;
    min-height: auto;
  }

  @media (max-width: 480px) {
    padding: 25px 15px;
    padding-top: 60px;
    gap: 20px;
  }
`;

const LeftSection = styled.div`
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 320px;

  @media (min-width: 1200px) {
    min-width: 400px;
  }

  @media (max-width: 1024px) {
    width: 100%;
    max-width: 500px;
    min-width: unset;
  }

  @media (max-width: 480px) {
    width: 100%;
    max-width: 100%;
  }
`;

const RightSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;

  @media (min-width: 1200px) {
    max-width: 650px;
  }

  @media (max-width: 1024px) {
    width: 100%;
    max-width: 700px;
    /* Removed negative margins to prevent overlap */
  }

  @media (max-width: 480px) {
    padding: 0 20px;
  }

  @media (max-width: 380px) {
    padding: 0 20px;
  }
`;

const InfoContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 0px;
  text-align: center;
  width: 100%;
  justify-content: space-between;

  @media (max-width: 768px) {
    gap: 15px;
  }

  @media (max-width: 480px) {
    gap: 8px;
  }

  @media (max-width: 360px) {
    gap: 6px;
  }
`;

const InfoItem = styled.div`
  flex: 1;
  min-width: 80px;

  @media (max-width: 360px) {
    min-width: 70px;
  }
`;

const InfoTitle = styled.h3`
  font-family: 'Calibri-Bold', sans-serif;
  fontSize: 17px;
  color: #949494;
  font-weight: 600;
  margin-bottom: 8px;
  margin-top: 0;

  @media (min-width: 1024px) {
    font-size: 14px;
  }

  @media (max-width: 1023px) {
    font-size: 16px;
  }

  @media (max-width: 768px) {
    font-size: 14px;
  }

  @media (max-width: 480px) {
    font-size: 12px;
    margin-bottom: 5px;
  }

  @media (max-width: 360px) {
    font-size: 11px;
    margin-bottom: 4px;
  }
`;

const InfoText = styled.p`
  font-family: 'Calibri-Regular', sans-serif;
  font-size: 11px;
  color: #949494;
  line-height: 1.2;
  margin: 0;
  margin-top: 2px;
  white-space: pre-line; /* Handle line breaks */

  @media (max-width: 768px) {
    font-size: 10px;
  }

  @media (max-width: 480px) {
    font-size: 8px;
    line-height: 1.3;
  }

  @media (max-width: 360px) {
    font-size: 7px;
  }
`;

const DescriptionText = styled.p`
  font-family: 'Calibri-Regular', sans-serif;
  font-size: 14px;
  color: #949494;
  line-height: 1.8;
  text-align: justify;
  margin-bottom: 10px;
  margin-top: 0;

  @media (min-width: 1200px) {
    font-size: 15px;
    line-height: 1.9;
  }

  @media (max-width: 768px) {
    font-size: 12px;
    line-height: 1.6;
  }

  @media (max-width: 480px) {
    font-size: 13px;
  }

  @media (max-width: 380px) {
    font-size: 12px;
  }

  @media (max-width: 360px) {
    font-size: 10px;
    line-height: 1.5;
  }
`;

export default function MaknaLogoPage() {
  return (
    <>
      <GlobalStyle />
      <MainContainer>
        {/* Left Section */}
        <LeftSection>
          <HotspotLogoComponent />

          {/* Bottom Info */}
          <InfoContainer>
            <InfoItem>
              <InfoTitle>Nama Logo</InfoTitle>
              <InfoText>
                HOK LAMPUNG
                {"\n"}
                OFFICIAL
              </InfoText>
            </InfoItem>

            <InfoItem>
              <InfoTitle>Slogan</InfoTitle>
              <InfoText>#OURALLCOMMUNITY</InfoText>
            </InfoItem>

            <InfoItem>
              <InfoTitle>Warna</InfoTitle>
              <InfoText>
                HEX : #F5A81D
                {"\n"}
                RGB : 245, 171, 29
                {"\n"}
                CMYK : 0, 30, 88, 4
              </InfoText>
            </InfoItem>
          </InfoContainer>
        </LeftSection>

        {/* Right Section */}
        <RightSection>
          <DescriptionText>
            Logo Honor of Kings Lampung Official Community ini menggabungkan
            tiga elemen penting yang penuh makna. Di bagian atas terdapat Siger,
            lambang khas Provinsi Lampung yang melambangkan kehormatan,
            kebanggaan, dan identitas daerah. Kehadiran Siger menggambarkan
            bahwa komunitas ini lahir dari semangat masyarakat Lampung yang
            menjunjung tinggi nilai lokal namun tetap terbuka pada perkembangan
            global. Warna oranye keemasan yang digunakan juga mencerminkan
            semangat, keberanian, dan energi positif, sesuai dengan karakter
            para pemain yang kompetitif dan berjiwa juang tinggi.
          </DescriptionText>

          <DescriptionText>
            Sementara itu, di bagian tengah terdapat huruf HOK yang menjadi
            identitas utama komunitas, mewakili semangat kebersamaan dan
            kekompakan untuk pemain Honor of Kings. Logo Honor of Kings Official
            di bagian bawah menandakan bahwa komunitas ini resmi dan diakui
            secara global, bukan sekadar perkumpulan biasa, melainkan bagian
            dari ekosistem esports yang besar dan profesional. Secara
            keseluruhan, logo ini mencerminkan kebanggaan daerah, semangat
            komunitas, dan pengakuan resmi - menunjukkan bahwa komunitas HOK
            Lampung berdiri dengan karakter kuat, bersatu, dan siap berkembang
            bersama dunia esports internasional.
          </DescriptionText>
        </RightSection>
      </MainContainer>
    </>
  );
}
