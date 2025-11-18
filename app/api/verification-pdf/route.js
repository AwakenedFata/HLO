import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let _browser = null;

// Create/reuse browser (super important for performance)
async function getBrowser() {
  if (_browser) return _browser;

  const executablePath = await chromium.executablePath();

  _browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: {
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    },
    executablePath,
    headless: chromium.headless,
  });

  return _browser;
}

export async function GET(request) {
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
    const page = await browser.newPage();

    // Faster: only wait DOM ready, not full network idle
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Ensure fonts fully loaded
    await page.evaluate(async () => {
      try {
        await document.fonts.ready;
      } catch (_) {}
    });

    // Generate PDF (A4, clean margins)
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    await page.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${code}.pdf"`,
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
  }
}
