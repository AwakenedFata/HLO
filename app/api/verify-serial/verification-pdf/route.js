import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import SerialNumber from "@/lib/models/serialNumber"

export const dynamic = "force-dynamic"

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const code = String(url.searchParams.get("code") || "")
      .toUpperCase()
      .trim()

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 })
    }

    await connectToDatabase()
    const sn = await SerialNumber.findOne({ code }).lean()

    if (!sn || sn.isActive === false) {
      return NextResponse.json({ error: "Serial number not found or inactive" }, { status: 404 })
    }

    if (!sn.isVerified) {
      return NextResponse.json({ error: "Serial number has not been verified yet" }, { status: 403 })
    }

    const params = new URLSearchParams()
    params.set("code", sn.code)
    params.set("name", sn.product?.name || "-")
    params.set("batch", sn.product?.batch || "-")
    params.set("productionDate", sn.product?.productionDate || "-")
    params.set("warrantyUntil", sn.product?.warrantyUntil || "-")
    params.set("issuedOn", (sn.issuedDate || sn.createdAt || new Date()).toISOString())

    const target = new URL(`/api/verification-pdf?${params.toString()}`, url.origin)
    return NextResponse.redirect(target.href, 307)
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
