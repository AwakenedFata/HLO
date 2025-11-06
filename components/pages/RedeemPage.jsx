"use client";

import { useState, useEffect } from "react";
import { Form, Button } from "react-bootstrap";
import axios from "axios";
import styled from "styled-components";

// Styled Components
const PageWrapper = styled.div`
  width: 100%;
  min-height: 100vh;
  background-image: url(/assets/Redeem/background.avif);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 70px 20px 20px 20px;

  @media (max-width: 768px) {
    padding: 100px 20px 80px 20px;
  }

  @media (max-width: 576px) {
    padding: 80px 15px 60px 15px;
  }

  @media (max-width: 480px) {
    padding: 70px 15px 50px 15px;
  }

  @media (max-width: 410px) {
    padding: 60px 15px 40px 15px;
  }
`;

const RedeemContainer = styled.div`
  background-image: url(${(props) => props.$bgImage});
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  width: ${(props) => (props.$isMobile ? "100%" : "90%")};
  max-width: ${(props) => (props.$isMobile ? "450px" : "1000px")};
  height: ${(props) => (props.$isMobile ? "auto" : "700px")};
  min-height: ${(props) => (props.$isMobile ? "700px" : "auto")};
  position: relative;
  display: flex;
  justify-content: center;
  align-items: ${(props) => (props.$isMobile ? "flex-end" : "center")};
  transition: all 0.3s ease;

  @media (min-width: 1200px) {
    width: 65%;
    max-width: 1024px;
    height: 512px;
  }

  @media (min-width: 1024px) and (max-width: 1199px) {
    width: 65%;
    max-width: 1016px;
    height: 500px;
  }

  @media (max-width: 1023px) {
    max-width: 800px;
    height: 500px;
    background-size: contain;
  }

  @media (max-width: 768px) {
    width: 95%;
    max-width: 420px;
    min-height: 800px;
    height: auto;
  }

  @media (max-width: 576px) {
    width: 100%;
    max-width: 380px;
    min-height: 750px;
  }

  @media (max-width: 480px) {
    max-width: 350px;
    min-height: 700px;
  }

  @media (max-width: 410px) {
    max-width: 320px;
    min-height: 650px;
  }

  @media (max-width: 360px) {
    max-width: 300px;
    min-height: 620px;
  }
`;

const FormSide = styled.div`
  width: ${(props) => (props.$isMobile ? "85%" : "35%")};
  position: absolute;
  left: ${(props) => (props.$isMobile ? "50%" : "25%")};
  top: ${(props) => {
    if (props.$windowWidth <= 768) return "auto";
    if (props.$windowWidth <= 992) return "53%";
    return "50%";
  }};
  bottom: ${(props) => (props.$isMobile ? "60px" : "auto")};
  transform: ${(props) =>
    props.$isMobile ? "translateX(-50%)" : "translate(-50%, -50%)"};
  padding: 0;

  @media (min-width: 1200px) {
    width: 36%;
    left: 26%;
  }

  @media (min-width: 1024px) and (max-width: 1199px) {
    width: 37%;
    left: 25%;
    top: 51%;
  }

  @media (min-width: 1024px) {
    width: 37%;
  }

  @media (max-width: 1023px) {
    width: 37%;
    top: 51%;
  }

  @media (max-width: 768px) {
    width: 80%;
    bottom: 80px;
  }

  @media (max-width: 576px) {
    width: 82%;
    bottom: 70px;
  }

  @media (max-width: 480px) {
    width: 83%;
    bottom: 60px;
  }

  @media (max-width: 410px) {
    width: 85%;
    bottom: 55px;
  }
`;

const Title = styled.h1`
  font-size: ${(props) => {
    if (props.$windowWidth <= 320) return "1.5rem";
    if (props.$windowWidth <= 992) return "1.5rem";
    return "2.2rem";
  }};
  font-weight: bold;
  text-align: center;
  color: #000;
  font-family: "Poppins-Light", sans-serif;
  filter: drop-shadow(rgba(0, 0, 0, 0.5) 2px 2px 2px);

  @media (min-width: 1200px) {
    font-size: 1.6rem;
    margin-top: 15px;
  }

  @media (min-width: 1024px) and (max-width: 1199px) {
    font-size: 1.2rem;
    margin-top: 18px;
  }

  @media (max-width: 1023px) {
    font-size: 1.3rem;
    margin-top: 0px;
  }

  @media (max-width: 878px) {
    font-size: 1.2rem;
  }

  @media (max-width: 768px) {
    font-size: 1.4rem;
    margin-bottom: 18px;
  }

  @media (max-width: 576px) {
    font-size: 1.35rem;
    margin-bottom: 16px;
  }

  @media (max-width: 480px) {
    margin-top: 10px;
    margin-bottom: 15px;
    font-size: 1.3rem;
  }

  @media (max-width: 410px) {
    font-size: 1.25rem;
    margin-bottom: 14px;
  }

  @media (max-width: 380px) {
    font-size: 1.1rem;
    margin-bottom: 10px;
  }
`;

