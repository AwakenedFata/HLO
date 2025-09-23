"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "react-bootstrap";
import { galleryItems } from "@/data/index.js";

// Register Swiper web components once
function GalleryComponent() {
  const swiperElRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [swiperInitialized, setSwiperInitialized] = useState(false);
  // Tambahkan state untuk menandai client-side rendering
  const [isClient, setIsClient] = useState(false);

  // Tandai bahwa kita sudah di client-side
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const initSwiper = async () => {
      if (!isClient || swiperInitialized) return;
      const { register } = await import("swiper/element/bundle");
      register();
      setSwiperInitialized(true);
    };

    initSwiper();
  }, [swiperInitialized, isClient]); // ✅ tetap statis

  // Deteksi mobile dan setup Swiper hanya di client-side
  useEffect(() => {
    if (!isClient) return;

    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 480);
    };

    // Attach resize listener
    window.addEventListener("resize", checkMobile);
    checkMobile();

    // Ensure viewport meta exists
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (!metaViewport) {
      const meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content =
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
      document.head.appendChild(meta);
    }

    return () => window.removeEventListener("resize", checkMobile);
  }, [isClient]);

  // Setup Swiper hanya setelah client-side rendering dan Swiper diinisialisasi
  useEffect(() => {
    if (!isClient || !swiperInitialized) return;

    const swiperEl = swiperElRef.current;
    if (!swiperEl) return;

    const params = {
      slidesPerView: isMobile ? 1 : 3,
      grabCursor: true,
      spaceBetween: isMobile ? 0 : -10,
      centeredSlides: true,
      initialSlide: 1,
      effect: "coverflow",
      coverflowEffect: {
        rotate: 0,
        stretch: isMobile ? 0 : -41,
        depth: isMobile ? 50 : 100,
        modifier: isMobile ? 1.5 : 2,
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
          bottom: 10px !important;
          position: relative;
        }
        .swiper-pagination-bullet {
          width: 12px;
          height: 12px;
          background: white;
          opacity: 0.6;
          margin: 0 5px;
        }
        .swiper-pagination-bullet-active {
          opacity: 1;
          background: white;
        }
        .swiper-wrapper {
          overflow: visible;
        }
      `,
      ],
      on: {
        slideChange: (swiper) => {
          console.log(swiper.realIndex);
        },
      },
    };

    Object.assign(swiperEl, params);
    swiperEl.initialize();

    // Optional: hide extra bullets after init (max 3)
    setTimeout(() => {
      const bullets = document.querySelectorAll(".swiper-pagination-bullet");
      bullets.forEach((bullet, i) => {
        if (i >= 3) bullet.style.display = "none";
      });
    }, 100);
  }, [isMobile, swiperInitialized, isClient]);

  const handleTouchStart = (e) => {
    e.currentTarget.style.transform = "scale(1.05)";
  };

  const handleTouchEnd = (e) => {
    e.currentTarget.style.transform = "scale(1)";
  };

  const handleMouseEnter = (e) => {
    if (!isMobile) e.currentTarget.style.transform = "scale(1.05)";
  };

  const handleMouseLeave = (e) => {
    if (!isMobile) e.currentTarget.style.transform = "scale(1)";
  };

  return (
    <div className="gallery-section w-100 min-vh-100 d-flex align-items-center position-relative overflow-container">
      {/* Background */}
      <div className="gallery-bg-container">
        <img
          src="/assets/Gallery/Background.png"
          alt="Background"
          className="gallery-bg"
        />
      </div>

      <Container>
        {/* Title */}
        <div
          className="gallery-title text-center mb-4 mb-md-5"
          data-aos="fade-down"
          data-aos-duration="1000"
        >
          <h2>Gallery</h2>
          <h1>HOK Lampung Community</h1>
          <div className="title-underline"></div>
        </div>

        {/* Gallery Swiper */}
        <div
          className="gallery-carousel-container"
          data-aos="zoom-in"
          data-aos-duration="1000"
        >
          {swiperInitialized && (
            <swiper-container ref={swiperElRef} init="false">
              {galleryItems.map((item, index) => (
                <swiper-slide key={index}>
                  <div className="gallery-item">
                    <div
                      className="gallery-image-wrapper"
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={handleTouchEnd}
                    >
                      <img
                        src={item.image || "/placeholder.svg"}
                        alt={`Gallery ${index + 1}`}
                        className="gallery-image"
                      />
                    </div>
                  </div>
                </swiper-slide>
              ))}
            </swiper-container>
          )}
          <div className="swiper-pagination"></div>
        </div>
      </Container>
    </div>
  );
}

export default GalleryComponent;