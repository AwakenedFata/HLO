"use client"

import { useState, useRef, useEffect } from "react"
import styled from "styled-components"

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background-image: url("/assets/serialnumber/serialnumber.avif");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: 75px clamp(24px, 5vw, 80px) 40px clamp(240px, 35vw, 560px);
  @media (max-width: 1024px) {
    justify-content: center;
    padding: 75px 24px;
  }
`

const Card = styled.div`
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50px;
  padding: 40px 40px;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  @media (max-width: 768px) {
    padding: 32px 32px;
  }
`

const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: #1a1a1a;
  margin-top: -15px;
  margin-bottom: 10px;
  text-align: center;
  @media (max-width: 768px) {
    font-size: 28px;
  }
  @media (max-width: 484px) {
    font-size: 24px;
  }
`

const Description = styled.p`
  font-size: 16px;
  color: #000;
  text-align: center;
  margin-bottom: 25px;
  line-height: 1.6;
  @media (max-width: 768px) {
    font-size: 14px;
  }
  @media (max-width: 484px) {
    font-size: 11px;
  }
`

const InputContainer = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 32px;
`

const CodeInput = styled.input`
  width: 56px;
  height: 56px;
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  outline: none;
  transition: all 0.2s ease;
  text-transform: uppercase;
  color: #1a1a1a;
  &:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
  @media (max-width: 768px) {
    font-size: 20px;
    width: 48px;
    height: 48px;
  }
  @media (max-width: 484px) {
    width: 40px;
    height: 40px;
  }
`

const ButtonRow = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  align-items: stretch;
`

const PrimaryButton = styled.button`
  flex: 1;
  max-width: 240px;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #f5ab1d 0%, #f5ab1d 100%);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover:not(:disabled) {
    transform: scale(1.03);
    box-shadow: 0 8px 20px rgba(34, 197, 94, 0.35);
  }
  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  @media (max-width: 768px) {
    padding: 12px 12px;
    max-width: 210px;
    flex: 0 0 210px;
    font-size: 14px;
  }
  @media (max-width: 540px) {
    padding: 10px 10px;
    font-size: 12px;
    max-width: 180px;
    flex: 0 0 180px;
  }
  @media (max-width: 484px) {
    padding: 10px 10px;
    font-size: 12px;
    max-width: 145px;
    flex: 0 0 145px;
  }
`

const SecondaryButton = styled.button`
  flex: 1;
  max-width: 240px;
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  color: #f59e0b;
  background: #fff;
  border: 2px solid #f59e0b33;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover {
    transform: scale(1.03);
  }
  @media (max-width: 768px) {
    padding: 12px 12px;
    max-width: 210px;
    flex: 0 0 210px;
    font-size: 14px;
  }
  @media (max-width: 540px) {
    padding: 10px 10px;
    font-size: 12px;
    max-width: 180px;
    flex: 0 0 180px;
  }
  @media (max-width: 484px) {
    padding: 10px 10px;
    font-size: 12px;
    max-width: 145px;
    flex: 0 0 145px;
  }
`

const ResultOverlay = styled.div`
  margin-top: 8px;
  padding: 28px 22px;
  border-radius: 16px;
  text-align: center;
  animation: fadeIn 0.25s ease;
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }
`

const SuccessOverlay = styled(ResultOverlay)`
  background: #ecfdf5;
  border: 2px solid #10b981;
  color: #065f46;
`

const ErrorOverlay = styled(ResultOverlay)`
  background: #fef2f2;
  border: 2px solid #ef4444;
  color: #7f1d1d;
`

