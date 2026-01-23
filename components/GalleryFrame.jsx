"use client";
import styled from "styled-components";
import { memo } from "react";
import Image from "next/image";

// Helper to check if image is from external source (R2 storage)
const isExternalImage = (url) => {
  if (!url) return false;
  return url.includes("r2.dev") || url.startsWith("http");
};

const FrameContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 350px;
  aspect-ratio: 3/4;
  display: flex;
  justify-content: center;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  border-radius: 42px;
  margin: 0 auto;
`;

const FrameWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const GalleryImageWrapper = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 50px;
  overflow: hidden;
  z-index: 1;
  transition: transform 0.3s ease;
  will-change: transform;

  &:hover {
    transform: scale(1.05);
    cursor: pointer;
  }

  img {
    object-fit: cover;
    object-position: center;
  }

  @media (max-width: 992px) {
    border-radius: 28px !important;
  }

  @media (max-width: 575px) {
    border-radius: 45px !important;
  }

  @media (max-width: 480px) {
    border-radius: 48px !important;
  }

  @media (max-width: 380px) {
    border-radius: 45px !important;
  }
`;

const FrameOverlayWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
  transition: transform 0.3s ease;
  will-change: transform;

  ${FrameContainer}:hover & {
    transform: scale(1.05);
  }

  img {
    object-position: center;
  }
`;

const GalleryFrame = memo(({ galleryItem, onImageClick }) => {
  const handleImageClick = () => {
    if (onImageClick) {
      onImageClick(galleryItem);
    }
  };

  return (
    <FrameContainer className="frame-container">
      {galleryItem.frame && (
        <FrameOverlayWrapper>
          <Image
            src={galleryItem.frame.imageUrl}
            alt="Frame"
            fill
            sizes="350px"
            unoptimized={isExternalImage(galleryItem.frame.imageUrl)}
          />
        </FrameOverlayWrapper>
      )}

      <FrameWrapper>
        <GalleryImageWrapper onClick={handleImageClick} className="gallery-image">
          <Image
            src={galleryItem.imageUrl || "/placeholder.svg"}
            alt={galleryItem.title}
            fill
            sizes="350px"
            priority
            unoptimized={isExternalImage(galleryItem.imageUrl)}
          />
        </GalleryImageWrapper>
      </FrameWrapper>
    </FrameContainer>
  );
});

GalleryFrame.displayName = "GalleryFrame";

export default GalleryFrame;
