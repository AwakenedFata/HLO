import { NextResponse } from "next/server"
import crypto from "crypto"
import connectToDatabase from "@/lib/db"
import SerialNumber from "@/lib/models/serialNumber"
import { rateLimit } from "@/lib/utils/rate-limit"
import { serialVerifySchema } from "@/lib/utils/validation"
import logger from "@/lib/utils/logger-server"

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 5000, limit: 30 })

function generateDeviceFingerprint(userAgent, acceptLanguage, acceptEncoding) {
  const data = `${userAgent || ""}|${acceptLanguage || ""}|${acceptEncoding || ""}`
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 32)
}

export async function POST(request) {
  try {
    // Rate limit per IP (first XFF)
    const rawIpHeader = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "" // request.ip tidak selalu tersedia

    const limiterKey = (rawIpHeader || "").split(",")[0].trim() || "anonymous"
    const rate = await limiter.check(limiterKey, 30, "verify-serial")
    if (!rate.success) {
      return NextResponse.json({ success: false, error: "Too many attempts", reset: rate.reset }, { status: 429 })
    }

    await connectToDatabase()

    // Parse and validate input
    let body = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const parsed = serialVerifySchema.safeParse({
      code: String(body?.code || "").toUpperCase(),
    })
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Kode verifikasi tidak valid" }, { status: 400 })
    }

    const code = parsed.data.code

    // Server-side device fingerprint
    const userAgent = request.headers.get("user-agent") || ""
    const acceptLanguage = request.headers.get("accept-language") || ""
    const acceptEncoding = request.headers.get("accept-encoding") || ""
    const deviceFingerprint = generateDeviceFingerprint(userAgent, acceptLanguage, acceptEncoding)

    const ip = limiterKey || "unknown"
    const now = new Date()

    // ATOMIC update: only mark as verified if not yet verified
    const updated = await SerialNumber.findOneAndUpdate(
      { code, isActive: true, isVerified: false },
      {
        $inc: { verificationCount: 1 },
        $set: {
          isVerified: true,
          verifiedByIP: ip,
          verifiedByDevice: deviceFingerprint,
          verifiedAt: now,
          lastVerifiedAt: now,
          lastVerifiedIP: ip,
          firstVerifiedAt: now,
        },
      },
      { new: true },
    )

    if (!updated) {
      // Determine reason
      const current = await SerialNumber.findOne({ code }).lean()

      if (!current || !current.isActive) {
        return NextResponse.json(
          { success: false, message: "Kode verifikasi tidak ditemukan atau tidak aktif." },
          { status: 404 },
        )
      }
      if (current.isVerified) {
        return NextResponse.json(
          {
            success: false,
            message: "Kode ini sudah pernah diverifikasi dan tidak dapat digunakan lagi.",
            alreadyVerified: true,
            verifiedAt: current.verifiedAt,
          },
          { status: 403 },
        )
      }
      // Fallback
      return NextResponse.json({ success: false, message: "Terjadi kesalahan saat memverifikasi" }, { status: 500 })
    }

    // Success
    return NextResponse.json({
      success: true,
      message: "Produk terverifikasi! Ini adalah produk asli.",
      product: {
        name: updated.product?.name || "",
        batch: updated.product?.batch || "",
        productionDate: updated.product?.productionDate || "",
        warrantyUntil: updated.product?.warrantyUntil || "",
      },
      verifiedAt: updated.verifiedAt?.toISOString() || now.toISOString(),
    })
  } catch (err) {
    logger.error("Verification error:", err)
    return NextResponse.json({ success: false, message: "Terjadi kesalahan server" }, { status: 500 })
  }
}
