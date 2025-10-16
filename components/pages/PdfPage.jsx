"use client"
import styled, { createGlobalStyle } from "styled-components"

const GlobalStyle = createGlobalStyle`
  @font-face {
    font-family: "Bahnschrift";
    src: url("/fonts/BAHNSCHRIFT.TTF") format("truetype");
    font-weight: normal;
    font-style: regular;
  }

  @font-face {
    font-family: "Corrupted File";
    src: url("/fonts/CORRUPTED FILE.TTF") format("truetype");
    font-weight: normal;
    font-style: normal;
  }
`

const PageWrapper = styled.div`
  position: relative;
  width: 794px; /* A4 lebar px @96dpi */
  height: 1123px; /* A4 tinggi px @96dpi */
  margin: 0 auto;
  background: url("/assets/serialnumber/Surat Originalitas background.png") center/cover no-repeat;
  color: #111;
  font-family: "Bahnschrift", sans-serif;
  overflow: hidden;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
`

const Header = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 110px;
  gap: 20px;
`

const Divider = styled.div`
  width: 2.5px;
  height: 48px;
  background-color: #da1b1b;
`

const Logo = styled.img`
  height: 44px;
  object-fit: contain;
`

const Title = styled.h1`
  font-size: 15.5px;
  text-align: center;
  font-weight: 600;
  margin-top: 45px;
`

const Paragraph = styled.p`
  text-align: center;
  font-size: 16px;
  line-height: 1.2;
  width: 590px;
  margin: 22px auto;
`

const Line = styled.hr`
  width: calc(100% - 424px);
  border: none;
  border-top: 2px solid #000;
  margin: 25px auto;
  mix-blend-mode: normal; 
  opacity: 1; 
`

const SerialSection = styled.div`
  text-align: center;
  margin-top: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
`

const SerialLabel = styled.p`
  font-size: 15.5px;
  margin: 0;
`

const SerialNumber = styled.span`
  font-family: "Corrupted File", monospace;
  font-size: 20px;
  color: #da1b1b;
`

const InfoSection = styled.div`
  text-align: center;
  font-size: 16px;
  line-height: 0;
  margin: 42px 0px;
`

const SignatureSection = styled.div`
  text-align: center;
  margin-top: 32px;
  position: relative;
`

const Signature = styled.img`
  width: 238px;
  display: inline-block;
`

const Stamp = styled.img`
  position: absolute;
  width: 96px;
  bottom: -20px;
  transform: rotate(-20deg);
  right: 268px;
`

const Footer = styled.footer`
  position: absolute;
  bottom: 145px;
  width: 100%;
  text-align: center;
  font-size: 15px;
  line-height: 1.2;
  color: #000;
`

export default function PdfPage({ serialNumber = "", issuedOn = "", product = {} }) {
  const safeSerial = String(serialNumber || "").trim()
  const serialToShow = safeSerial.padStart(6, "0")
  let issuedOnString = "—"
  try {
    if (issuedOn) {
      const d = new Date(issuedOn)
      if (!isNaN(d.getTime())) {
        issuedOnString = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      }
    }
  } catch {}

  return (
    <>
      <GlobalStyle />
      <PageWrapper>
        <Header>
          <Logo src="/assets/serialnumber/HLO ID 2.png" alt="HLO" />
          <Divider />
          <Logo src="/assets/serialnumber/logo hok.png" alt="HOK" />
        </Header>

        <Title>CERTIFICATE OF AUTHENTICITY</Title>

        <Paragraph>
          This document verifies that the item associated with the serial number below
          <br />
          is an <b>authentic and original product of HLO</b>.
        </Paragraph>
        <Paragraph>
          Each certified piece represents the brand's dedication to craftsmanship,
          <br />
          detail, and originality — no reproductions, no replicas, no compromises.
        </Paragraph>

        <Line />

        <SerialSection>
          <SerialLabel>
            <b>SERIAL NUMBER:</b>
          </SerialLabel>
          <SerialNumber>{serialToShow}</SerialNumber>
        </SerialSection>

        <Line />

        <InfoSection>
          <p>
            <b>Issued by:</b> HLO STORE ID
          </p>
          <p>
            <b>Issued on:</b> {issuedOnString}
          </p>
          <p>
            <b>Location:</b> Lampung, Indonesia
          </p>
        </InfoSection>

        <Line />

        <Paragraph>
          This certificate confirms that the product listed under the serial number above <br />
          has been reviewed, approved, and released under the supervision of
          <br />
          <b>HLO's Authenticity & Quality Control Division.</b>
        </Paragraph>
        <Paragraph>
          Any duplication, modification, or reproduction of this certificate
          <br />
          is strictly prohibited and will void its authenticity status.
        </Paragraph>

        <Line />

        <Paragraph>
          <b>Authorized Signature & Official Seal</b>
        </Paragraph>

        <SignatureSection>
          <Signature src="/assets/serialnumber/ttd.png" alt="Signature" />
          <Stamp src="/assets/serialnumber/stamp.png" alt="Seal" />
        </SignatureSection>

        <Line />

        <Footer>
          <div>© 2025 HLO</div>
          <div>All Rights Reserved Worldwide</div>
          <div>www.hoklampung.com</div>
        </Footer>

        <Line style={{ margin: "105px auto" }} />
      </PageWrapper>
    </>
  )
}
