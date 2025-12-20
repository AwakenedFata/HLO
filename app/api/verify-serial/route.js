import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import SerialNumber from "@/lib/models/serialNumber"

export const dynamic = "force-dynamic"

async function getLocationFromIP(ip) {
  const safeIP = ip === "::1" || ip === "127.0.0.1" ? "8.8.8.8" : ip.trim()

  console.log("Resolving location for IP:", safeIP)

  const normalize = (region, country) => {
    const locationParts = []
    if (region) locationParts.push(region)
    if (country) locationParts.push(country)

    return {
      province: region || "",
      country: country || "Indonesia",
      fullLocation: locationParts.join(", ") || "Indonesia",
    }
  }

  try {
    const res = await fetch(`https://ipinfo.io/${safeIP}/json?token=9fcba8ab0a930d`, {
      cache: "no-store",
    })

    if (res.ok) {
      const data = await res.json()
      console.log("[v1] ipinfo response:", data)

      if (data.country) {
        return normalize(data.region, data.country === "ID" ? "Indonesia" : data.country)
      }
    }
  } catch (e) {
    console.error("[v1] ipinfo failed:", e)
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${safeIP}?fields=66846719`, { cache: "no-store" })

    if (res.ok) {
      const data = await res.json()
      console.log("[v1] ip-api response:", data)

      if (data.status === "success" && data.country) {
        return normalize(data.regionName, data.country)
      }
    }
  } catch (e) {
    console.error("[v1] ip-api failed:", e)
  }

  try {
    const res = await fetch(`https://geoip-db.com/json/${safeIP}`, { cache: "no-store" })

    if (res.ok) {
      const data = await res.json()
      console.log("[v1] geoip-db response:", data)

      const country = data.country_name
      if (country) {
        return normalize(data.state, country)
      }
    }
  } catch (e) {
    console.error("[v1] geoip-db failed:", e)
  }

  console.log("[v1] All API failed, fallback Indonesia")

  return {
    province: "",
    country: "Indonesia",
    fullLocation: "Indonesia",
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const code = String(body?.code || "")
      .toUpperCase()
      .trim()

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, message: "Kode verifikasi tidak valid (6 digit angka)" },
        { status: 400 },
      )
    }

    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "127.0.0.1"

    console.log("[v1] Raw User IP:", ip)

    let location
    const browserLoc = body.browserLocation

    if (browserLoc === null || browserLoc === undefined) {
      console.log("User denied location permission")
      location = {
        province: "",
        country: "",
        fullLocation: "", 
        denied: true, 
      }
    } else if (browserLoc?.country) {
      // User memberikan izin lokasi
      const locationParts = []
      if (browserLoc.region) locationParts.push(browserLoc.region)
      if (browserLoc.country) locationParts.push(browserLoc.country)

      location = {
        province: browserLoc.region || "",
        country: browserLoc.country || "",
        fullLocation: locationParts.join(", "),
        denied: false,
      }
    } else {
      location = await getLocationFromIP(ip)
      location.denied = false
    }

    console.log("[v1] Final location:", location)

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
          message: "Kode ini sudah pernah diverifikasi.",
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
    found.verificationLocation = location

    await found.save()

    console.log("[v1] Saved with location:", found.verificationLocation)

    return NextResponse.json({
      success: true,
      message: "Produk terverifikasi! Ini adalah produk asli.",
      data: {
        code: found.code,
        product: found.product,
        issuedDate: found.issuedDate,
        createdAt: found.createdAt,
        verifiedAt: now.toISOString(),
        verificationLocation: location,
      },
    })
  } catch (err) {
    console.error("[v1] Verification error:", err)
    return NextResponse.json({ success: false, message: "Terjadi kesalahan server" }, { status: 500 })
  }
}