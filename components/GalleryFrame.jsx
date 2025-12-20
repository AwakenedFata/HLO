"use client";
import styled from "styled-components";
import { memo } from "react";

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

const GalleryImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: transform 0.3s ease;
  display: block;
  border-radius: 50px;
  position: relative;
  z-index: 1;
  will-change: transform;

  &:hover {
    transform: scale(1.05);
    cursor: pointer;
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
  will-change: transform;

  ${FrameContainer}:hover & {
    transform: scale(1.05);
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
        <FrameOverlay
          src={galleryItem.frame.imageUrl}
          alt="Frame"
          loading="lazy"
          decoding="async"
        />
      )}

      <FrameWrapper>
        <GalleryImage
          src={galleryItem.imageUrl || "/placeholder.svg"}
          alt={galleryItem.title}
          onClick={handleImageClick}
          loading="eager"
          decoding="async"
          className="gallery-image"
        />
      </FrameWrapper>
    </FrameContainer>
  );
});

GalleryFrame.displayName = "GalleryFrame";

export default GalleryFrame;
