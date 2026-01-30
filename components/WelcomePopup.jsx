"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import "@/styles/WelcomePopup.css";

const WelcomePopup = () => {
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);
  const overlayRef = useRef(null);
  const popupRef = useRef(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Cek apakah ini dipanggil dari parent dengan shouldShow prop
    // Jika parent menentukan popup harus muncul, maka tampilkan
    const timer = setTimeout(() => {
      setShow(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    if (show) {
      document.body.style.overflow = "hidden";

      const handleScroll = (e) => {
        e.stopPropagation();
      };

      const overlay = overlayRef.current;
      if (overlay) {
        overlay.addEventListener("wheel", handleScroll, { passive: false });
      }

      return () => {
        if (overlay) {
          overlay.removeEventListener("wheel", handleScroll);
        }
      };
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      if (isClient) {
        document.body.style.overflow = "auto";
      }
    };
  }, [show, isClient]);

  const closePopup = () => {
    // Aktifkan animasi closing
    setClosing(true);

    // Tandai bahwa popup sudah ditutup dalam sesi ini (bukan refresh)
    sessionStorage.setItem("welcomePopupShown", "true");

    // Tunggu animasi selesai baru benar-benar menutup popup
    setTimeout(() => {
      setShow(false);
      setClosing(false);
    }, 500);
  };

  const handleOverlayClick = (e) => {
    // Tutup popup saat mengklik area overlay (luar popup)
    if (
      !popupRef.current?.contains(e.target) ||
      e.target.classList.contains("popup-overlay")
    ) {
      closePopup();
    }
  };

  if (!isClient) return null;
  if (!show && !closing) return null;

  return (
    <div
      className={`popup-overlay ${closing ? "closing" : ""}`}
      onClick={handleOverlayClick}
      ref={overlayRef}
    >
      <div className="popup-wrapper">
        <div
          className={`popup-container ${closing ? "closing" : ""}`}
          ref={popupRef}
        >
          <button
            className="popup-close"
            onClick={closePopup}
            aria-label="Close"
          >
            <span className="close-icon">×</span>
          </button>
          <div className="popup-content">
            <a
              href="https://chat.whatsapp.com/CDyNXvgyxwMG0c7idouoQR"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/assets/join-follow-popup.avif"
                alt="join-and-follow"
                width={400}
                height={400}
                className="popup-image"
                style={{ width: "100%", height: "auto" }}
                priority
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePopup;
