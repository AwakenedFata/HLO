import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"

// Fungsi untuk mengambil semua PIN dengan paginasi dan optimasi
export async function GET(request) {
  try {
    await connectToDatabase()

    // Autentikasi dan otorisasi pengguna
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    // Ambil parameter URL untuk paginasi
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10) // Default 50 pin per halaman
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const skip = (page - 1) * limit

    // Ambil parameter filter jika ada
    const status = searchParams.get("status") || "all"
    const searchTerm = searchParams.get("search") || ""

    // Buat objek query berdasarkan status
    const query = {}
    if (status === "available") {
      query.used = false
    } else if (status === "pending") {
      query.used = true
      query.processed = false
    } else if (status === "processed") {
      query.used = true
      query.processed = true
    }

    // Tambahkan filter pencarian jika disediakan
    if (searchTerm) {
      query.$or = [
        { code: { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.nama": { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.idGame": { $regex: searchTerm, $options: "i" } },
      ]
    }

    // Eksekusi query secara paralel untuk performa lebih baik
    const [pins, totalCount] = await Promise.all([
      PinCode.find(query, {
        _id: 1,
        code: 1,
        used: 1,
        processed: 1,
        "redeemedBy.nama": 1,
        "redeemedBy.idGame": 1,
        "redeemedBy.redeemedAt": 1,
        createdAt: 1,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Gunakan lean() untuk performa lebih baik

      PinCode.countDocuments(query),
    ])

    logger.info(`PIN diambil oleh ${authResult.user.username}, halaman: ${page}, limit: ${limit}, status: ${status}`)

    return NextResponse.json(
      {
        pins,
        total: totalCount,
        page,
        totalPages: Math.ceil(totalCount / limit),
      },
      {
        headers: {
          // Tambahkan header cache control
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    )
  } catch (error) {
    logger.error("Error mengambil PIN:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}