const StyledFormControl = styled(Form.Control)`
  padding: ${(props) =>
    props.$windowWidth <= 320 ? "10px 15px" : "12px 20px"};
  border-radius: 30px;
  border: none;
  box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.1);
  font-size: ${(props) => (props.$windowWidth <= 320 ? "0.9rem" : "1rem")};
  font-family: "Poppins-Semibold", sans-serif;
  background-color: #f6f8fd;
  filter: drop-shadow(rgba(0, 0, 0, 0.2) 2px 5px 2px);

  &::placeholder {
    color: rgba(0, 0, 0, 0.333);
  }

  &:focus {
    color: rgba(0, 0, 0, 0.333);
    background-color: #f6f8fd;
    border: none;
    box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.1);
  }

  @media (min-width: 1200px) {
    font-size: 0.85rem;
    padding: 10px 18px;
  }

  @media (min-width: 1024px) and (max-width: 1199px) {
    font-size: 0.6rem;
    padding: 6px 16px;
  }

  @media (max-width: 1016px) {
    padding: 8px 20px;
    font-size: 0.8rem;
  }

  @media (max-width: 878px) {
    font-size: 0.7rem;
  }

  @media (max-width: 768px) {
    padding: 11px 18px;
    font-size: 0.95rem;
  }

  @media (max-width: 576px) {
    padding: 10px 16px;
    font-size: 0.9rem;
  }

  @media (max-width: 480px) {
    padding: 8px 16px;
    font-size: 0.8rem;
  }

  @media (max-width: 410px) {
    padding: 7px 15px;
    font-size: 0.8rem;
  }
    
  @media (max-width: 380px) {
    padding: 8px 13px;
    font-size: 0.6rem;
  }
`;

const ErrorMessage = styled.p`
  color: red;
  font-size: 0.8rem;
  margin-left: 10px;
  font-family: "Poppins-Medium", sans-serif;
  margin-top: 5px;

  @media (min-width: 1200px) {
    font-size: 0.75rem;
  }

  @media (min-width: 1024px) and (max-width: 1199px) {
    font-size: 0.5rem;
  }

  @media (max-width: 1023px) {
    font-size: 0.7rem;
  }

  @media (max-width: 878px) {
    font-size: 0.65rem;
  }

  @media (max-width: 768px) {
    font-size: 0.78rem;
    margin-bottom: 0;
  }

  @media (max-width: 576px) {
    font-size: 0.75rem;
  }

  @media (max-width: 480px) {
    font-size: 0.7rem;
  }

  @media (max-width: 410px) {
    font-size: 0.6rem;
  }
`;

const StyledButton = styled(Button)`
  width: 100%;
  padding: ${(props) => (props.$windowWidth <= 320 ? "10px" : "12px")};
  border-radius: 30px;
  background-color: #f5ab1d;
  border: none;
  font-weight: bold;
  margin-top: 10px;
  font-size: ${(props) => (props.$windowWidth <= 320 ? "0.9rem" : "1rem")};
  box-shadow: none;

  &:hover,
  &:focus {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(255, 161, 99, 0.594);
    background-color: #f5ab1d;
    border: none;
  }
  
  &:active {
    background-color: #f5ab1d !important;
    border: none !important;
    box-shadow: 0 8px 20px rgba(255, 161, 99, 0.594) !important;
    color: inherit !important;
  }

  &:disabled {
    background-color: #f5ab1d;
    border: none;
    opacity: 0.7;
  }

  @media (min-width: 1200px) {
    padding: 11px 14px;
    font-size: 0.85rem;
    margin-top: 0px;
  }

  @media (min-width: 1024px) and (max-width: 1199px) {
    padding: 6px 10px;
    margin-top: 0px;
    font-size: 0.6rem;
  }

  @media (max-width: 1023px) {
    padding: 8px 20px;
    font-size: 0.8rem;
    margin-top: 0;
  }

  @media (max-width: 768px) {
    padding: 11px 18px;
    font-size: 0.95rem;
    margin-top: 5px;
  }

  @media (max-width: 576px) {
    padding: 10px 16px;
    font-size: 0.9rem;
  }

  @media (max-width: 480px) {
    padding: 8px 16px;
    font-size: 0.8rem;
  }

  @media (max-width: 410px) {
    padding: 7px 15px;
    font-size: 0.8rem;
  }

  @media (max-width: 380px) {
    margin-top: 0px;
  }
`;

const FormNote = styled.p`
  color: white;
  text-align: center;
  text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.3);
  font-family: "Poppins-Semibold", sans-serif;

  @media (min-width: 1200px) {
    font-size: 0.7rem;
    margin-top: 10px;
  }

  @media (min-width: 1024px) and (max-width: 1199px) {
    margin-top: 10px;
    font-size: 0.5rem;
  }

  @media (max-width: 1023px) {
    font-size: 0.7rem;
    margin-top: 10px;
  }

  @media (max-width: 878px) {
    margin-top: 10px;
    font-size: 0.65rem;
  }

  @media (max-width: 768px) {
    margin-top: 15px;
    font-size: 0.78rem;
  }

  @media (max-width: 576px) {
    margin-top: 12px;
    font-size: 0.75rem;
  }

  @media (max-width: 480px) {
    margin-top: 10px;
    padding-top: 0;
    font-size: 0.7rem;
  }

  @media (max-width: 410px) {
    margin-top: 8px;
    font-size: 0.6rem;
  }
`;

