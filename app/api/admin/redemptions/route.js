import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"

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
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10)
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const search = searchParams.get("search") || ""
    const startDate = searchParams.get("startDate") || ""
    const endDate = searchParams.get("endDate") || ""

    // Validasi parameter paginasi
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Parameter paginasi tidak valid" }, { status: 400 })
    }

    const skip = (page - 1) * limit

    // Buat query untuk PIN yang sudah di-redeem
    const query = { used: true }

    // Tambahkan filter pencarian jika disediakan
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { "redeemedBy.nama": { $regex: search, $options: "i" } },
        { "redeemedBy.idGame": { $regex: search, $options: "i" } },
      ]
    }

    // Tambahkan filter rentang tanggal jika disediakan
    if (startDate && endDate) {
      query["redeemedBy.redeemedAt"] = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)), // Akhir hari
      }
    } else if (startDate) {
      query["redeemedBy.redeemedAt"] = { $gte: new Date(startDate) }
    } else if (endDate) {
      query["redeemedBy.redeemedAt"] = { $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) }
    }

    // Gunakan lean() untuk performa lebih baik dan hanya pilih field yang dibutuhkan
    const [redemptions, totalCount] = await Promise.all([
      PinCode.find(query, {
        _id: 1,
        code: 1,
        processed: 1,
        "redeemedBy.nama": 1,
        "redeemedBy.idGame": 1,
        "redeemedBy.redeemedAt": 1,
      })
        .sort({ "redeemedBy.redeemedAt": -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      // Dapatkan total count secara paralel
      PinCode.countDocuments(query),
    ])

    logger.info(`Riwayat redemption diambil oleh ${authResult.user.username}, halaman: ${page}, limit: ${limit}`)

    return NextResponse.json(
      {
        redemptions,
        count: redemptions.length,
        total: totalCount,
        page,
        limit,
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
    logger.error("Error mengambil riwayat redemption:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}
