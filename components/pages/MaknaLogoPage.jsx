"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { createGlobalStyle } from "styled-components"

const GlobalStyle = createGlobalStyle`
  @font-face {
    font-family: 'Gilroy-Bold';
    src: url('/fonts/Gilroy-Bold.ttf') format('truetype');
    font-weight: bold;
    font-style: normal;
  }

  @font-face {
    font-family: 'Gilroy-Medium';
    src: url('/fonts/Gilroy-Medium.ttf') format('truetype');
    font-weight: 500;
    font-style: normal;
  }

  @font-face {
    font-family: 'Calibri-Bold';
    src: url('/fonts/Calibri-Bold.ttf') format('truetype');
    font-weight: bold;
    font-style: normal;
  }

  @font-face {
    font-family: 'Calibri-Regular';
    src: url('/fonts/Calibri-Regular.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
  }
`

export default function MaknaLogoPage() {
  const [isHovering, setIsHovering] = useState(false)
  const [activeHotspot, setActiveHotspot] = useState(null)
  const [popupPosition, setPopupPosition] = useState(null)

  const hotspots = [
    {
      id: 1,
      x: 35,
      y: 14.7,
      title: "Lingkaran HOK",
      description: "Sebagai logo utama dari honor of kings",
    },
    {
      id: 2,
      x: 63,
      y: 42,
      title: "HOK",
      description: "Singkatan Honor of Kings",
    },
    {
      id: 3,
      x: 45,
      y: 68,
      title: "Mahkota",
      description: "Sebagai simbol secara elemental",
    },
    {
      id: 4,
      x: 50,
      y: 56,
      title: "Siger",
      description: "Karena berasal dari Lampung, sebagai ikonik bangunan",
    },
    {
      id: 5,
      x: 84.7,
      y: 65,
      title: "Warna Orange",
      description: "Melambangkan Kehangatan, dan kemenangan yang gemilang",
    },
  ]

  const handleHotspotClick = (hotspot, event) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    setPopupPosition({
      top: rect.top,
      left: rect.left + rect.width / 2,
    })
    setActiveHotspot(hotspot.id)
  }

  const handleContainerClick = () => {
    setActiveHotspot(null)
  }

  return (
    <>
      <GlobalStyle />
      <div
        onClick={handleContainerClick}
        style={{
          display: "flex",
          backgroundColor: "#ffffff",
          padding: "60px",
          gap: "80px",
          minHeight: "100vh",
        }}
      >
        {/* Left Section */}
        <div
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{
            flex: "0 0 auto",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0",
          }}
        >
          {/* Logo Container */}
          <div
            style={{
              position: "relative",
              width: "400px",
              height: "400px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/assets/aboutus/logo hok 1.png"
              alt="HOK Logo"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />

            {/* Hotspots Container */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
            >
              {hotspots.map((hotspot) => (
                <div key={hotspot.id}>
                  <div
                    onClick={(e) => handleHotspotClick(hotspot, e)}
                    style={{
                      position: "absolute",
                      left: `${hotspot.x}%`,
                      top: `${hotspot.y}%`,
                      transform: `translate(-50%, -50%) scale(${activeHotspot === hotspot.id ? 1.15 : 1})`,
                      width: "33px",
                      height: "33px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      backgroundColor: "rgba(0, 0, 0, 0.5)",
                      border: "7px solid rgba(100, 100, 100, 0.01)",
                      opacity: isHovering ? 1 : 0,
                      visibility: isHovering ? "visible" : "hidden",
                      boxShadow:
                        activeHotspot === hotspot.id ? "0 0 8px rgba(0, 0, 0, 0.45)" : "0 0 4px rgba(0, 0, 0, 0.25)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.35)"
                      e.currentTarget.style.borderColor = "rgba(35, 35, 35, 0.45)"
                      e.currentTarget.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.3)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.5)"
                      e.currentTarget.style.borderColor = "rgba(100, 100, 100, 0.01)"
                      e.currentTarget.style.boxShadow =
                        activeHotspot === hotspot.id ? "0 0 8px rgba(0, 0, 0, 0.45)" : "0 0 4px rgba(0, 0, 0, 0.25)"
                    }}
                  >
                    <Plus size={12} color="white" strokeWidth={5} />
                  </div>

                  {/* Popup Info Card */}
                  {activeHotspot === hotspot.id && popupPosition && (
                    <div
                      style={{
                        position: "fixed",
                        backgroundColor: "#f5f5f5",
                        padding: "16px 20px",
                        borderRadius: "8px",
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
                        zIndex: 100,
                        maxWidth: "300px",
                        top: `${popupPosition.top}px`,
                        left: `${popupPosition.left}px`,
                        transform: "translate(-50%, -100%)",
                        marginTop: "-10px",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Gilroy-Bold, sans-serif",
                          fontSize: "14px",
                          color: "#949494",
                          fontWeight: 600,
                          marginBottom: "6px",
                        }}
                      >
                        {hotspot.title}
                      </div>
                      <div
                        style={{
                          fontFamily: "Gilroy-Medium, sans-serif",
                          fontSize: "12px",
                          color: "#949494",
                          lineHeight: "1.5",
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

          {/* Bottom Info */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "10px",
              paddingTop: "0px",
              borderTop: "none",
              textAlign: "center",
              width: "100%",
            }}
          >
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  fontFamily: "Calibri-Bold, sans-serif",
                  fontSize: "17px",
                  color: "#949494",
                  fontWeight: 600,
                  marginBottom: "8px",
                  margin: 0,
                }}
              >
                Nama Logo
              </h3>
              <p
                style={{
                  fontFamily: "Calibri-Regular, sans-serif",
                  fontSize: "11px",
                  color: "#949494",
                  lineHeight: "1.2",
                  margin: 0,
                  marginTop: "2px",
                }}
              >
                HOK LAMPUNG
                <br />
                OFFICIAL
              </p>
            </div>

            <div style={{ flex: 1 }}>
              <h3
                style={{
                  fontFamily: "Calibri-Bold, sans-serif",
                  fontSize: "17px",
                  color: "#949494",
                  fontWeight: 600,
                  marginBottom: "8px",
                  margin: 0,
                }}
              >
                Slogan
              </h3>
              <p
                style={{
                  fontFamily: "Calibri-Regular, sans-serif",
                  fontSize: "11px",
                  color: "#949494",
                  lineHeight: "1.2",
                  margin: 0,
                  marginTop: "2px",
                }}
              >
                #OURALLCOMMUNITY
              </p>
            </div>

            <div style={{ flex: 1 }}>
              <h3
                style={{
                  fontFamily: "Calibri-Bold, sans-serif",
                  fontSize: "17px",
                  color: "#949494",
                  fontWeight: 600,
                  marginBottom: "8px",
                  margin: 0,
                }}
              >
                Warna
              </h3>
              <p
                style={{
                  fontFamily: "Calibri-Regular, sans-serif",
                  fontSize: "11px",
                  color: "#949494",
                  lineHeight: "1.2",
                  margin: 0,
                  marginTop: "2px",
                }}
              >
                HEX : #F5A81D
                <br />
                RGB : 245, 171, 29
                <br />
                CMYK : 0, 30, 88, 4
              </p>
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
          }}
        >


          <p
            style={{
              fontFamily: "Calibri-Regular, sans-serif",
              fontSize: "14px",
              color: "#949494",
              lineHeight: "1.8",
              textAlign: "justify",
              marginBottom: "10px",
              marginTop: 0,
              marginLeft: 0,
              marginRight: 0,
            }}
            >
            Logo Honor of Kings Lampung Official Community ini menggabungkan tiga elemen penting yang penuh makna.
            Di bagian atas terdapat Siger, lambang khas Provinsi Lampung yang melambangkan kehormatan, kebanggaan, dan
            identitas daerah. Kehadiran Siger menggambarkan bahwa komunitas ini lahir dari semangat masyarakat Lampung
            yang menjunjung tinggi nilai lokal namun tetap terbuka pada perkembangan global. Warna oranye keemasan yang
            digunakan juga mencerminkan semangat, keberanian, dan energi positif, sesuai dengan karakter para pemain
            yang kompetitif dan berjuwa juang tinggi.
          </p>

          <p
            style={{
              fontFamily: "Calibri-Regular, sans-serif",
              fontSize: "14px",
              color: "#949494",
              lineHeight: "1.8",
              textAlign: "justify",
              margin: 0,
            }}
          >
            Sementara itu, di bagian tengah terdapat huruf HOK yang menjadi identitas utama komunitas, mewakili semangat
            kebersamaan dan kekompakan untuk pemain Honor of Kings. Logo Honor of Kings Official di bagian bawah
            menandakan bahwa komunitas ini resmi dan diakui secara global, bukan sekadar perkumpulan biasa, melainkan
            bagian dari ekosistem esports yang besar dan profesional. Secara keseluruhan, logo ini mencerminkan
            kebanggaan daerah, semangat komunitas, dan pengakuan resmi - menunjukkan bahwa komunitas HOK Lampung berdiri
            dengan karakter kuat, bersatu, dan siap berkembang bersama dunia esports internasional.
          </p>
        </div>
      </div>
    </>
  )
}