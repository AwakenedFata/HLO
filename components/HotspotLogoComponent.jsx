"use client"

import { useState } from "react"
import { Plus } from 'lucide-react'
import Image from "next/image"

export default function HotspotLogoComponent() {
  const [activeHotspot, setActiveHotspot] = useState(null)

  const hotspots = [
    { id: 1, x: 35, y: 14.7, title: "Lingkaran HOK", description: "Sebagai logo utama dari honor of kings", direction: "top" },
    { id: 2, x: 63, y: 42, title: "HOK", description: "Singkatan Honor of Kings", direction: "top" },
    { id: 3, x: 45, y: 68, title: "Mahkota", description: "Sebagai simbol secara elemental", direction: "bottom" },
    { id: 4, x: 50, y: 56, title: "Siger", description: "Karena berasal dari Lampung, sebagai ikonik bangunan", direction: "top" },
    { id: 5, x: 84.7, y: 65, title: "Warna Orange", description: "Melambangkan Kehangatan, dan kemenangan yang gemilang", direction: "bottom" },
  ]

  const handleHotspotClick = (hotspot, e) => {
    e.stopPropagation()
    setActiveHotspot(activeHotspot === hotspot.id ? null : hotspot.id)
  }

  const closePopup = () => setActiveHotspot(null)

  return (
    <>
      <div
        onClick={closePopup}
        style={{
          flex: "0 0 auto",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%", // Ensure container takes full width
          maxWidth: "400px", // Cap width
        }}
      >
        <div
          className="hotspot-logo-container" 
          style={{
            position: "relative",
            width: "100%", // Fluid width
            aspectRatio: "1/1", // Maintain square aspect ratio
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            src="/assets/aboutus/logo1.avif"
            alt="HOK Logo"
            fill
            style={{ objectFit: "contain" }}
            priority
          />

          {/* Hotspot Container */}
          <div style={{ position: "absolute", inset: 0 }}>
            {hotspots.map((hotspot) => (
              <div key={hotspot.id}>
                
                {/* Hotspot Button */}
                <div
                  onClick={(e) => handleHotspotClick(hotspot, e)}
                  className="hotspot-button"
                  style={{
                    position: "absolute",
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: "33px",
                    height: "33px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    backgroundColor: "rgba(0,0,0,0.5)",
                    border: "7px solid rgba(100,100,100,0.01)",
                  }}
                >
                  <Plus size={12} color="white" strokeWidth={5} className="plus-icon" />
                </div>

                {/* Popup */}
                {activeHotspot === hotspot.id && (
                  <div
                    className="hotspot-popup"
                    style={{
                      position: "absolute",
                      left: `${hotspot.x}%`,
                      top:
                        hotspot.direction === "top"
                          ? `calc(${hotspot.y}% - 28px)`
                          : `calc(${hotspot.y}% + 28px)`,

                      transform:
                        hotspot.direction === "top"
                          ? "translate(-50%, -100%)"
                          : "translate(-50%, 0%)",

                      background: "#ebe9e9ff",
                      padding: "4px 10px 8px",
                      borderRadius: "8px",
                      width: "240px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                      zIndex: 10005,
                    }}
                  >
                    {/* Tail */}
                    {hotspot.direction === "top" ? (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "-10px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          borderLeft: "10px solid transparent",
                          borderRight: "10px solid transparent",
                          borderTop: "10px solid #edededff",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          position: "absolute",
                          top: "-10px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          borderLeft: "10px solid transparent",
                          borderRight: "10px solid transparent",
                          borderBottom: "10px solid #edededff",
                        }}
                      />
                    )}

                    {/* Title */}
                    <div
                      className="popup-title"
                      style={{
                        fontFamily: "Gilroy-Bold",
                        fontSize: "14px",
                        color: "#949494",
                        marginBottom: "6px",
                        paddingBottom: "6px",
                        borderBottom: "1.5px solid #949494",
                        textAlign: "center",
                      }}
                    >
                      {hotspot.title}
                    </div>

                    {/* Description */}
                    <div
                      className="popup-description"
                      style={{
                        fontFamily: "Gilroy-Medium",
                        fontSize: "12px",
                        color: "#949494",
                        lineHeight: "1.4",
                        textAlign: "center",
                      }}
                    >
                      {hotspot.description}
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Responsive custom */
        
        /* Renamed from .logo-container to avoid conflict */
        .hotspot-logo-container {
             /* Width is handled inline now for fluidity */
        }

        /* Responsive untuk layar dibawah 480px */
        @media (max-width: 480px) {
          /* 
          We use specificity or just let fluid width handle it. 
          But if we want to enforce smaller max-width:
          */
          .hotspot-logo-container {
             /* width: 350px !important;  <- removed fixed width, relying on fluid parent/max-width */
          }

          .hotspot-button {
            width: 24px !important;
            height: 24px !important;
            border: 5px solid rgba(100,100,100,0.01) !important;
          }

          .plus-icon {
            width: 10px !important;
            height: 10px !important;
          }

          .hotspot-popup {
            width: 180px !important;
            padding: 3px 8px 6px !important;
            border-radius: 6px !important;
          }

          .popup-title {
            font-size: 11px !important;
            margin-bottom: 4px !important;
            padding-bottom: 4px !important;
          }

          .popup-description {
            font-size: 9px !important;
            line-height: 1.3 !important;
          }
        }
        /* Responsive untuk layar dibawah 420px */
        @media (max-width: 420px) {
           /* ... */
          .hotspot-button {
            width: 24px !important;
            height: 24px !important;
            border: 5px solid rgba(100,100,100,0.01) !important;
          }

          .plus-icon {
            width: 10px !important;
            height: 10px !important;
          }

          .hotspot-popup {
            width: 180px !important;
            padding: 3px 8px 6px !important;
            border-radius: 6px !important;
          }

          .popup-title {
            font-size: 11px !important;
            margin-bottom: 4px !important;
            padding-bottom: 4px !important;
          }

          .popup-description {
            font-size: 9px !important;
            line-height: 1.3 !important;
          }
        }

        /* Extra responsive untuk layar sangat kecil dibawah 360px */
        @media (max-width: 360px) {
          .hotspot-button {
            width: 22px !important;
            height: 22px !important;
          }

          .plus-icon {
            width: 9px !important;
            height: 9px !important;
          }

          .hotspot-popup {
            width: 160px !important;
          }

          .popup-title {
            font-size: 10px !important;
            }

          .popup-description {
            font-size: 8px !important;
          }
        }
      `}</style>
    </>
  )
}