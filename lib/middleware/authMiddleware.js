import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import TokenBlacklist from "@/lib/models/tokenBlacklist"
import logger from "@/lib/utils/logger-server"

export async function authenticate(request) {
  try {
    await connectToDatabase()

    const cookieStore = cookies()
    let token = cookieStore.get("jwt")?.value

    if (!token) {
      const authHeader = request.headers.get("authorization")
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1]
      }
    }

    if (!token) {
      return {
        error: true,
        status: 401,
        message: "Tidak ada token, akses ditolak",
      }
    }

    // Check if token is blacklisted
    const blacklistedToken = await TokenBlacklist.findOne({ token })
    if (blacklistedToken) {
      return {
        error: true,
        status: 401,
        message: "Token tidak lagi valid",
      }
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Check if user still exists
    const currentUser = await Admin.findById(decoded.id)
    if (!currentUser) {
      return {
        error: true,
        status: 401,
        message: "Pengguna dengan token ini tidak ada lagi",
      }
    }

    // Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter && currentUser.changedPasswordAfter(decoded.iat)) {
      return {
        error: true,
        status: 401,
        message: "Password telah diubah, silakan login kembali",
      }
    }

    // Grant access to protected route
    return {
      error: false,
      user: currentUser,
    }
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`)
    return {
      error: true,
      status: 401,
      message: "Token tidak valid",
    }
  }
}

export function authorize(...roles) {
  return async (request) => {
    const authResult = await authenticate(request)

    if (authResult.error) {
      return authResult
    }

    if (!roles.includes(authResult.user.role)) {
      return {
        error: true,
        status: 403,
        message: `Role ${authResult.user.role} tidak diizinkan mengakses resource ini`,
      }
    }

    return authResult
  }
}
