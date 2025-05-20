import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import { validateRequest, verifyTokenSchema } from "@/lib/utils/validation"

export async function GET(request) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
    }

    // If middleware passes, token is valid
    return NextResponse.json({
      status: "success",
      valid: true,
      admin: {
        id: authResult.user._id,
        username: authResult.user.username,
        role: authResult.user.role,
      },
    })
  } catch (error) {
    logger.error(`Token verification error: ${error.message}`)
    return NextResponse.json({ status: "error", message: "Token tidak valid", valid: false }, { status: 401 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const validation = await validateRequest(verifyTokenSchema, body)

    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }

    // Authenticate user
    const authResult = await authenticateRequest(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message, valid: false }, { status: 401 })
    }

    // If middleware passes, token is valid
    return NextResponse.json({
      status: "success",
      valid: true,
      admin: {
        id: authResult.user._id,
        username: authResult.user.username,
        role: authResult.user.role,
      },
    })
  } catch (error) {
    logger.error(`Token verification error: ${error.message}`)
    return NextResponse.json({ status: "error", message: "Token tidak valid", valid: false }, { status: 401 })
  }
}