const IconCircle = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 9999px;
  margin: 0 auto 14px;
  display: grid;
  place-items: center;
  background: ${(p) => (p.variant === "success" ? "#10b981" : "#ef4444")};
  box-shadow: 0 10px 18px ${(p) => (p.variant === "success" ? "rgba(16,185,129,.35)" : "rgba(239,68,68,.35)")};
  animation: scaleIn 0.4s ease-out;
  
  @keyframes scaleIn {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
`

const CheckSvgStyled = styled.svg`
  @keyframes drawCheck {
    to {
      stroke-dashoffset: 0;
    }
  }
  
  path {
    stroke-dasharray: 30;
    stroke-dashoffset: 30;
    animation: drawCheck 0.6s ease-out forwards;
  }
`

const CrossSvgStyled = styled.svg`
  @keyframes drawCross1 {
    to {
      stroke-dashoffset: 0;
    }
  }
  
  @keyframes drawCross2 {
    to {
      stroke-dashoffset: 0;
    }
  }
  
  path:first-child {
    stroke-dasharray: 20;
    stroke-dashoffset: 20;
    animation: drawCross1 0.4s ease-out forwards;
  }
  
  path:last-child {
    stroke-dasharray: 20;
    stroke-dashoffset: 20;
    animation: drawCross2 0.4s ease-out 0.2s forwards;
  }
`

const CheckSvg = () => (
  <CheckSvgStyled width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </CheckSvgStyled>
)

const CrossSvg = () => (
  <CrossSvgStyled width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 6L6 18" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 6l12 12" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </CrossSvgStyled>
)

const OverlayTitle = styled.h3`
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 6px;
`

const OverlayText = styled.p`
  font-size: 14px;
  line-height: 1.6;
  margin: 0 auto 12px;
  max-width: 460px;
`

const ProductList = styled.ul`
  margin: 10px auto 0;
  padding: 0;
  list-style: none;
  max-width: 460px;
  text-align: left;
  color: inherit;
  li { display: flex; justify-content: space-between; padding: 6px 0; border-top: 1px dashed currentColor; opacity: .9; }
  li:first-child { border-top: 0; }
  .label { font-weight: 700; opacity: .9; }
  .value { opacity: .95; }
`

const ActionsRow = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 16px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: 10px;
  }

  @media (max-width: 548px) {
    flex-direction: column;
    align-items: stretch;
  }
`

const DownloadLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #111827;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
  transition: transform .2s ease, box-shadow .2s ease;
  box-shadow: 0 8px 18px rgba(17,24,39,.25);
  flex: 1;
  max-width: 240px;
  min-width: 180px;
  &:hover { 
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(17,24,39,.35);
  }

  @media (max-width: 768px) {
    padding: 12px 12px;
    font-size: 14px;
    max-width: 210px;
    min-width: 160px;
    flex: 1 1 calc(50% - 6px);
  }
  
  @media (max-width: 548px) {
    max-width: 100%;
    flex: 1;
  }
  
  @media (max-width: 484px) {
    padding: 10px 10px;
    font-size: 12px;
  }
`

const OverlaySecondaryButton = styled(SecondaryButton)`
  @media (max-width: 768px) {
    flex: 1 1 calc(50% - 6px);
  }
  
  @media (max-width: 548px) {
    max-width: 100%;
    flex: 1;
  }
  
  @media (max-width: 484px) {
    flex: 1;
  }
`

export default function VerifikasiOrisinalPage() {
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [isVerifying, setIsVerifying] = useState(false)
  const [result, setResult] = useState(null)
  const inputRefs = useRef([])
  const [fingerprint, setFingerprint] = useState("")
  const [locked, setLocked] = useState(false)
  const cacheKey = "verificationCache"

  useEffect(() => {
    if (inputRefs.current[0]) inputRefs.current[0].focus()
  }, [])

  async function hashString(input) {
    const enc = new TextEncoder()
    const data = enc.encode(input)
    const hash = await crypto.subtle.digest("SHA-256", data)
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }

  useEffect(() => {
    async function compute() {
      try {
        const ua = navigator.userAgent || ""
        const lang = navigator.language || ""
        const plat = navigator.platform || ""
        const vendor = navigator.vendor || ""
        const mem = (navigator.deviceMemory || 0).toString()
        const cores = (navigator.hardwareConcurrency || 0).toString()
        const tz = (new Date().getTimezoneOffset() || 0).toString()
        const color = window.screen && window.screen.colorDepth ? window.screen.colorDepth.toString() : "0"
        const res = window.screen ? `${window.screen.width}x${window.screen.height}` : "0x0"
        const seed = [ua, lang, plat, vendor, mem, cores, tz, color, res].join("|")
        const fp = await hashString(seed)
        setFingerprint(fp)
      } catch {
        setFingerprint("unknown")
      }
    }
    compute()
  }, [])

  const handleChange = (index, value) => {
    const sanitizedValue = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
    if (sanitizedValue.length <= 1) {
      const newCode = [...code]
      newCode[index] = sanitizedValue
      setCode(newCode)
      setResult(null)
      setLocked(false)
      if (sanitizedValue && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      } else {
        const newCode = [...code]
        newCode[index] = ""
        setCode(newCode)
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData
      .getData("text")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
    if (pastedData) {
      const newCode = [...code]
      for (let i = 0; i < Math.min(pastedData.length, 6); i++) {
        newCode[i] = pastedData[i]
      }
      setCode(newCode)
      const nextEmptyIndex = newCode.findIndex((c) => !c)
      const focusIndex = nextEmptyIndex !== -1 ? nextEmptyIndex : 5
      inputRefs.current[focusIndex]?.focus()
    }
  }

  const handleVerify = async () => {
    const fullCode = code.join("").toUpperCase()

    if (fullCode.length !== 6) {
      setResult({ success: false, message: "Mohon masukkan kode verifikasi lengkap (6 karakter)" })
      setLocked(true)
      return
    }

    try {
      setIsVerifying(true)
      const res = await fetch("/api/verify-serial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fullCode, fingerprint }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setResult({
          success: false,
          message:
            data?.message ||
            (res.status === 403
              ? "Kode ini sudah digunakan."
              : res.status === 404
                ? "Kode tidak ditemukan atau tidak aktif."
                : "Verifikasi gagal. Coba lagi."),
        })
        setLocked(true)
      } else {
        // ✅ FIX: Simpan SELURUH data response termasuk issuedDate terbaru
        setResult({ 
          success: true, 
          message: data.message, 
          product: data.product,
          data: data.data // 🔥 Simpan semua data dari API response
        })
        setLocked(true)
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ fingerprint, at: Date.now() }))
        } catch {}
      }
    } catch (e) {
      setResult({ success: false, message: "Terjadi kesalahan jaringan. Coba lagi." })
      setLocked(true)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleClear = () => {
    setCode(["", "", "", "", "", ""])
    setResult(null)
    setLocked(false)
    inputRefs.current[0]?.focus()
  }

  const isComplete = code.every((c) => c !== "")

  const showForm = !result

  // ✅ FIX: Gunakan data dari response API (data terbaru dari database)
  const pdfHref = result?.success && result?.data
    ? (() => {
        const params = new URLSearchParams({
          code: result.data.code || code.join("").toUpperCase(),
          name: result.data.product?.name || "-",
          productionDate: result.data.product?.productionDate || "-",
          // 🔥 CRITICAL: Gunakan issuedDate dari database (sudah ter-update via admin)
          issuedOn: result.data.issuedDate || new Date().toISOString(),
        })
        return `/api/verification-pdf?${params.toString()}`
      })()
    : "#"

  return (
    <PageContainer>
      <Card>
        <Title>Verifikasi Keaslian Produk</Title>

        {showForm ? (
          <>
            <Description>
              <span>Masukkan 6 kode Serial Number yang terdapat pada</span>
              <br />
              <span>hangtag produk Anda untuk memastikan keasliannya.</span>
            </Description>

            <InputContainer>
              {code.map((digit, index) => (
                <CodeInput
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={isVerifying || locked}
                />
              ))}
            </InputContainer>

            <ButtonRow>
              <PrimaryButton onClick={handleVerify} disabled={!isComplete || isVerifying || locked}>
                {isVerifying ? "Memverifikasi..." : "Verifikasi Produk"}
              </PrimaryButton>
              <SecondaryButton onClick={handleClear} disabled={isVerifying}>
                Hapus Kode
              </SecondaryButton>
            </ButtonRow>
          </>
        ) : result.success ? (
          <SuccessOverlay role="status" aria-live="polite">
            <IconCircle variant="success" aria-hidden="true">
              <CheckSvg />
            </IconCircle>
            <OverlayTitle>Produk Asli</OverlayTitle>
            <OverlayText>
              Produk ini terverifikasi keasliannya! Silakan download dokumen keterangan asli produk di bawah.
            </OverlayText>

            <ActionsRow>
              <DownloadLink
                href={pdfHref}
                download="keterangan-produk-terverifikasi.pdf"
                target="_blank"
                rel="noopener"
              >
                Unduh Dokumen
              </DownloadLink>
              <OverlaySecondaryButton onClick={handleClear}>Serial Number</OverlaySecondaryButton>
            </ActionsRow>
          </SuccessOverlay>
        ) : (
          <ErrorOverlay role="status" aria-live="polite">
            <IconCircle variant="error" aria-hidden="true">
              <CrossSvg />
            </IconCircle>
            <OverlayTitle>Verifikasi Gagal</OverlayTitle>
            <OverlayText>
              {result.message || "Serial number salah, sudah digunakan, tidak ditemukan, atau tidak aktif."}
            </OverlayText>
            <ActionsRow>
              <OverlaySecondaryButton onClick={handleClear}>Serial Number</OverlaySecondaryButton>
            </ActionsRow>
          </ErrorOverlay>
        )}
      </Card>
    </PageContainer>
  )
}