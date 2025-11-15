"use client";

import { createGlobalStyle } from "styled-components";
import HotspotLogoComponent from "@/components/HotspotLogoComponent";

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

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
  }
`;

export default function MaknaLogoPage() {
  return (
    <>
      <GlobalStyle />
      <div
        style={{
          display: "flex",
          backgroundColor: "#ffffff",
          padding: "60px",
          gap: "80px",
          minHeight: "100vh",
          flexDirection: "row",
          alignItems: "center",
        }}
        className="main-container"
      >
        {/* Left Section */}
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0",
            minWidth: "320px",
          }}
          className="left-section"
        >
          <HotspotLogoComponent />

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
            className="info-container"
          >
            <div style={{ flex: 1, minWidth: "80px" }}>
              <h3
                style={{
                  fontFamily: "Calibri-Bold, sans-serif",
                  fontSize: "17px",
                  color: "#949494",
                  fontWeight: 600,
                  marginBottom: "8px",
                  margin: 0,
                }}
                className="info-title"
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
                className="info-text"
              >
                HOK LAMPUNG
                <br />
                OFFICIAL
              </p>
            </div>

            <div style={{ flex: 1, minWidth: "80px" }}>
              <h3
                style={{
                  fontFamily: "Calibri-Bold, sans-serif",
                  fontSize: "17px",
                  color: "#949494",
                  fontWeight: 600,
                  marginBottom: "8px",
                  margin: 0,
                }}
                className="info-title"
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
                className="info-text"
              >
                #OURALLCOMMUNITY
              </p>
            </div>

            <div style={{ flex: 1, minWidth: "80px" }}>
              <h3
                style={{
                  fontFamily: "Calibri-Bold, sans-serif",
                  fontSize: "17px",
                  color: "#949494",
                  fontWeight: 600,
                  marginBottom: "8px",
                  margin: 0,
                }}
                className="info-title"
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
                className="info-text"
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
            justifyContent: "center",
          }}
          className="right-section"
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
            className="description-text"
          >
            Logo Honor of Kings Lampung Official Community ini menggabungkan
            tiga elemen penting yang penuh makna. Di bagian atas terdapat Siger,
            lambang khas Provinsi Lampung yang melambangkan kehormatan,
            kebanggaan, dan identitas daerah. Kehadiran Siger menggambarkan
            bahwa komunitas ini lahir dari semangat masyarakat Lampung yang
            menjunjung tinggi nilai lokal namun tetap terbuka pada perkembangan
            global. Warna oranye keemasan yang digunakan juga mencerminkan
            semangat, keberanian, dan energi positif, sesuai dengan karakter
            para pemain yang kompetitif dan berjuwa juang tinggi.
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
            className="description-text"
          >
            Sementara itu, di bagian tengah terdapat huruf HOK yang menjadi
            identitas utama komunitas, mewakili semangat kebersamaan dan
            kekompakan untuk pemain Honor of Kings. Logo Honor of Kings Official
            di bagian bawah menandakan bahwa komunitas ini resmi dan diakui
            secara global, bukan sekadar perkumpulan biasa, melainkan bagian
            dari ekosistem esports yang besar dan profesional. Secara
            keseluruhan, logo ini mencerminkan kebanggaan daerah, semangat
            komunitas, dan pengakuan resmi - menunjukkan bahwa komunitas HOK
            Lampung berdiri dengan karakter kuat, bersatu, dan siap berkembang
            bersama dunia esports internasional.
          </p>
        </div>
      </div>

      <style jsx global>{`
        /* Large Desktop 1200px keatas */
        @media (min-width: 1200px) {
          .main-container {
            padding: 60px 80px !important;
            gap: 100px !important;
            align-items: center !important;
          }

          .left-section {
            min-width: 400px !important;
          }

          .right-section {
            max-width: 650px !important;
          }

          .description-text {
            font-size: 15px !important;
            line-height: 1.9 !important;
          }
        }

        /* Tablet such as iPad Pro*/
        @media (max-width: 1024px) and (max-height: 1366px) {
          .main-container {
            flex-direction: column !important;
            padding: 40px 30px !important;
            justify-content: flex-start !important;
            align-items: center !important;
            gap: 0px !important;
          }

          .left-section {
            width: 100% !important;
            max-width: 500px !important;
            margin-top: 100px !important;
          }

          .right-section {
            width: 100% !important;
            max-width: 700px !important;
            padding: 0 30px !important;
            margin-top: -100px !important;
          }

          .info-title {
            font-size: 16px !important;
          }

          .info-text {
            font-size: 11px !important;
          }

          .description-text {
            font-size: 14px !important;
            line-height: 1.8 !important;
          }
        }

        /* Tablet Such as Surface Pro 7 */
        @media (max-width: 992px) and (max-height: 1400px) {
          .main-container {
            flex-direction: column !important;
            padding: 30px 20px !important;
            align-items: center !important;
            justify-content: flex-start !important;
            gap: 10px !important;
          }

          .left-section {
            margin-top: 120px !important;
            margin-bottom: 0px;
          }

          .right-section {
            width: 100% !important;
            max-width: 600px !important;
            padding: 0 20px !important;
            margin-top: -120px;
          }
        }

        /* Tablet Portrait & Mobile Landscape - Layout Vertikal (for average) */
        @media (max-width: 768px) {
          .main-container {
            flex-direction: column !important;
            padding: 30px 20px !important;
            gap: 0px !important;
            align-items: center !important;
            justify-content: flex-start !important;
          }

          .left-section {
            width: 100% !important;
            min-width: unset !important;
            max-width: 450px !important;
            margin-bottom: 30px !important;
          }

          .right-section {
            width: 100% !important;
            max-width: 600px !important;
            padding: 0 20px !important;
          }

          .info-container {
            gap: 15px !important;
          }

          .info-title {
            font-size: 14px !important;
          }

          .info-text {
            font-size: 10px !important;
          }

          .description-text {
            font-size: 12px !important;
            line-height: 1.6 !important;
          }
        }

        @media (max-width: 578px) and (max-height: 768px) {
          .main-container {
            gap: 120px !important;
          }

          .left-section {
            margin-top: 20px !important;
          }
        }

        /* Mobile - 480px kebawah - Info tetap 3 kolom */
        @media (max-width: 480px) {
          .main-container {
            padding: 25px 15px !important;
            gap: 60px !important;
          }

          .left-section {
            max-width: 100% !important;
            margin-bottom: 25px !important;
            margin-top: 20px !important;
          }

          .right-section {
            padding: 0 10px !important;
          }

          .info-container {
            display: flex !important;
            flex-direction: row !important;
            gap: 8px !important;
            justify-content: space-between !important;
          }

          .info-container > div {
            flex: 1 !important;
            min-width: 80px !important;
          }

          .info-title {
            font-size: 12px !important;
            margin-bottom: 5px !important;
          }

          .info-text {
            font-size: 8px !important;
            line-height: 1.3 !important;
          }

          .description-text {
            font-size: 11px !important;
            line-height: 1.6 !important;
            text-align: justify !important;
          }
        }

        /* Extra  small mobile - 360px kebawah */
        @media (max-width: 360px) {
          .main-container {
            padding: 20px 12px !important;
            gap: 0px !important;
          }

          .info-container {
            gap: 6px !important;
          }

          .info-container > div {
            min-width: 70px !important;
          }

          .info-title {
            font-size: 11px !important;
            margin-bottom: 4px !important;
          }

          .info-text {
            font-size: 7px !important;
            line-height: 1.2 !important;
          }

          .description-text {
            font-size: 10px !important;
            line-height: 1.5 !important;
          }
        }

        /* Small screen such as Galaxy s8+ */
        @media (max-width: 360px) and (max-height: 768px) {
          .main-container {
            gap: 100px !important;
          }
          .left-section {
            margin-top: 20px !important;
          }
          .right-section {
            margin-bottom: 20px !important;
          }
        }

        /* Small screen such as iPhone SE */
        @media (max-width: 380px) and (max-height: 768px) {
          .main-container {
            gap: 100px !important;
          }
          .left-section {
            margin-top: 20px !important;
          }
          .right-section {
            margin-bottom: 20px !important;
          }
        }

        /* Responsive geser */
        @media (max-width: 1024px) and (max-height: 650px) {
          .main-container {
            gap: 140px !important;
          }

          .left-section {
            margin-top: 20px !important;
          }
        }
        @media (max-width: 768px) and (max-height: 650px) {
          .main-container {
            gap: 120px !important;
          }
        }
        @media (max-width: 480px) and (max-height: 650px) {
          .main-container {
            gap: 120px !important;
          }
        }
      `}</style>
    </>
  );
}
