"use client"

import { useEffect, useState } from "react"
import styled, { createGlobalStyle } from "styled-components"

const GlobalStyle = createGlobalStyle`
  @font-face {
    font-family: "Corrupted File";
    src: url("/fonts/CORRUPTED FILE.TTF") format("truetype");
    font-weight: normal;
    font-style: normal;
    font-display: block;
  }

  @font-face {
    font-family: "Bahnschrift";
    src: url("/fonts/BAHNSCHRIFT.TTF") format("truetype");
    font-weight: normal;
    font-style: normal;
    font-display: block;
  }

  * {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
`

const PageWrapper = styled.div`
  position: relative;
  width: 794px;
  height: 1123px;
  margin: 0 auto;
  overflow: hidden;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
  background: white;
`

const BackgroundImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
`

const ContentOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
  color: #111;
  font-family: "Bahnschrift", sans-serif;
`

const Title = styled.h1`
  font-size: 15.5px;
  text-align: center;
  font-weight: 600;
  margin: 0;
  position: absolute;
  top: 209px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  font-family: "Bahnschrift", sans-serif;
`

const Paragraph = styled.p`
  text-align: center;
  font-size: 16px;
  line-height: 1.2;
  width: 590px;
  margin: 0;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: "Bahnschrift", sans-serif;
`

const ParagraphTop = styled(Paragraph)`
  top: 247px;
`

const ParagraphMiddle = styled(Paragraph)`
  top: 301px;
`

const SerialSection = styled.div`
  text-align: center;
  position: absolute;
  top: 398px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
`

const SerialLabel = styled.p`
  font-size: 15.5px;
  margin: 0;
  font-weight: 700;
  font-family: "Bahnschrift", sans-serif;
`

const SerialNumber = styled.span`
  font-family: "Corrupted File", monospace;
  font-size: 20px;
  color: #da1b1b;
`

const InfoSection = styled.div`
  text-align: center;
  font-size: 16px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  font-family: "Bahnschrift", sans-serif;
`

const InfoLine = styled.p`
  margin: 0;
  line-height: 1.4;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-family: "Bahnschrift", sans-serif;
`

const IssuedBy = styled(InfoLine)`
  top: 479px;
`

const IssuedOn = styled(InfoLine)`
  top: 501px;
`

const Location = styled(InfoLine)`
  top: 523px;
`

const ParagraphBottom1 = styled(Paragraph)`
  top: 596px;
`

const ParagraphBottom2 = styled(Paragraph)`
  top: 635px;
`

const ParagraphBottom3 = styled(Paragraph)`
  top: 673px;
`

const AuthSignature = styled.p`
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  position: absolute;
  top: 766px;
  left: 50%;
  transform: translateX(-50%);
  font-family: "Bahnschrift", sans-serif;
`

const Footer = styled.footer`
  position: absolute;
  bottom: 140px;
  width: 100%;
  text-align: center;
  font-size: 15px;
  line-height: 1.2;
  color: #000;
  font-family: "Bahnschrift", sans-serif;
`

const FooterLine = styled.div`
  margin: 2px 0;
`

const PreloadContainer = styled.div`
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
`

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: white;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.3s ease;
  opacity: ${props => props.$visible ? 1 : 0};
  pointer-events: ${props => props.$visible ? 'auto' : 'none'};
