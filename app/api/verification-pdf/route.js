import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

// Helper to fetch public assets; falls back gracefully if missing
async function loadAsset(request, path) {
  try {
    const url = new URL(path, request.url)
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

function drawCenteredText(page, text, y, options) {
  const {
    font,
    size = 12,
    color = rgb(0, 0, 0),
    maxWidth = 520, // central column
    xCenter = 297.5, // half of 595
  } = options
  const width = font.widthOfTextAtSize(text, size)
  let x = xCenter - width / 2
  // clamp to margins
  const left = xCenter - maxWidth / 2
  if (x < left) x = left
  page.drawText(text, { x, y, size, font, color })
}

function drawCenteredWrapped(page, text, yStart, options) {
  const { font, size = 11, lineHeight = 15, color = rgb(0, 0, 0), maxWidth = 520 } = options
  const words = text.split(" ")
  const lines = []
  let current = ""
  for (const w of words) {
    const test = current ? current + " " + w : w
    const width = font.widthOfTextAtSize(test, size)
    if (width > maxWidth && current) {
      lines.push(current)
      current = w
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  let y = yStart
  for (const line of lines) {
    drawCenteredText(page, line, y, { font, size, color, maxWidth })
    y -= lineHeight
  }
  return y
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = (searchParams.get("code") || "-").toUpperCase()

  // Optional details (ke PDF saja, tidak tampil di UI)
  const issuedBy = searchParams.get("issuedBy") || "HLO STORE ID"
  const issuedOn = searchParams.get("issuedOn") || "1 January 2026"
  const location = searchParams.get("location") || "Lampung, Indonesia"

  const pdf = await PDFDocument.create()

  // Load custom fonts if provided; fallback to standard
  const headingBytes = await loadAsset(request, "/assets/certificate/fonts/Heading.ttf")
  const bodyBytes = await loadAsset(request, "/assets/certificate/fonts/Body.ttf")
  const headingFont = headingBytes
    ? await pdf.embedFont(headingBytes, { subset: true })
    : await pdf.embedFont(StandardFonts.HelveticaBold)
  const bodyFont = bodyBytes
    ? await pdf.embedFont(bodyBytes, { subset: true })
    : await pdf.embedFont(StandardFonts.Helvetica)

  // Load images (optional)
  const logoMainBytes = await loadAsset(request, "/assets/certificate/logo-main.png")
  const logoSecBytes = await loadAsset(request, "/assets/certificate/logo-secondary.png")
  const watermarkBytes = await loadAsset(request, "/assets/certificate/watermark.png")
  const bgBytes = await loadAsset(request, "/assets/certificate/background.jpg")
  const signatureBytes = await loadAsset(request, "/assets/certificate/signature.png")
  const stampBytes = await loadAsset(request, "/assets/certificate/stamp.png")

  const page = pdf.addPage([595, 842]) // A4 portrait
  const { width, height } = page.getSize()

  // Background image (if any)
  if (bgBytes) {
    const bg = bgBytes[0] === 0x89 ? await pdf.embedPng(bgBytes) : await pdf.embedJpg(bgBytes)
    const scale = Math.max(width / bg.width, height / bg.height)
    const w = bg.width * scale
    const h = bg.height * scale
    page.drawImage(bg, {
      x: (width - w) / 2,
      y: (height - h) / 2,
      width: w,
      height: h,
      opacity: 0.14,
    })
  }

  // Watermark (if any)
  if (watermarkBytes) {
    const wm = watermarkBytes[0] === 0x89 ? await pdf.embedPng(watermarkBytes) : await pdf.embedJpg(watermarkBytes)
    const wmW = width * 0.8
    const scale = wmW / wm.width
    const wmH = wm.height * scale
    page.drawImage(wm, {
      x: (width - wmW) / 2,
      y: (height - wmH) / 2,
      width: wmW,
      height: wmH,
      opacity: 0.12,
    })
  }

  // Top logos
  const topY = height - 88
  const centerX = width / 2
  const logoGap = 16
  let logosDrawn = false
  if (logoMainBytes) {
    const img = logoMainBytes[0] === 0x89 ? await pdf.embedPng(logoMainBytes) : await pdf.embedJpg(logoMainBytes)
    const targetH = 34
    const scale = targetH / img.height
    const w = img.width * scale
    page.drawImage(img, { x: centerX - w - logoGap / 2, y: topY, width: w, height: targetH, opacity: 1 })
    logosDrawn = true
  }
  if (logoSecBytes) {
    const img = logoSecBytes[0] === 0x89 ? await pdf.embedPng(logoSecBytes) : await pdf.embedJpg(logoSecBytes)
    const targetH = 34
    const scale = targetH / img.height
    const w = img.width * scale
    page.drawImage(img, { x: centerX + logoGap / 2, y: topY, width: w, height: targetH, opacity: 1 })
    logosDrawn = true
  }

  // Title
  const titleY = logosDrawn ? topY - 40 : height - 60
  drawCenteredText(page, "CERTIFICATE OF AUTHENTICITY", titleY, {
    font: headingFont,
    size: 16,
    color: rgb(0.12, 0.12, 0.12),
  })

  // Body paragraphs matching the mockup tone
  let y = titleY - 28
  y = drawCenteredWrapped(
    page,
    "This document verifies that the item associated with the serial number below is an authentic and original product of HLO.",
    y,
    { font: bodyFont, size: 11, color: rgb(0.1, 0.1, 0.1) },
  )
  y -= 6
  y = drawCenteredWrapped(
    page,
    "Each certified piece represents the brand's dedication to craftsmanship, detail, and originality — no reproductions, no replicas, no compromises.",
    y,
    { font: bodyFont, size: 11, color: rgb(0.1, 0.1, 0.1) },
  )

  // Decorative divider
  y -= 16
  const lineY1 = y
  page.drawLine({
    start: { x: 60, y: lineY1 },
    end: { x: width - 60, y: lineY1 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  })

  // Serial number section
  y -= 24
  drawCenteredText(page, "SERIAL NUMBER:", y, { font: headingFont, size: 12, color: rgb(0.15, 0.15, 0.15) })
  y -= 20
  drawCenteredText(page, code, y, { font: headingFont, size: 20, color: rgb(0.85, 0.08, 0.08) })

  // Divider
  y -= 18
  const lineY2 = y
  page.drawLine({
    start: { x: 60, y: lineY2 },
    end: { x: width - 60, y: lineY2 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  })

  // Issued info
  y -= 22
  drawCenteredText(page, `Issued by: ${issuedBy}`, y, { font: bodyFont, size: 11, color: rgb(0.1, 0.1, 0.1) })
  y -= 16
  drawCenteredText(page, `Issued on: ${issuedOn}`, y, { font: bodyFont, size: 11, color: rgb(0.1, 0.1, 0.1) })
  y -= 16
  drawCenteredText(page, `Location: ${location}`, y, { font: bodyFont, size: 11, color: rgb(0.1, 0.1, 0.1) })

  // Divider
  y -= 20
  const lineY3 = y
  page.drawLine({
    start: { x: 60, y: lineY3 },
    end: { x: width - 60, y: lineY3 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  })

  // Confirmation paragraphs
  y -= 22
  y = drawCenteredWrapped(
    page,
    "This certificate confirms that the product listed under the serial number above has been reviewed, approved, and released under the supervision of HLO’s Authenticity & Quality Control Division.",
    y,
    { font: bodyFont, size: 11, color: rgb(0.1, 0.1, 0.1) },
  )
  y -= 6
  y = drawCenteredWrapped(
    page,
    "Any duplication, modification, or reproduction of this certificate is strictly prohibited and will void its authenticity status.",
    y,
    { font: bodyFont, size: 11, color: rgb(0.1, 0.1, 0.1) },
  )

  // Divider + signature caption
  y -= 16
  const lineY4 = y
  page.drawLine({
    start: { x: 60, y: lineY4 },
    end: { x: width - 60, y: lineY4 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  })
  y -= 18
  drawCenteredText(page, "Authorized Signature & Official Seal", y, {
    font: bodyFont,
    size: 11,
    color: rgb(0.1, 0.1, 0.1),
  })

  // Signature + stamp
  const sigY = y - 22
  if (signatureBytes) {
    const sign = signatureBytes[0] === 0x89 ? await pdf.embedPng(signatureBytes) : await pdf.embedJpg(signatureBytes)
    const targetW = 190
    const scale = targetW / sign.width
    const targetH = sign.height * scale
    page.drawImage(sign, { x: centerX - targetW / 2, y: sigY, width: targetW, height: targetH, opacity: 1 })
  }
  if (stampBytes) {
    const st = stampBytes[0] === 0x89 ? await pdf.embedPng(stampBytes) : await pdf.embedJpg(stampBytes)
    const targetW = 86
    const scale = targetW / st.width
    const targetH = st.height * scale
    page.drawImage(st, { x: centerX + 90, y: sigY + 2, width: targetW, height: targetH, opacity: 1 })
  }

  // Footer
  const footerY = 60
  const year = new Date().getFullYear()
  drawCenteredText(page, `© ${year} HLO`, footerY + 18, { font: bodyFont, size: 10, color: rgb(0.1, 0.1, 0.1) })
  drawCenteredText(page, "All Rights Reserved Worldwide", footerY + 4, {
    font: bodyFont,
    size: 10,
    color: rgb(0.1, 0.1, 0.1),
  })
  drawCenteredText(page, "www.hoklampung.com", footerY - 10, { font: bodyFont, size: 10, color: rgb(0.1, 0.1, 0.1) })

  // Set document metadata (includes hidden details)
  pdf.setTitle("Certificate of Authenticity")
  pdf.setSubject("Authenticity confirmation for verified product")
  pdf.setKeywords(["HLO", "certificate", "authenticity", "verification", code])
  pdf.setProducer("HLO Verification Service")
  pdf.setCreator("HLO Verification UI")
  pdf.setCreationDate(new Date())

  const bytes = await pdf.save()
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="keterangan-produk-terverifikasi.pdf"',
      "Cache-Control": "no-store",
    },
  })
}
