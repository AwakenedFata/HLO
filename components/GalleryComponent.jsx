"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "react-bootstrap";
import GalleryFrame from "@/components/GalleryFrame";
import styled from "styled-components";
import { useRouter } from "next/navigation";

// Styled components based on main.css
const GallerySection = styled.div`
  position: relative;
  padding: 20px 0;
  overflow-x: hidden;
  overflow-y: hidden;
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
`;

const GalleryBgContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const GalleryBg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

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
`;

const GalleryCarouselContainer = styled.div`
  padding: 0 0 20px;
  position: relative;
  overflow-x: hidden;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
  color: white;
  font-size: 1.2rem;
`;

const ErrorContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
  color: #ff6b6b;
  font-size: 1.2rem;
  text-align: center;
`;

function GalleryComponent() {
  const swiperElRef = useRef(null);
  const [screenSize, setScreenSize] = useState("desktop"); // desktop | tablet | mobile
  const [swiperInitialized, setSwiperInitialized] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [galleryData, setGalleryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  // Mark component as mounted (client-side)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch gallery data from database
  useEffect(() => {
    if (!mounted) return;

    const fetchGalleryData = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/seksi-galeri");
        const result = await response.json();

        if (result.success) {
          setGalleryData(result.data);
        } else {
          setError("Failed to load gallery data");
        }
      } catch (err) {
        console.error("[v0] Error fetching gallery data:", err);
        setError("Failed to load gallery data");
      } finally {
        setLoading(false);
      }
    };

    fetchGalleryData();
  }, [mounted]);

  // Initialize Swiper
  useEffect(() => {
    if (!mounted || swiperInitialized) return;

    const initSwiper = async () => {
      const { register } = await import("swiper/element/bundle");
      register();
      setSwiperInitialized(true);
    };

    initSwiper();
  }, [mounted, swiperInitialized]);

  useEffect(() => {
    if (!mounted) return;

    const checkScreenSize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize("mobile");
      } else if (width >= 768 && width <= 992) {
        setScreenSize("tablet");
      } else {
        setScreenSize("desktop");
      }
    };

    // Set initial screen size
    checkScreenSize();

    window.addEventListener("resize", checkScreenSize);

    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (!metaViewport) {
      const meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content =
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
      document.head.appendChild(meta);
    }

    return () => window.removeEventListener("resize", checkScreenSize);
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !swiperInitialized || !galleryData.length) return;

    const swiperEl = swiperElRef.current;
    if (!swiperEl) return;

    let slidesPerView,
      spaceBetween,
      coverflowStretch,
      coverflowDepth,
      coverflowModifier;
    let initialSlide = 1;

    if (screenSize === "mobile") {
      // Mobile: 1 slide only
      slidesPerView = 1;
      spaceBetween = 0;
      coverflowStretch = 0;
      coverflowDepth = 20;
      coverflowModifier = 1;
      initialSlide = 0;
    } else if (screenSize === "tablet") {
      // Tablet (768px - 992px): 3 slides, closer spacing, spread out coverflow
      slidesPerView = 3;
      spaceBetween = 10; // closer than desktop
      coverflowStretch = -20; // less stretch than desktop
      coverflowDepth = 80;
      coverflowModifier = 1.8;
    } else {
      // Desktop: Original 3 slides
      slidesPerView = 3;
      spaceBetween = -21;
      coverflowStretch = -51;
      coverflowDepth = 100;
      coverflowModifier = 2;
    }

    const params = {
      slidesPerView: slidesPerView,
      grabCursor: true,
      spaceBetween: spaceBetween,
      centeredSlides: true,
      initialSlide: initialSlide,
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
      loop: screenSize === "mobile" ? false : false,
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

        /* Desktop: 3 slides with coverflow effect */
        @media (min-width: 993px) {
          .swiper-slide {
            padding: 40px 40px 80px;
          }
        }

        /* Tablet (768px - 992px): 3 slides, closer spacing */
        @media (max-width: 992px) and (min-width: 768px) {
          .swiper-slide {
            padding: 30px 20px 70px;
          }
          .swiper-slide:not(.swiper-slide-active) {
            transform: scale(0.8);
          }
        }

        /* Mobile: 1 slide only */
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
      on: {
        slideChange: (swiper) => {
          console.log("[v0] Current slide:", swiper.realIndex);
        },
      },
    };

    Object.assign(swiperEl, params);
    swiperEl.initialize();

    // Hide extra bullets (max 3)
    const timeoutId = setTimeout(() => {
      const bullets = document.querySelectorAll(".swiper-pagination-bullet");
      bullets.forEach((bullet, i) => {
        if (i >= 3) bullet.style.display = "none";
      });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [screenSize, swiperInitialized, mounted, galleryData]);

  const handleImageClick = async (galleryItem) => {
    try {
      console.log("[v0] Gallery item clicked:", galleryItem.title);
      const res = await fetch(
        `/api/artikel-public/by-gallery/${galleryItem._id}`
      );
      const data = await res.json();

      if (data?.success && data?.article?.slug) {
        // arahkan langsung ke artikel terkait
        router.push(`/article/${data.article.slug}`);
      } else {
        // fallback bila artikel belum tersedia
        console.warn("[v0] Artikel belum tersedia untuk galeri ini");
        router.push("/gallery");
      }
    } catch (e) {
      console.error("[v0] Error fetching related article:", e);
      // fallback pada error
      router.push("/gallery");
    }
  };

  // Show static content during SSR and initial hydration
  if (!mounted) {
    return (
      <GallerySection>
        <GalleryBgContainer>
          <GalleryBg src="/assets/Gallery/Background.png" alt="Background" />
        </GalleryBgContainer>
        <Container>
          <GalleryTitle data-aos="fade-down" data-aos-duration="1000">
            <h2>Gallery</h2>
            <h1>HOK Lampung Community</h1>
          </GalleryTitle>
          <LoadingContainer>Loading gallery...</LoadingContainer>
        </Container>
      </GallerySection>
    );
  }

  if (loading) {
    return (
      <GallerySection>
        <GalleryBgContainer>
          <GalleryBg src="/assets/Gallery/Background.png" alt="Background" />
        </GalleryBgContainer>
        <Container>
          <GalleryTitle data-aos="fade-down" data-aos-duration="1000">
            <h2>Gallery</h2>
            <h1>HOK Lampung Community</h1>
          </GalleryTitle>
          <LoadingContainer>Loading gallery...</LoadingContainer>
        </Container>
      </GallerySection>
    );
  }

  if (error) {
    return (
      <GallerySection>
        <GalleryBgContainer>
          <GalleryBg src="/assets/Gallery/Background.png" alt="Background" />
        </GalleryBgContainer>
        <Container>
          <GalleryTitle data-aos="fade-down" data-aos-duration="1000">
            <h2>Gallery</h2>
            <h1>HOK Lampung Community</h1>
          </GalleryTitle>
          <ErrorContainer>{error}</ErrorContainer>
        </Container>
      </GallerySection>
    );
  }

  return (
    <GallerySection>
      {/* Background */}
      <GalleryBgContainer>
        <GalleryBg src="/assets/Gallery/Background.png" alt="Background" />
      </GalleryBgContainer>

      <Container>
        {/* Title */}
        <GalleryTitle data-aos="fade-down" data-aos-duration="1000">
          <h2>Gallery</h2>
          <h1>HOK Lampung Community</h1>
        </GalleryTitle>

        {/* Gallery Swiper */}
        <GalleryCarouselContainer data-aos="zoom-in" data-aos-duration="1000">
          {swiperInitialized && galleryData.length > 0 && (
            <swiper-container ref={swiperElRef} init="false">
              {galleryData.slice(0, 3).map((item, index) => (
                <swiper-slide key={item._id || index}>
                  <GalleryFrame
                    galleryItem={item}
                    onImageClick={handleImageClick}
                  />
                </swiper-slide>
              ))}
            </swiper-container>
          )}
          <div className="swiper-pagination"></div>
        </GalleryCarouselContainer>
      </Container>
    </GallerySection>
  );
}

export default GalleryComponent;
