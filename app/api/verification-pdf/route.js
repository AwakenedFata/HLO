import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium"
import { NextResponse } from "next/server"
import os from "os"
import fs from "fs/promises"
import path from "path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// In-instance concurrency limiter to avoid multiple launches racing for /tmp
const CONCURRENCY_LIMIT = 1
let activeCount = 0
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function acquireLock(timeoutMs = 15000) {
  const start = Date.now()
  while (activeCount >= CONCURRENCY_LIMIT) {
    if (Date.now() - start > timeoutMs) {
      throw Object.assign(new Error("Service busy"), { status: 503 })
    }
    await wait(50)
  }
  activeCount += 1
  return () => {
    activeCount = Math.max(0, activeCount - 1)
  }
}

function getLocalChromePath() {
  const platform = os.platform()
  if (platform === "win32") return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  if (platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  return "/usr/bin/google-chrome"
}

function getRequestOrigin(request) {
  const url = new URL(request.url)
  const forwardedProto = request.headers.get("x-forwarded-proto")
  const proto = forwardedProto || url.protocol.replace(":", "") || "https"
  const host = request.headers.get("host") || url.host
  return `${proto}://${host}`
}

function getPdfPageUrl(searchParams, request) {
  // Prefer same-origin for stability
  const origin = getRequestOrigin(request)
  const baseUrl =
    process.env.NODE_ENV === "development"
      ? process.env.PDF_PAGE_URL_DEV || `${origin}/pdfpage`
      : process.env.PDF_PAGE_URL_PROD || `${origin}/pdfpage`

  const params = new URLSearchParams(searchParams)
  return `${baseUrl}?${params.toString()}`
}

function sanitizeFileName(name) {
  return String(name || "certificate")
    .replace(/[^a-z0-9_\-.]+/gi, "_")
    .slice(0, 80)
}

async function cleanupOldProfiles(prefix = "puppeteer_profile_", maxAgeMs = 5 * 60 * 1000) {
  try {
    const tmp = os.tmpdir()
    const entries = await fs.readdir(tmp)
    const now = Date.now()
    await Promise.all(
      entries
        .filter((d) => d.startsWith(prefix))
        .map(async (d) => {
          const full = path.join(tmp, d)
          try {
            const stat = await fs.stat(full)
            if (now - stat.mtimeMs > maxAgeMs) {
              await fs.rm(full, { recursive: true, force: true })
            }
          } catch {}
        }),
    )
  } catch {}
}

async function launchBrowser({ userDataDir, isDev }) {
  const args = [
    ...(isDev ? [] : chromium.args),
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--single-process",
    "--disable-gpu",
    "--no-zygote",
    `--user-data-dir=${userDataDir}`,
  ]

  return puppeteer.launch({
    args,
    executablePath: isDev ? getLocalChromePath() : await chromium.executablePath(),
    headless: true,
    defaultViewport: { width: 1200, height: 1754 }, // A4 @ 96dpi
  })
}

function validateQueryParams(url) {
  const params = url.searchParams
  const code = String(params.get("code") || "").toUpperCase()
  const issuedOn = params.get("issuedOn")
  if (code && !/^[A-Z0-9-]{1,24}$/.test(code)) {
    return { ok: false, status: 400, message: "Invalid code format" }
  }
  if (issuedOn) {
    const d = new Date(issuedOn)
    if (isNaN(d.getTime())) {
      return { ok: false, status: 400, message: "Invalid issuedOn date" }
    }
  }
  return { ok: true }
}

export async function GET(request) {
  const release = await acquireLock().catch((e) => e)
  if (typeof release !== "function") {
    const status = release?.status || 429
    return NextResponse.json({ error: release?.message || "Busy" }, { status })
  }

  let browser
  const tmp = os.tmpdir()
  const userDataDir = path.join(tmp, `puppeteer_profile_${Date.now()}_${Math.random().toString(36).slice(2)}`)
  await fs.mkdir(userDataDir, { recursive: true }).catch(() => {})

  try {
    // Opportunistic cleanup of old temp profiles
    cleanupOldProfiles().catch(() => {})

    const reqUrl = new URL(request.url)
    const validate = validateQueryParams(reqUrl)
    if (!validate.ok) {
      return NextResponse.json({ error: validate.message }, { status: validate.status })
    }

    const pdfPageUrl = getPdfPageUrl(reqUrl.searchParams, request)
    const isDev = process.env.NODE_ENV === "development"

    console.log("[v0] 🔗 Generating PDF from:", pdfPageUrl)

    browser = await launchBrowser({ userDataDir, isDev })
    const page = await browser.newPage()

    // Strict request allowlist: same-origin, data, blob, and optional env allowlist
    const allowedOrigin = new URL(pdfPageUrl).origin
    const envAllow = (process.env.PDF_ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

    await page.setRequestInterception(true)
    page.on("request", (req) => {
      try {
        const reqUrl = req.url()
        const u = new URL(reqUrl)
        const scheme = u.protocol.replace(":", "")
        if (scheme === "data" || scheme === "blob") return req.continue()
        if (u.origin === allowedOrigin) return req.continue()
        if (envAllow.includes(u.origin)) return req.continue()
        return req.abort()
      } catch {
        return req.abort()
      }
    })

    // Stable user-agent
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    )

    // Robust navigation
    await page.goto(pdfPageUrl, { waitUntil: "networkidle0", timeout: 60000 }).catch(async () => {
      await page.goto(pdfPageUrl, { waitUntil: "load", timeout: 60000 })
    })

    // Wait for root container
    await page.waitForSelector(".pdf-page", { timeout: 20000 }).catch(() => {})

    // Fonts readiness
    await page.evaluate(async () => {
      try {
        if (document && document.fonts && document.fonts.ready) {
          await document.fonts.ready
        }
      } catch {}
    })

    await wait(800)

    // Generate the PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    })

    // Close before cleanup
    await browser.close()
    browser = undefined

    // Cleanup tmp
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {})

    const code = (reqUrl.searchParams.get("code") || "").toString().toUpperCase()
    const fileName = sanitizeFileName(code ? `certificate-${code}.pdf` : "certificate-of-authenticity.pdf")

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (error) {
    console.error("[v0] ❌ PDF generation error:", error)

    // Best-effort cleanup
    try {
      if (browser) await browser.close()
    } catch {}
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {})

    const isNoSpace = (error && (error.code === "ENOSPC" || /ENOSPC/i.test(String(error)))) || false
    const status = isNoSpace ? 503 : 500
    const message = isNoSpace ? "PDF service is temporarily out of disk space. Please retry." : "Failed to generate PDF"

    return NextResponse.json({ error: message, details: error?.message || String(error) }, { status })
  } finally {
    try {
      if (typeof release === "function") release()
    } catch {}
  }
}
