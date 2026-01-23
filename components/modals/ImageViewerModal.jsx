"use client"
import { useState, useEffect } from "react"
import styled from "styled-components"
import { X, ExternalLink } from "lucide-react"
import { Poppins } from "next/font/google"
import Image from "next/image"

// Helper to check if image is from external source (R2 storage)
const isExternalImage = (url) => {
  if (!url) return false
  return url.includes("r2.dev") || url.startsWith("http")
}

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
})

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  flex-direction: column; /* gambar di atas, tombol di bawah */
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 80px 20px 0;
  gap: 20px;
  overflow-y: auto;
`

const CloseButton = styled.button`
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1001;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.9);
  }
`

const ImageContainer = styled.div`
  max-width: 65vw;
  max-height: 65vh;
  overflow: hidden;
  position: relative;
`

const ModalImage = styled(Image)`
  width: 100%;
  height: auto;
  max-height: 65vh;
  object-fit: contain;
  display: block;
  border-radius: 12px;
`

const ViewArticleButton = styled.button`
  background: #f5ab1d;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 25px;
  font-family: ${poppins.style.fontFamily};
  font-weight: 500;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  &:hover {
    background: #e09400;
  }
`

const ImageViewerModal = ({ isOpen, onClose, item }) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 200)
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const handleViewArticle = async () => {
    try {
      const response = await fetch(`/api/artikel-public/by-gallery/${item._id}`)
      const data = await response.json()

      if (data.success && data.article) {
        const articleUrl = `/article/${data.article.slug}`
        window.open(articleUrl, "_blank")
      } else {
        alert("Artikel belum tersedia untuk galeri ini")
      }
    } catch (error) {
      console.error("Error fetching article:", error)
      alert("Terjadi kesalahan saat mengambil artikel")
    }
  }

  if (!isOpen || !item) return null

  return (
    <ModalOverlay onClick={handleOverlayClick}>
      <CloseButton onClick={handleClose}>
        <X size={20} />
      </CloseButton>

      <ImageContainer>
        <ModalImage 
          src={item.imageUrl || "/placeholder.svg"} 
          alt={item.title} 
          width={1200}
          height={800}
          priority
          unoptimized={isExternalImage(item.imageUrl)}
        />
      </ImageContainer>

      <ViewArticleButton onClick={handleViewArticle}>
        <ExternalLink size={18} />
        Lihat Artikel
      </ViewArticleButton>
    </ModalOverlay>
  )
}

export default ImageViewerModal
