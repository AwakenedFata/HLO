import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium"
import { NextResponse } from "next/server"
import os from "os"

export const dynamic = "force-dynamic"

function getPdfPageUrl(searchParams) {
  const baseUrl =
    process.env.NODE_ENV === "development"
      ? process.env.PDF_PAGE_URL_DEV || "http://localhost:3000/pdfpage"
      : process.env.PDF_PAGE_URL_PROD || "https://hoklampung.vercel.app/pdfpage"

  const params = new URLSearchParams(searchParams)
  return `${baseUrl}?${params.toString()}`
}

function getLocalChromePath() {
  const platform = os.platform()
  if (platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  } else if (platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  } else {
    return "/usr/bin/google-chrome"
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const pdfPageUrl = getPdfPageUrl(searchParams)

    console.log("🔗 Generating PDF from:", pdfPageUrl)

    const isDev = process.env.NODE_ENV === "development"

    const browser = await puppeteer.launch({
      args: isDev ? [] : chromium.args,
      executablePath: isDev
        ? getLocalChromePath() // pakai Chrome lokal saat dev
        : await chromium.executablePath(), // pakai Chromium serverless saat production (Vercel)
      headless: true,
    })

    const page = await browser.newPage()
    await page.goto(pdfPageUrl, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    })

    await browser.close()

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-of-authenticity.pdf"`,
      },
    })
  } catch (error) {
    console.error("❌ PDF generation error:", error)
    return NextResponse.json({ error: "Failed to generate PDF", details: error.message }, { status: 500 })
  }
}
