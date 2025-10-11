import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import SerialNumber from "@/lib/models/serialNumber"

export const dynamic = "force-dynamic"

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const code = String(body?.code || "")
      .toUpperCase()
      .trim()

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, message: "Kode verifikasi tidak valid (6 digit angka)" },
        { status: 400 },
      )
    }

    await connectToDatabase()

    const found = await SerialNumber.findOne({ code }).exec()
    if (!found || found.isActive === false) {
      return NextResponse.json(
        { success: false, message: "Kode verifikasi tidak ditemukan atau tidak aktif." },
        { status: 404 },
      )
    }

    if (found.isVerified) {
      return NextResponse.json(
        {
          success: false,
          message: "Kode ini sudah pernah diverifikasi dan tidak dapat digunakan lagi.",
          alreadyVerified: true,
          verifiedAt: found.verifiedAt,
        },
        { status: 403 },
      )
    }

    const now = new Date()
    found.isVerified = true
    found.verificationCount = (found.verificationCount || 0) + 1
    found.firstVerifiedAt = found.firstVerifiedAt || now
    found.lastVerifiedAt = now
    found.verifiedAt = now
    // Optionally capture IP/device here if needed
    await found.save()

    return NextResponse.json({
      success: true,
      message: "Produk terverifikasi! Ini adalah produk asli.",
      product: {
        name: found.product?.name || "",
        batch: found.product?.batch || "",
        productionDate: found.product?.productionDate || "",
        warrantyUntil: found.product?.warrantyUntil || "",
      },
      verifiedAt: now.toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ success: false, message: "Terjadi kesalahan server" }, { status: 500 })
  }
}
