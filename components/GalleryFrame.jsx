"use client"
import styled from "styled-components"

const FrameContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 400px;
  aspect-ratio: 3/4; /* Force 3:4 vertical aspect ratio */
  display: flex;
  justify-content: center;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  border-radius: 42px;
  margin: 0 auto;
`

const FrameWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`

const GalleryImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover; /* Ensure image covers the entire frame */
  object-position: center; /* Center the image */
  transition: transform 0.3s ease;
  display: block;
  border-radius: 42px;
  position: relative;
  z-index: 1;

  &:hover {
    transform: scale(1.05);
    cursor: pointer;
  }
`

const FrameOverlay = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-position: center;
  z-index: 2;
  pointer-events: none;
  transition: transform 0.3s ease;

  ${FrameContainer}:hover & {
    transform: scale(1.05);
  }
`


const GalleryFrame = ({ galleryItem, onImageClick }) => {
  const handleImageClick = () => {
    if (onImageClick) {
      onImageClick(galleryItem)
    }
  }

return (
  <FrameContainer className="frame-container">
    {/* Frame di luar, lapisan paling atas */}
    {galleryItem.frame && (
      <FrameOverlay src={galleryItem.frame.imageUrl} alt="Frame" loading="lazy" />
    )}

    {/* Gambar tetap di dalam wrapper */}
    <FrameWrapper>
      <GalleryImage
        src={galleryItem.imageUrl || "/placeholder.svg"}
        alt={galleryItem.title}
        onClick={handleImageClick}
        loading="lazy" className="gallery-image"
      />
    </FrameWrapper>
  </FrameContainer>
)

}

export default GalleryFrame
