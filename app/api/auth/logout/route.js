import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import TokenBlacklist from "@/lib/models/tokenBlacklist"
import RefreshToken from "@/lib/models/refreshToken" // Pastikan model ini ada
import { authenticateRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { validateRequest } from "@/lib/utils/validation"
import { logoutSchema } from "@/lib/schemas/auth-schemas" // Import dari file auth-schemas

export async function POST(request) {
  try {
    // PERBAIKAN: Tambahkan timeout untuk koneksi database
    const dbConnectionPromise = connectToDatabase()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database connection timeout")), 5000),
    )

    try {
      await Promise.race([dbConnectionPromise, timeoutPromise])
    } catch (dbError) {
      logger.error(`Database connection error: ${dbError.message}`)
      return NextResponse.json(
        {
          status: "error",
          message: "Tidak dapat terhubung ke database. Silakan coba lagi.",
          errorCode: "DB_CONNECTION_ERROR",
        },
        { status: 500 },
      )
    }

    // Authenticate user
    const authResult = await authenticateRequest(request)

    // Get token from cookies or authorization header
    let token
    const authHeader = request.headers.get("authorization")
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1]
    } else {
      const cookieStore = request.cookies
      token = cookieStore.get("jwt")?.value
    }

    // PERBAIKAN: Dapatkan refresh token
    let refreshToken
    const cookieStore = request.cookies
    refreshToken = cookieStore.get("refreshToken")?.value

    // PERBAIKAN: Jika tidak ada di cookie, coba ambil dari body
    let body
    try {
      body = await request.json()
      if (!refreshToken && body.refreshToken) {
        refreshToken = body.refreshToken
      }

      // Validate request menggunakan logoutSchema dari auth-schemas.js
      const validation = await validateRequest(logoutSchema, body)
      if (!validation.success) {
        logger.warn(`Logout validation failed: ${JSON.stringify(validation.error)}`)
        return NextResponse.json(validation.error, { status: 400 })
      }

      // Jika ada token di body, gunakan itu
      if (validation.data.token && !token) {
        token = validation.data.token
      }
    } catch (error) {
      // Ignore error, body parsing is optional for logout
    }

    if (!token) {
      logger.warn("Logout attempt without token")
      return NextResponse.json(
        { status: "error", message: "Tidak ada token yang diberikan", errorCode: "MISSING_TOKEN" },
        { status: 400 },
      )
    }

    // PERBAIKAN: Tambahkan try-catch untuk operasi database
    try {
      // Add token to blacklist
      await TokenBlacklist.create({ token })

      // PERBAIKAN: Jika ada refresh token, tandai sebagai digunakan di database
      if (refreshToken) {
        await RefreshToken.updateOne({ token: refreshToken }, { used: true })
      }
    } catch (dbError) {
      logger.error(`Error updating token blacklist: ${dbError.message}`)
      // Lanjutkan meskipun ada error database, karena cookies akan tetap dihapus
    }

    // Create response
    const response = NextResponse.json({ status: "success" })

    // PERBAIKAN: Tambahkan try-catch untuk setting cookies
    try {
      // Clear cookies
      response.cookies.set("jwt", "", {
        expires: new Date(0),
        httpOnly: true,
        path: "/",
      })

      response.cookies.set("refreshToken", "", {
        expires: new Date(0),
        httpOnly: true,
        path: "/",
      })
    } catch (cookieError) {
      logger.error(`Error clearing cookies: ${cookieError.message}`)
      // Lanjutkan meskipun ada error cookies
    }

    logger.info(`User ${authResult.error ? "unknown" : authResult.user.username} berhasil logout`)

    return response
  } catch (err) {
    logger.error(`Error pada logout: ${err.message}`, { stack: err.stack })
    return NextResponse.json(
      {
        status: "error",
        message: "Terjadi kesalahan saat logout. Silakan coba lagi.",
        errorCode: "LOGOUT_ERROR",
      },
      { status: 500 },
    )
  }
}
