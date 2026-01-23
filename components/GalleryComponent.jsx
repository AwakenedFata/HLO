"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { Container } from "react-bootstrap"
import GalleryFrame from "@/components/GalleryFrame"
import styled from "styled-components"
import { useRouter } from "next/navigation"
import { useGallery } from "@/hooks/useGallery"
import Image from "next/image"

// Styled components
const GallerySection = styled.div`
  position: relative;
  padding: 20px 0;
  overflow-x: hidden;
  overflow-y: hidden;
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;

  @media (max-width: 1024px) and (min-width: 768px) {
    min-height: 50vh;
    padding: 0;
  }
`

const GalleryBgContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;

  img {
    object-fit: cover;
  }
`

const GalleryTitle = styled.div`
  font-family: "Gilroy", sans-serif;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3),
    -1px -1px 2px rgba(255, 255, 255, 0.1), 0 2px 4px rgba(0, 0, 0, 0.2);
  padding-top: 60px;
  color: white;
  text-align: center;
  margin-bottom: 2rem;

  h2 {
    font-size: 3rem;
    font-weight: 700;
    margin-bottom: 0;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 600;
    margin-bottom: 15px;
  }

  @media (max-width: 1024px) {
    padding-top: 0px;
    h2 {
      font-size: 2rem;
    }
    h1 {
      font-size: 1.8rem;
    }
  }
`

const GalleryCarouselContainer = styled.div`
  padding: 0 0 20px;
  position: relative;
  overflow-x: hidden;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
  color: white;
  font-size: 1.2rem;
`

const ErrorContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
  color: #ff6b6b;
  font-size: 1.2rem;
  text-align: center;
`

