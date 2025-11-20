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
    font-style: regular;
    font-display: block;
  }
`

const PageWrapper = styled.div`
  position: relative;
  width: 794px;
  height: 1123px;
  margin: 0 auto;
  overflow: hidden;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
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

const TextOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
`

const SerialNumber = styled.span`
  position: absolute;
  top: 398px;
  left: 59.5%;
  transform: translateX(-50%);
  font-family: "Corrupted File", monospace;
  font-size: 21.5px;
  color: #da1b1b;
`

const IssuedOn = styled.span`
  position: absolute;
  top: 499px;
  left: 56.8%;
  transform: translateX(-50%);
  font-family: "Bahnschrift", sans-serif;
  font-size: 16px;
  color: #111;
`

const Location = styled.span`
  position: absolute;
  top: 518px; 
  left: 54.5%;
  transform: translateX(-50%);
  font-family: "Bahnschrift", sans-serif;
  font-size: 16px;
  color: #111;
  max-width: 400px;
  text-align: center;
  white-space: normal;
  word-wrap: break-word;
`

const PreloadContainer = styled.div`
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
`

export default function PdfPage({ serialNumber = "", issuedOn = "", location = "" }) {
  const [assetsLoaded, setAssetsLoaded] = useState(false)

  const safeSerial = String(serialNumber || "").trim()
  const serialToShow = safeSerial.padStart(6, "123456")

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

  const locationString = location ? String(location).trim() : "Indonesia"

  useEffect(() => {
    const imagesToPreload = ["/assets/serialnumber/Surat Originalitas.png"]

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

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        console.log("Fonts loaded")
      })
    }
  }, [])

  return (
    <>
      <GlobalStyle />

      <PreloadContainer>
        <img src="/assets/serialnumber/Surat Originalitas.png" alt="" />
      </PreloadContainer>

      <PageWrapper>
        <BackgroundImage src="/assets/serialnumber/Surat Originalitas.png" alt="Certificate of Authenticity" />

        <TextOverlay>
          <SerialNumber>{serialToShow}</SerialNumber>
          <IssuedOn>{issuedOnString}</IssuedOn>
          <Location>{locationString}</Location>
        </TextOverlay>
      </PageWrapper>
    </>
  )
}
