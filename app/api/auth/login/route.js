import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import connectToDatabase from "@/lib/db";
import Admin from "@/lib/models/admin";
import { validateRequest } from "@/lib/utils/validation";
import { loginSchema } from "@/lib/schemas/auth-schemas";
import { rateLimit } from "@/lib/utils/rate-limit";
import logger from "@/lib/utils/logger-server";

// Rate limiter untuk login (5 attempts per 15 minutes)
const limiter = rateLimit({
  interval: 15 * 60 * 1000, // 15 menit
  limit: 5,
  uniqueTokenPerInterval: 500,
});

// Fungsi untuk membuat token JWT
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  });
};

// Fungsi untuk membuat refresh token
const signRefreshToken = (id) => {
  return jwt.sign(
    { id },
    process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
    }
  );
};

// File: route.js - Perbaikan pada fungsi POST

export async function POST(request) {
  try {
    // Apply rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Kombinasikan IP dan user-agent untuk rate limiting yang lebih akurat
    // Ini mencegah satu IP menggunakan banyak browser berbeda untuk bypass rate limit
    const tokenKey = `${ip}:${userAgent.substring(0, 50)}`;

    const limitResult = await limiter.check(tokenKey);

    if (!limitResult.success) {
      logger.warn(
        `Rate limit exceeded for login attempt from IP: ${ip}, attempts: ${limitResult.count}`
      );

      // Hitung waktu reset yang lebih akurat
      const retryAfter = 60; // Default 60 detik jika tidak ada info reset

      return NextResponse.json(
        {
          status: "error",
          message: `Terlalu banyak percobaan login. Silakan coba lagi dalam ${retryAfter} detik.`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(5),
            "X-RateLimit-Remaining": String(0),
            "X-RateLimit-Reset": String(retryAfter),
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    // PERBAIKAN: Tambahkan timeout untuk koneksi database
    const dbConnectionPromise = connectToDatabase();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database connection timeout")), 5000)
    );

    try {
      // PERBAIKAN: Gunakan Promise.race untuk menerapkan timeout
      await Promise.race([dbConnectionPromise, timeoutPromise]);
    } catch (dbError) {
      logger.error(`Database connection error: ${dbError.message}`);
      return NextResponse.json(
        {
          status: "error",
          message: "Tidak dapat terhubung ke database. Silakan coba lagi.",
        },
        { status: 500 }
      );
    }

    // PERBAIKAN: Tambahkan validasi body request
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error(`Error parsing request body: ${parseError.message}`);
      return NextResponse.json(
        { status: "error", message: "Format request tidak valid" },
        { status: 400 }
      );
    }

    // Validate request
    const validation = await validateRequest(loginSchema, body);
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 });
    }

    const { username, password } = body;

    // PERBAIKAN: Tambahkan try-catch untuk query database
    let user;
    try {
      // Check if user exists and password is correct
      user = await Admin.findOne({ username }).select("+password");
    } catch (dbQueryError) {
      logger.error(`Error querying database: ${dbQueryError.message}`);
      return NextResponse.json(
        {
          status: "error",
          message: "Terjadi kesalahan saat memeriksa kredensial",
        },
        { status: 500 }
      );
    }

    // PERBAIKAN: Tambahkan validasi user dan method comparePassword
    if (!user) {
      logger.warn(
        `Percobaan login gagal untuk username: ${username} dari IP: ${ip}`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, 500 + Math.random() * 500)
      );
      return NextResponse.json(
        { status: "error", message: "Username atau password salah" },
        { status: 401 }
      );
    }

    // PERBAIKAN: Periksa apakah method comparePassword ada
    if (typeof user.comparePassword !== "function") {
      logger.error(
        `comparePassword method not found on user model for username: ${username}`
      );
      return NextResponse.json(
        {
          status: "error",
          message: "Terjadi kesalahan pada sistem autentikasi",
        },
        { status: 500 }
      );
    }

    // PERBAIKAN: Tambahkan try-catch untuk password comparison
    let passwordMatch;
    try {
      passwordMatch = await user.comparePassword(password);
    } catch (passwordError) {
      logger.error(`Error comparing password: ${passwordError.message}`);
      return NextResponse.json(
        {
          status: "error",
          message: "Terjadi kesalahan saat memverifikasi password",
        },
        { status: 500 }
      );
    }

    if (!passwordMatch) {
      logger.warn(
        `Percobaan login gagal untuk username: ${username} dari IP: ${ip}`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, 500 + Math.random() * 500)
      );
      return NextResponse.json(
        { status: "error", message: "Username atau password salah" },
        { status: 401 }
      );
    }

    // Login berhasil
    // REMOVED: limiter.reset(tokenKey) - This method doesn't exist in the implementation

    // Log successful login
    logger.info(`Login berhasil untuk user: ${username} dari IP: ${ip}`);

    // PERBAIKAN: Tambahkan try-catch untuk pembuatan token
    let token, refreshToken;
    try {
      // Create tokens
      token = signToken(user._id);
      refreshToken = signRefreshToken(user._id);
    } catch (tokenError) {
      logger.error(`Error generating tokens: ${tokenError.message}`);
      return NextResponse.json(
        {
          status: "error",
          message: "Terjadi kesalahan saat membuat token autentikasi",
        },
        { status: 500 }
      );
    }

    // Cookie options
    const cookieOptions = {
      expires: new Date(
        Date.now() +
          (process.env.JWT_COOKIE_EXPIRES_IN || 1) * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    };

    // Remove password from output
    user.password = undefined;

    // Create response with cookies
    const response = NextResponse.json({
      status: "success",
      token,
      admin: {
        id: user._id,
        username: user.username,
        role: user.role,
        profileImage: user.profileImage,
      },
    });

    // PERBAIKAN: Tambahkan try-catch untuk setting cookies
    try {
      // Set cookies
      response.cookies.set("jwt", token, cookieOptions);
      response.cookies.set("refreshToken", refreshToken, {
        ...cookieOptions,
        expires: new Date(
          Date.now() +
            (process.env.REFRESH_TOKEN_COOKIE_EXPIRES_IN || 7) *
              24 *
              60 *
              60 *
              1000
        ),
      });
    } catch (cookieError) {
      logger.error(`Error setting cookies: ${cookieError.message}`);
      // Lanjutkan meskipun ada error cookies, karena token sudah dikirim dalam response body
    }

    return response;
  } catch (err) {
    // PERBAIKAN: Log error dengan lebih detail
    logger.error(`Error pada login: ${err.message}`, {
      stack: err.stack,
      name: err.name,
    });

    return NextResponse.json(
      {
        status: "error",
        message: "Terjadi kesalahan pada server. Silakan coba lagi nanti.",
        // PERBAIKAN: Tambahkan error code untuk memudahkan debugging
        errorCode: "AUTH_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
