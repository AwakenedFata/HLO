"use client"
import { useState } from "react"
import styled from "styled-components"
import { SlLocationPin } from "react-icons/sl"
import { Poppins } from "next/font/google"
import { format } from "date-fns"
import ImageViewerModal from "@/components/modals/ImageViewerModal"

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
})

const Card = styled.div`
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  transition: transform 0.3s ease;
  margin-bottom: 30px;
  &:hover {
    transform: scale(1.05);
  }
`

const ImageWrapper = styled.div`
  width: 100%;
  height: auto;
  overflow: hidden;
  border-radius: 20px;
`

const Image = styled.img`
  width: 100%;
  height: 100%;
  cursor: pointer;
  object-fit: cover;
`

const Content = styled.div`
  padding: 26px;
  margin-left: 5px;
`

const Label = styled.span`
  display: inline-block;
  background: #f5a623;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  padding: 1px 12px;
  border-radius: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const WrapperUpperContent = styled.div`
  display: flex;
  gap: 12px;
  align-items: top;
  margin-bottom: 5px;
`

const WrapperLowerContent = styled.div`
  display: flex;
  gap: 5px;
  color: #fe5050;
`

const Title = styled.h3`
  font-size: 29px;
  font-family: ${poppins.style.fontFamily};
  font-weight: 600;
  margin: 0 0 10px 0;
  cursor: pointer;
  line-height: 1.3;
  white-space: pre-line;
  word-wrap: break-word;
`

const MetaLink = styled.a`
  display: flex;
  align-items: center;
  font-size: 11px;
  cursor: pointer;
  color: #fe5050;
  text-decoration: none;
  transition: all 0.2s ease;
  
  &:hover {
    color: #e74c3c;
  }
  
  &:visited {
    color: #fe5050;
  }
`

const MetaText = styled.div`
  display: flex;
  align-items: center;
  font-size: 11px;
  color: #fe5050;
  cursor: default;
`

const DateText = styled.div`
  font-size: 12px;
  color: #95a5a6;
  margin-top: 4px;
`

// Helper function to validate if URL is a valid Google Maps link
const isValidGoogleMapsLink = (url) => {
  if (!url || typeof url !== "string") return false

  const googleMapsPatterns = [
    /^https:\/\/maps\.google\.com/,
    /^https:\/\/www\.google\.com\/maps/,
    /^https:\/\/goo\.gl\/maps/,
    /^https:\/\/maps\.app\.goo\.gl/,
  ]

  return googleMapsPatterns.some((pattern) => pattern.test(url))
}

const GalleryCard = ({ item }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const formattedDate = item.uploadDate ? format(new Date(item.uploadDate), "dd-MM-yyyy") : ""

  const hasValidMapLink = item.mapLink && item.mapLink.trim() && isValidGoogleMapsLink(item.mapLink.trim())

  const handleImageClick = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  return (
    <>
      <Card>
        <ImageWrapper>
          <Image src={item.imageUrl || "/placeholder.svg"} alt={item.title} onClick={handleImageClick} />
        </ImageWrapper>
        <Content>
          <WrapperUpperContent>
            <Label>{item.label}</Label>
            <DateText>{formattedDate}</DateText>
          </WrapperUpperContent>
          <Title>{item.title}</Title>
          <WrapperLowerContent>
            <SlLocationPin />
            {hasValidMapLink ? (
              <MetaLink
                href={item.mapLink.trim()}
                target="_blank"
                rel="noopener noreferrer"
                title="Klik untuk buka lokasi di Google Maps"
              >
                {item.location}
              </MetaLink>
            ) : (
              <MetaText title="Lokasi">{item.location}</MetaText>
            )}
          </WrapperLowerContent>
        </Content>
      </Card>

      <ImageViewerModal isOpen={isModalOpen} onClose={handleCloseModal} item={item} />
    </>
  )
}

export default GalleryCard
