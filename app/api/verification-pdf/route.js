import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

let _browser = null

async function getBrowser() {
  if (_browser && _browser.isConnected()) {
    return _browser
  }

  // Deteksi environment: gunakan Chromium package hanya jika benar-benar di Linux
  const isLinux = process.platform === "linux"
  const isProduction = process.env.NODE_ENV === "production"

  // Gunakan @sparticuz/chromium hanya jika:
  // 1. Di production mode
  // 2. Di Linux (bukan Windows/Mac)
  // 3. Variable VERCEL atau AWS_LAMBDA_FUNCTION_NAME ada (optional check)
  const useChromiumPackage = isProduction && isLinux

  if (useChromiumPackage) {
    // PRODUCTION di Linux/Serverless
    const chromium = await import("@sparticuz/chromium")
    const puppeteerCore = await import("puppeteer-core")

    console.log("[PROD-LINUX] Starting browser launch with @sparticuz/chromium")

    let executablePath
    try {
      executablePath = await chromium.default.executablePath()
      console.log("[PROD-LINUX] Executable path from @sparticuz/chromium:", executablePath)
    } catch (error) {
      console.log("[PROD-LINUX] Failed to get executablePath from chromium package:", error.message)

      // Fallback ke lokasi manual chromium di VPS
      const fs = await import("fs")
      const fallbackPaths = [
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome",
        "/snap/bin/chromium",
      ]

      for (const path of fallbackPaths) {
        if (fs.existsSync(path)) {
          console.log(`[PROD-LINUX] Found fallback chromium at: ${path}`)
          executablePath = path
          break
        }
      }

      if (!executablePath) {
        throw new Error("Could not find chromium executable. Please install chromium-browser on your VPS.")
      }
    }

    _browser = await puppeteerCore.default.launch({
      args: [
        ...chromium.default.args,
        "--font-render-hinting=none",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process",
        "--no-zygote",
      ],
      defaultViewport: {
        width: 794,
        height: 1123,
        deviceScaleFactor: 2,
      },
      executablePath,
      headless: "new",
      ignoreHTTPSErrors: true,
    })

    console.log("[PROD-LINUX] Browser launched successfully")
  } else {
    // DEVELOPMENT atau PRODUCTION di Windows/Mac (local build)
    const puppeteer = await import("puppeteer")

    console.log(`[LOCAL] Running on ${process.platform}, using puppeteer`)

    const launchOptions = {
      headless: "new",
      defaultViewport: {
        width: 794,
        height: 1123,
        deviceScaleFactor: 2,
      },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--font-render-hinting=none",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--disable-sync",
        "--disable-background-networking",
        "--disable-default-apps",
        "--mute-audio",
        "--no-first-run",
      ],
    }

    const launchStrategies = [
      { name: "Chrome channel", options: { ...launchOptions, channel: "chrome" } },
      { name: "Default Puppeteer", options: launchOptions },
    ]

    for (const strategy of launchStrategies) {
      try {
        console.log(`[LOCAL] Trying to launch with: ${strategy.name}`)
        _browser = await puppeteer.default.launch(strategy.options)
        console.log(`[LOCAL] Browser launched successfully with: ${strategy.name}`)
        return _browser
      } catch (err) {
        console.log(`[LOCAL] Failed with ${strategy.name}:`, err.message)
      }
    }

    // Fallback: cari Chrome manual
    const fs = await import("fs")
    const path = await import("path")

    const possiblePaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ]

    for (const chromePath of possiblePaths) {
      try {
        if (chromePath && fs.existsSync(chromePath)) {
          console.log(`[LOCAL] Found Chrome at: ${chromePath}`)
          _browser = await puppeteer.default.launch({
            ...launchOptions,
            executablePath: chromePath,
          })
          console.log(`[LOCAL] Browser launched with manual path: ${chromePath}`)
          return _browser
        }
      } catch (err) {
        console.log(`[LOCAL] Failed with path ${chromePath}:`, err.message)
      }
    }

    throw new Error(
      "Could not launch browser. Please install Google Chrome or run: npx puppeteer browsers install chrome",
    )
  }

  return _browser
}

export async function GET(request) {
  let page = null

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")

    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 })
    }

    const isDev = process.env.NODE_ENV === "development"
    let targetUrl

    if (isDev && process.env.PDF_PAGE_URL_DEV) {
      targetUrl = `${process.env.PDF_PAGE_URL_DEV}?${searchParams.toString()}`
    } else {
      const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000"
      targetUrl = `${origin}/pdfpage?${searchParams.toString()}`
    }

    console.log("[PDF] Rendering:", targetUrl)

    const browser = await getBrowser()
    page = await browser.newPage()

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    await page.setCacheEnabled(true)
    await page.setJavaScriptEnabled(true)
    await page.setBypassCSP(true)

    // Request Interception for speed
    await page.setRequestInterception(true)
    page.on("request", (req) => {
      const resourceType = req.resourceType()
      // Allow only essential resources
      if (["document", "script", "stylesheet", "image", "font"].includes(resourceType)) {
        req.continue()
      } else {
        req.abort()
      }
    })

    console.log("[PDF] Navigating to page...")

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    })

    console.log("[PDF] Page loaded, waiting for assets...")

    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready
        console.log("[Puppeteer] Fonts ready")
      }

      const images = Array.from(document.images || [])
      await Promise.all(
        images
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((resolve) => {
                img.onload = img.onerror = resolve
                setTimeout(resolve, 5000)
              }),
          ),
      )
      console.log("[Puppeteer] Images loaded")

      await new Promise((resolve) => {
        const startTime = Date.now()
        const checkReady = () => {
          if (window.pdfReady === true) {
            console.log("[Puppeteer] PDF ready signal received")
            resolve()
          } else if (Date.now() - startTime > 15000) {
            console.log("[Puppeteer] Timeout waiting for pdfReady signal")
            resolve()
          } else {
            setTimeout(checkReady, 100)
          }
        }
        checkReady()
      })

      // Removed arbitrary 1000ms delay for speed
      // await new Promise((r) => setTimeout(r, 1000))
    })

    console.log("[PDF] All assets loaded, generating PDF...")

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      displayHeaderFooter: false,
      scale: 1,
    })

    console.log("[PDF] PDF generated successfully, size:", pdfBuffer.length, "bytes")

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Certificate of Authenticity.pdf"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    })
  } catch (err) {
    console.error("[PDF ERROR]", err)
    console.error("[PDF ERROR] Stack:", err.stack)

    if (page) {
      try {
        await page.close()
      } catch (_) { }
    }

    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        detail: String(err.message),
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
        hint: "Pastikan Google Chrome terinstall atau jalankan: npx puppeteer browsers install chrome"
      },
      { status: 500 },
    )
  } finally {
    if (page && !page.isClosed()) {
      try {
        await page.close()
      } catch (_) { }
    }
  }
}

const cleanup = async () => {
  if (_browser) {
    try {
      console.log("[PDF] Closing browser...")
      await _browser.close()
      _browser = null
      console.log("[PDF] Browser closed")
    } catch (err) {
      console.error("[PDF] Error closing browser:", err)
    }
  }
}

process.on("SIGTERM", cleanup)
process.on("SIGINT", cleanup)
process.on("beforeExit", cleanup)