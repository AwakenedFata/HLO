"use client"
import { useState } from "react"
import { useRouter } from "next/navigation" // add router import for navigation on title click
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
  margin-bottom: 20px;

  @media (min-width: 640px) {
    margin-bottom: 26px;
  }

  @media (min-width: 1024px) {
    margin-bottom: 30px;
  }

  &:hover {
    transform: scale(1.02);
  }
`

const ImageWrapper = styled.div`
  width: 100%;
  height: 280px;
  overflow: hidden;
  border-radius: 20px;
  position: relative;
  background: #f8f9fa;

  /* Prefer aspect-ratio for stability */
  aspect-ratio: 16 / 10;

  /* Fallback if aspect-ratio unsupported */
  @supports not (aspect-ratio: 16/10) {
    height: clamp(180px, 28vw, 250px);
  }

  @media (min-width: 1024px) {
    aspect-ratio: 16 / 9;
    width: 100%;
    height: 280px;
  }

  @media (max-width: 480px) {
    height: 200px;
  }
`

const Image = styled.img`
  width: 100%;
  height: 100%;
  cursor: pointer;
  object-fit: cover;
  object-position: center center;
  transition: transform 0.3s ease, opacity 0.3s ease;
  display: block;
  min-width: 100%;
  min-height: 100%;

  ${Card}:hover & {
    transform: scale(1.02);
  }
`

const Content = styled.div`
  padding: 16px;

  @media (max-width: 480px) {
    padding: 25px;
  }

  @media (min-width: 640px) {
    padding: 20px;
  }

  @media (min-width: 1024px) {
    padding: 26px;
  }

  margin-left: 2px;
`

const Label = styled.span`
  display: inline-block;
  background: #f5a623;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  padding: 1px 10px;
  border-radius: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  @media (min-width: 640px) {
    font-size: 14px;
    padding: 1px 11px;
  }

  @media (min-width: 1024px) {
    font-size: 15px;
    padding: 1px 12px;
  }
`

const WrapperUpperContent = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 6px;

  @media (min-width: 640px) {
    gap: 12px;
    margin-bottom: 8px;
  }
`

const WrapperLowerContent = styled.div`
  display: flex;
  gap: 6px;
  color: #fe5050;
`

const Title = styled.h3`
  font-family: ${poppins.style.fontFamily};
  font-weight: 600;
  margin: 0 0 10px 0;
  cursor: pointer;
  line-height: 1.3;
  white-space: pre-line;
  word-wrap: break-word;
  font-size: 18px;

  @media (max-width: 480px) {
    font-size: 25px;
  }

  @media (min-width: 640px) {
    font-size: 22px;
  }

  @media (min-width: 1024px) {
    font-size: 29px;
  }
`

const MetaLink = styled.a`
  display: flex;
  align-items: center;
  font-size: 12px;
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

  @media (min-width: 1024px) {
    font-size: 11px;
  }
`

const MetaText = styled.div`
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #fe5050;
  cursor: default;
  
  @media (min-width: 1024px) {
    font-size: 11px;
  }

`

const DateText = styled.div`
  font-size: 12px;
  color: #95a5a6;
  margin-top: 2px;

  @media (min-width: 640px) {
    margin-top: 4px;
  }
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
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const router = useRouter() // add router import for navigation on title click

  const formattedDate = item.uploadDate ? format(new Date(item.uploadDate), "dd-MM-yyyy") : ""

  const hasValidMapLink = item.mapLink && item.mapLink.trim() && isValidGoogleMapsLink(item.mapLink.trim())

  const handleImageClick = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const handleImageLoad = () => {
    setImageLoaded(true)
    setImageError(false)
  }

  const handleImageError = () => {
    setImageError(true)
    setImageLoaded(false)
  }

  const handleTitleClick = async () => {
    try {
      const res = await fetch(`/api/artikel-public/by-gallery/${item._id}`)
      const data = await res.json()
      if (data?.success && data?.article?.slug) {
        router.push(`/article/${data.article.slug}`)
      } else {
        alert("Artikel belum tersedia untuk galeri ini")
      }
    } catch (err) {
      console.error("[v0] Error fetching related article:", err)
      alert("Terjadi kesalahan saat mengambil artikel")
    }
  }

  return (
    <>
      <Card>
        <ImageWrapper>
          {!imageLoaded && !imageError && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "#6c757d",
                fontSize: "14px",
              }}
            >
              Loading...
            </div>
          )}
          <Image
            src={item.imageUrl || "/placeholder.svg?height=400&width=600&query=gallery%20image" || "/placeholder.svg"}
            alt={item.title}
            onClick={handleImageClick}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{
              opacity: imageLoaded ? 1 : 0,
            }}
          />
        </ImageWrapper>
        <Content>
          <WrapperUpperContent>
            <Label>{item.label}</Label>
            <DateText>{formattedDate}</DateText>
          </WrapperUpperContent>
          <Title
            onClick={handleTitleClick}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleClick()
            }}
          >
            {item.title}
          </Title>
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