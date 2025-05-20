import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import TokenBlacklist from "@/lib/models/tokenBlacklist";
import { authenticateRequest } from "@/lib/utils/auth-server";
import logger from "@/lib/utils/logger-server";
import { validateRequest, logoutSchema } from "@/lib/utils/validation";

export async function POST(request) {
  try {
    await connectToDatabase();

    // Authenticate user
    const authResult = await authenticateRequest(request);

    // Get token from cookies or authorization header
    let token;
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      const cookieStore = request.cookies;
      token = cookieStore.get("jwt")?.value;
    }

    if (!token) {
      return NextResponse.json(
        { status: "error", message: "Tidak ada token yang diberikan" },
        { status: 400 }
      );
    }

    // Add token to blacklist
    await TokenBlacklist.create({ token });

    const body = await request.json();
    const validation = await validateRequest(logoutSchema, body);

    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 });
    }

    // Create response
    const response = NextResponse.json({ status: "success" });

    // Clear cookies
    response.cookies.set("jwt", "", {
      expires: new Date(0),
      httpOnly: true,
    });

    response.cookies.set("refreshToken", "", {
      expires: new Date(0),
      httpOnly: true,
    });

    logger.info(
      `User ${
        authResult.error ? "unknown" : authResult.user.username
      } berhasil logout`
    );

    return response;
  } catch (err) {
    logger.error(`Error pada logout: ${err.message}`);
    return NextResponse.json(
      { status: "error", message: err.message },
      { status: 400 }
    );
  }
}
