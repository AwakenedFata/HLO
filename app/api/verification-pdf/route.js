import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let _browser = null;

// Reuse browser instance selama instance server masih hidup
async function getBrowser() {
  if (_browser) return _browser;

  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    const puppeteer = await import("puppeteer");

    _browser = await puppeteer.default.launch({
      headless: true,
      defaultViewport: {
        width: 794,
        height: 1123,
        deviceScaleFactor: 2, // Kembali ke 2 karena assets sudah preload
      },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--font-render-hinting=none", // Improves font rendering
      ],
    });

    console.log("🟢 [DEV] Using local Chrome");
  } else {
    const chromium = await import("@sparticuz/chromium");
    const puppeteerCore = await import("puppeteer-core");

    const executablePath = await chromium.default.executablePath();

    _browser = await puppeteerCore.default.launch({
      args: [...chromium.default.args, "--font-render-hinting=none"],
      defaultViewport: {
        width: 794,
        height: 1123,
        deviceScaleFactor: 2,
      },
      executablePath,
      headless: chromium.default.headless,
    });

    console.log("🔵 [PROD] Using @sparticuz/chromium");
  }

  return _browser;
}

export async function GET(request) {
  let page;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const targetUrl = `${origin}/pdfpage?${searchParams.toString()}`;

    console.log("[PDF] Rendering:", targetUrl);

    const browser = await getBrowser();
    page = await browser.newPage();

    // Set cache untuk mempercepat asset loading
    await page.setCacheEnabled(true);

    // Navigate dengan wait strategy yang lebih efisien
    // Karena assets sudah di-preload, kita bisa langsung load2 saja
    await page.goto(targetUrl, {
      waitUntil: "load",
      timeout: 60000,
    });

    // Pastikan semua resources sudah loaded
    await page.evaluate(async () => {
      // Tunggu fonts ready
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Tunggu images complete
      const images = Array.from(document.images || []);
      await Promise.all(
        images
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((resolve) => {
                img.onload = img.onerror = resolve;
                // Timeout per image 5 detik
                setTimeout(resolve, 5000);
              })
          )
      );

      // Short delay untuk final paint
      await new Promise((r) => setTimeout(r, 100));
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${code}.pdf"`,
        // Cache yang agresif karena certificate immutable per code
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[PDF ERROR]", err);
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        detail: String(err),
      },
      { status: 500 }
    );
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (_) {}
    }
  }
}

// Cleanup on shutdown
process.on("SIGTERM", async () => {
  if (_browser) {
    try {
      await _browser.close();
    } catch (_) {}
    _browser = null;
  }
});

process.on("SIGINT", async () => {
  if (_browser) {
    try {
      await _browser.close();
    } catch (_) {}
    _browser = null;
  }
});