function GalleryComponent() {
  const swiperElRef = useRef(null)
  const [screenSize, setScreenSize] = useState("desktop")
  const [swiperInitialized, setSwiperInitialized] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  const { galleryData, loading, error } = useGallery()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || swiperInitialized) return

    const initSwiper = async () => {
      try {
        const { register } = await import("swiper/element/bundle")
        register()
        setSwiperInitialized(true)
      } catch (err) {
        console.error("Swiper init error:", err)
      }
    }

    initSwiper()
  }, [mounted, swiperInitialized])

  const handleImageClick = useCallback(
    async (galleryItem) => {
      try {
        const res = await fetch(`/api/artikel-public/by-gallery/${galleryItem._id}`)
        const data = await res.json()

        if (data?.success && data?.article?.slug) {
          router.push(`/article/${data.article.slug}`)
        } else {
          router.push("/gallery")
        }
      } catch (e) {
        console.error("Error fetching article:", e)
        router.push("/gallery")
      }
    },
    [router],
  )

  useEffect(() => {
    if (!mounted) return

    const checkScreenSize = () => {
      const width = window.innerWidth
      if (width < 768) {
        setScreenSize("mobile")
      } else if (width >= 768 && width <= 992) {
        setScreenSize("tablet")
      } else {
        setScreenSize("desktop")
      }
    }

    checkScreenSize()

    let resizeTimeout
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(checkScreenSize, 150)
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [mounted])

  const swiperParams = useMemo(() => {
    let slidesPerView, spaceBetween, coverflowStretch, coverflowDepth, coverflowModifier
    let initialSlide = 1

    if (screenSize === "mobile") {
      slidesPerView = 1
      spaceBetween = 0
      coverflowStretch = 0
      coverflowDepth = 20
      coverflowModifier = 1
      initialSlide = 0
    } else if (screenSize === "tablet") {
      slidesPerView = 3
      spaceBetween = 10
      coverflowStretch = -20
      coverflowDepth = 80
      coverflowModifier = 1.8
    } else {
      slidesPerView = 3
      spaceBetween = -21
      coverflowStretch = -51
      coverflowDepth = 100
      coverflowModifier = 2
    }

    return {
      slidesPerView,
      grabCursor: true,
      spaceBetween,
      centeredSlides: true,
      initialSlide,
      effect: "coverflow",
      coverflowEffect: {
        rotate: 0,
        stretch: coverflowStretch,
        depth: coverflowDepth,
        modifier: coverflowModifier,
        slideShadows: false,
      },
      autoplay: {
        delay: 3500,
        disableOnInteraction: false,
      },
      pagination: {
        el: ".swiper-pagination",
        clickable: true,
      },
      loop: false,
      injectStyles: [
        `
        .swiper-pagination {
          bottom: 10px;
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          z-index: 10;
          margin-top: 10px;
        }
        .swiper-pagination-bullet {
          width: 12px;
          height: 12px;
          background: white;
          opacity: 0.6;
          margin: 0 5px;
          border-radius: 50%;
          transition: all 0.3s ease;
        }
        .swiper-pagination-bullet-active {
          opacity: 1;
          background: white;
          transform: scale(1.2);
        }
        .swiper-wrapper {
          overflow: visible;
        }
        .swiper-slide {
          display: flex;
          justify-content: center;
          transition: all 0.3s ease;
          padding: 40px 40px 80px;
        }
        .swiper-slide:not(.swiper-slide-active) {
          transform: scale(0.85);
          opacity: 0.7;
          z-index: 0;
        }
        .swiper-slide.swiper-slide-active {
          z-index: 1;
        }

        @media (min-width: 993px) {
          .swiper-slide {
            padding: 40px 40px 80px;
          }
        }

        @media (max-width: 992px) and (min-width: 768px) {
          .swiper-slide {
            padding: 0px 20px 30px;
          }
          .swiper-slide:not(.swiper-slide-active) {
            transform: scale(0.8);
          }
        }

        @media (max-width: 767px) {
          .swiper-slide {
            padding: 20px 10px 50px;
            transform: scale(1) !important;
            opacity: 1 !important;
          }
          .swiper-slide:not(.swiper-slide-active) {
            display: none;
          }
        }
        `,
      ],
    }
  }, [screenSize])

  useEffect(() => {
    if (!mounted || !swiperInitialized || !galleryData.length) return

    const swiperEl = swiperElRef.current
    if (!swiperEl) return

    Object.assign(swiperEl, swiperParams)
    swiperEl.initialize()

    const timeoutId = setTimeout(() => {
      const bullets = document.querySelectorAll(".swiper-pagination-bullet")
      bullets.forEach((bullet, i) => {
        if (i >= 3) bullet.style.display = "none"
      })
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [swiperParams, swiperInitialized, mounted, galleryData.length])

  if (!mounted) {
    return (
      <GallerySection>
        <GalleryBgContainer>
          <Image src="/assets/Gallery/bg.avif" alt="Background" fill sizes="100vw" priority />
        </GalleryBgContainer>
        <Container>
          <GalleryTitle data-aos="fade-down" data-aos-duration="600" data-aos-offset="0">
            <h2>Gallery</h2>
            <h1>HOK Lampung Community</h1>
          </GalleryTitle>
          <LoadingContainer>Loading gallery...</LoadingContainer>
        </Container>
      </GallerySection>
    )
  }

  if (loading) {
    return (
      <GallerySection>
        <GalleryBgContainer>
          <Image src="/assets/Gallery/bg.avif" alt="Background" fill sizes="100vw" priority />
        </GalleryBgContainer>
        <Container>
          <GalleryTitle data-aos="fade-down" data-aos-duration="600" data-aos-offset="0">
            <h2>Gallery</h2>
            <h1>HOK Lampung Community</h1>
          </GalleryTitle>
          <LoadingContainer>Loading gallery...</LoadingContainer>
        </Container>
      </GallerySection>
    )
  }

  if (error) {
    return (
      <GallerySection>
        <GalleryBgContainer>
          <Image src="/assets/Gallery/bg.avif" alt="Background" fill sizes="100vw" priority />
        </GalleryBgContainer>
        <Container>
          <GalleryTitle data-aos="fade-down" data-aos-duration="600" data-aos-offset="0">
            <h2>Gallery</h2>
            <h1>HOK Lampung Community</h1>
          </GalleryTitle>
          <ErrorContainer>{error}</ErrorContainer>
        </Container>
      </GallerySection>
    )
  }

  return (
    <GallerySection>
      <GalleryBgContainer>
        <Image src="/assets/Gallery/bg.avif" alt="Background" fill sizes="100vw" priority />
      </GalleryBgContainer>

      <Container>
        <GalleryTitle data-aos="fade-down" data-aos-duration="600" data-aos-offset="0">
          <h2>Gallery</h2>
          <h1>HOK Lampung Community</h1>
        </GalleryTitle>

        <GalleryCarouselContainer data-aos="zoom-in" data-aos-duration="600" data-aos-offset="0">
          {swiperInitialized && galleryData.length > 0 && (
            <swiper-container ref={swiperElRef} init="false">
              {galleryData.slice(0, 3).map((item, index) => (
                <swiper-slide key={item._id || index}>
                  <GalleryFrame galleryItem={item} onImageClick={handleImageClick} />
                </swiper-slide>
              ))}
            </swiper-container>
          )}
          <div className="swiper-pagination"></div>
        </GalleryCarouselContainer>
      </Container>
    </GallerySection>
  )
}

export default GalleryComponent