function RedeemPage() {
  const [pinCode, setPinCode] = useState("");
  const [idGame, setIdGame] = useState("");
  const [nama, setNama] = useState("");
  const [error, setError] = useState({
    emptyFields: false,
    invalidPin: false,
    usedPin: false,
    lowercasePin: false,
  });
  const [isMobile, setIsMobile] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const bgRedeemFormAndLogo = "/assets/Redeem/1.avif";
  const bgRedeemMobile = "/assets/Redeem/2.avif";

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width);
      setIsMobile(width <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isClient]);

  const validatePinFormat = (pin) => {
    return !/[a-z]/.test(pin);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emptyFields = !pinCode || !idGame || !nama;
    if (emptyFields) {
      setError({
        emptyFields: true,
        invalidPin: false,
        usedPin: false,
        lowercasePin: false,
      });
      return;
    }

    if (!validatePinFormat(pinCode)) {
      setError({
        emptyFields: false,
        invalidPin: false,
        usedPin: false,
        lowercasePin: true,
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`/api/pin-public/redeem`, {
        pinCode,
        idGame,
        nama,
      });

      if (response.data.message === "PIN code berhasil digunakan") {
        const phoneNumber =
          process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "6285709346954";
        const formattedPhone = phoneNumber.replace(/-/g, "").replace(/\s/g, "");
        const message = `*Saya ingin meredeem giftcard dengan keterangan*\nPIN Code: ${pinCode}\nID Game: ${idGame}\nNama: ${nama}`;
        window.location.href = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(
          message
        )}`;
      }
    } catch (error) {
      const errMsg = error.response?.data?.error || "Terjadi kesalahan server";

      setError({
        emptyFields: false,
        invalidPin: errMsg === "PIN code tidak ditemukan",
        usedPin: errMsg === "PIN code sudah digunakan",
        lowercasePin: errMsg === "PIN code harus huruf kapital semua",
      });
      if (
        errMsg !== "PIN code tidak ditemukan" &&
        errMsg !== "PIN code sudah digunakan" &&
        errMsg !== "PIN code harus huruf kapital semua"
      ) {
        alert("Terjadi kesalahan server. Coba lagi nanti.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageWrapper $isMobile={isMobile}>
      <RedeemContainer
        $isMobile={isMobile}
        $bgImage={isMobile ? bgRedeemMobile : bgRedeemFormAndLogo}
      >
        <FormSide $isMobile={isMobile} $windowWidth={windowWidth}>
          <Title $windowWidth={windowWidth}>
            {windowWidth <= 768 ? (
              "Redeem your tokens now!"
            ) : (
              <>
                Redeem your
                <br />
                tokens now!
              </>
            )}
          </Title>

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <StyledFormControl
                type="text"
                placeholder="PIN code"
                value={pinCode}
                onChange={(e) => {
                  setPinCode(e.target.value);
                  setError({
                    emptyFields: false,
                    invalidPin: false,
                    usedPin: false,
                    lowercasePin: false,
                  });
                }}
                $windowWidth={windowWidth}
              />
              {error.invalidPin && !error.emptyFields && (
                <ErrorMessage>*PIN code tidak valid</ErrorMessage>
              )}
              {error.usedPin && !error.emptyFields && !error.invalidPin && (
                <ErrorMessage>*PIN code sudah pernah digunakan</ErrorMessage>
              )}
              {error.lowercasePin &&
                !error.usedPin &&
                !error.emptyFields &&
                !error.invalidPin && (
                  <ErrorMessage>
                    *PIN code harus huruf kapital semua
                  </ErrorMessage>
                )}
            </Form.Group>

            <Form.Group className="mb-3">
              <StyledFormControl
                type="text"
                placeholder="ID game"
                value={idGame}
                onChange={(e) => setIdGame(e.target.value)}
                $windowWidth={windowWidth}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <StyledFormControl
                type="text"
                placeholder="Nama"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                $windowWidth={windowWidth}
              />
            </Form.Group>

            {error.emptyFields && (
              <ErrorMessage style={{ marginBottom: "10px", marginTop: "-5px" }}>
                *Semua kolom harus diisi terlebih dahulu
              </ErrorMessage>
            )}

            <StyledButton
              type="submit"
              disabled={isLoading}
              $windowWidth={windowWidth}
            >
              {isLoading ? "Processing..." : "Submit"}
            </StyledButton>

            <FormNote $windowWidth={windowWidth}>
              {windowWidth <= 992 ? (
                "*pastikan semua yang dimasukkan sudah benar termasuk PIN code"
              ) : (
                <>
                  *pastikan semua yang dimasukkan
                  <br />
                  sudah benar terutama PIN code
                </>
              )}
            </FormNote>
          </Form>
        </FormSide>
      </RedeemContainer>
    </PageWrapper>
  );
}

export default RedeemPage;