`

export default function PdfPage({ serialNumber = "", issuedOn = "", location = "" }) {
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [fontsLoaded, setFontsLoaded] = useState(false)

  const safeSerial = String(serialNumber || "").trim()
  const serialToShow = safeSerial.padStart(6, "0")

  let issuedOnString = "—"
  try {
    if (issuedOn) {
      const d = new Date(issuedOn)
      if (!isNaN(d.getTime())) {
        issuedOnString = d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      }
    }
  } catch {}

  let locationString = "—" 
  
  if (location && String(location).trim()) {
    const trimmedLocation = String(location).trim()
    if (trimmedLocation !== "" && trimmedLocation !== "undefined" && trimmedLocation !== "null") {
      locationString = trimmedLocation
    }
  }

  useEffect(() => {
    const imagesToPreload = ["/assets/serialnumber/Surat Originalitas ver 2.png"]

    let loadedCount = 0
    const totalAssets = imagesToPreload.length

    const checkAllLoaded = () => {
      loadedCount++
      if (loadedCount === totalAssets) {
        setAssetsLoaded(true)
      }
    }

    imagesToPreload.forEach((src) => {
      const img = new Image()
      img.onload = checkAllLoaded
      img.onerror = checkAllLoaded
      img.src = src
    })
  }, [])

  useEffect(() => {
    const loadFonts = async () => {
      try {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready
          
          const bahnschriftLoaded = document.fonts.check('16px "Bahnschrift"')
          const corruptedLoaded = document.fonts.check('20px "Corrupted File"')
          
          console.log('Bahnschrift loaded:', bahnschriftLoaded)
          console.log('Corrupted File loaded:', corruptedLoaded)
          
          await new Promise(resolve => setTimeout(resolve, 300))
          
          setFontsLoaded(true)
          
          if (window.parent) {
            window.pdfReady = true
          }
        } else {
          setTimeout(() => {
            setFontsLoaded(true)
            if (window.parent) {
              window.pdfReady = true
            }
          }, 1000)
        }
      } catch (error) {
        console.error('Font loading error:', error)
        setTimeout(() => {
          setFontsLoaded(true)
          if (window.parent) {
            window.pdfReady = true
          }
        }, 1000)
      }
    }

    loadFonts()
  }, [])

  const allReady = assetsLoaded && fontsLoaded

  return (
    <>
      <GlobalStyle />

      <PreloadContainer>
        <img src="/assets/serialnumber/Surat Originalitas ver 2.png" alt="" />
        <span style={{ fontFamily: '"Bahnschrift", sans-serif' }}>.</span>
        <span style={{ fontFamily: '"Corrupted File", monospace' }}>.</span>
      </PreloadContainer>

      <PageWrapper>
        <LoadingOverlay $visible={!allReady}>
          <div style={{ fontSize: '14px', color: '#666' }}>Loading assets...</div>
        </LoadingOverlay>

        <BackgroundImage 
          src="/assets/serialnumber/Surat Originalitas ver 2.png" 
          alt="Certificate Background" 
        />

        <ContentOverlay style={{ opacity: allReady ? 1 : 0 }}>
          <Title>CERTIFICATE OF AUTHENTICITY</Title>

          <ParagraphTop>
            This document verifies that the item associated with the serial number below
            <br />
            is an <b>authentic and original product of HLO</b>.
          </ParagraphTop>

          <ParagraphMiddle>
            Each certified piece represents the brand's dedication to craftsmanship,
            <br />
            detail, and originality — no reproductions, no replicas, no compromises.
          </ParagraphMiddle>

          <SerialSection>
            <SerialLabel>SERIAL NUMBER:</SerialLabel>
            <SerialNumber>{serialToShow}</SerialNumber>
          </SerialSection>

          <InfoSection>
            <IssuedBy>
              <b>Issued by:</b> HLO STORE ID
            </IssuedBy>
            <IssuedOn>
              <b>Issued on:</b> {issuedOnString}
            </IssuedOn>
            <Location>
              <b>Location:</b> {locationString}
            </Location>
          </InfoSection>

          <ParagraphBottom1>
            This certificate confirms that the product listed under the serial number above
            <br />
            has been reviewed, approved, and released under the supervision of
          </ParagraphBottom1>

          <ParagraphBottom2>
            <b>HLO's Authenticity & Quality Control Division.</b>
          </ParagraphBottom2>

          <ParagraphBottom3>
            Any duplication, modification, or reproduction of this certificate
            <br />
            is strictly prohibited and will void its authenticity status.
          </ParagraphBottom3>

          <AuthSignature>Authorized Signature & Official Seal</AuthSignature>

          <Footer>
            <FooterLine>© 2025 HLO</FooterLine>
            <FooterLine>All Rights Reserved Worldwide</FooterLine>
            <FooterLine>www.hoklampung.com</FooterLine>
          </Footer>
        </ContentOverlay>
      </PageWrapper>
    </>
  )
}