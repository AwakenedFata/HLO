import puppeteer from "puppeteer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const issuedOn = searchParams.get("issuedOn") || new Date().toISOString();

    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const url = `${origin}/pdfpage?${searchParams.toString()}`;

    console.log("Generating PDF from:", url);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
      defaultViewport: {
        width: 794,
        height: 1123,
        deviceScaleFactor: 2,
      },
    });

    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    // Tunggu font dan styled-components load
    await page.evaluate(async () => {
      try {
        await document.fonts.ready;
      } catch (_) {}
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, left: 0, right: 0, bottom: 0 },
    });

    await browser.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${code}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF ERROR:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF", detail: String(err) },
      { status: 500 }
    );
  }
}
