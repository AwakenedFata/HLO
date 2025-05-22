import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { validateRequest } from "@/lib/utils/validation"
import { verifyTokenSchema } from "@/lib/schemas/auth-schemas" // Import dari file auth-schemas

export async function GET(request) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request)
    if (authResult.error) {
      logger.warn(`Token verification failed: ${authResult.message}`)
      return NextResponse.json({ status: "error", message: authResult.message, valid: false }, { status: 401 })
    }

    // If middleware passes, token is valid
    logger.info(`Token verified successfully for user: ${authResult.user.username}`)
    return NextResponse.json({
      status: "success",
      valid: true,
      admin: {
        id: authResult.user._id,
        username: authResult.user.username,
        role: authResult.user.role,
        // Tambahkan informasi expiry untuk client
        tokenExpiry: authResult.tokenExpiry || null,
      },
    })
  } catch (error) {
    logger.error(`Token verification error: ${error.message}`, { stack: error.stack })
    return NextResponse.json(
      {
        status: "error",
        message: "Token tidak valid",
        valid: false,
        errorCode: "TOKEN_VERIFICATION_ERROR",
      },
      { status: 401 },
    )
  }
}

export async function POST(request) {
  try {
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      logger.error(`Error parsing request body: ${parseError.message}`)
      return NextResponse.json(
        { status: "error", message: "Format request tidak valid", errorCode: "INVALID_REQUEST_FORMAT" },
        { status: 400 },
      )
    }

    // Validate request menggunakan verifyTokenSchema dari auth-schemas.js
    const validation = await validateRequest(verifyTokenSchema, body)
    if (!validation.success) {
      logger.warn(`Token verification validation failed: ${JSON.stringify(validation.error)}`)
      return NextResponse.json(validation.error, { status: 400 })
    }

    // Authenticate user
    const authResult = await authenticateRequest(request)
    if (authResult.error) {
      logger.warn(`Token verification failed: ${authResult.message}`)
      return NextResponse.json({ status: "error", message: authResult.message, valid: false }, { status: 401 })
    }

    // If middleware passes, token is valid
    logger.info(`Token verified successfully for user: ${authResult.user.username}`)
    return NextResponse.json({
      status: "success",
      valid: true,
      admin: {
        id: authResult.user._id,
        username: authResult.user.username,
        role: authResult.user.role,
        // Tambahkan informasi expiry untuk client
        tokenExpiry: authResult.tokenExpiry || null,
      },
    })
  } catch (error) {
    logger.error(`Token verification error: ${error.message}`, { stack: error.stack })
    return NextResponse.json(
      {
        status: "error",
        message: "Token tidak valid",
        valid: false,
        errorCode: "TOKEN_VERIFICATION_ERROR",
      },
      { status: 401 },
    )
  }
}
