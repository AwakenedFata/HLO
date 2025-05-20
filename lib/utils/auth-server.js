import 'server-only';
import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import TokenBlacklist from "@/lib/models/tokenBlacklist"
import logger from "@/lib/utils/logger-server"

// Sign JWT token
export const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  })
}

// Sign refresh token
export const signRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  })
}

// Get token from request
export const getTokenFromRequest = (request) => {
  // Check authorization header
  const authHeader = request.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1]
  }

  // Check cookies
  const cookieStore = cookies()
  return cookieStore.get("jwt")?.value
}

// Verify token and get user
export const verifyToken = async (token) => {
  try {
    if (!token) {
      return { error: true, message: "No token provided" }
    }

    // Check if token is blacklisted
    await connectToDatabase()
    const blacklistedToken = await TokenBlacklist.findOne({ token })
    if (blacklistedToken) {
      return { error: true, message: "Token has been invalidated" }
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Get user
    const user = await Admin.findById(decoded.id)
    if (!user) {
      return { error: true, message: "User not found" }
    }

    // Check if password changed after token was issued
    if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
      return { error: true, message: "Password changed, please login again" }
    }

    return { error: false, user }
  } catch (error) {
    logger.error(`Token verification error: ${error.message}`)
    return { error: true, message: "Invalid token" }
  }
}

// Authenticate request
export const authenticateRequest = async (request) => {
  const token = getTokenFromRequest(request)
  return await verifyToken(token)
}

// Check if user has required role
export const checkRole = (user, requiredRoles) => {
  if (!requiredRoles.includes(user.role)) {
    return { error: true, message: "Insufficient permissions" }
  }
  return { error: false }
}

// Authenticate and authorize request
export const authorizeRequest = (requiredRoles) => {
  return async (request) => {
    const authResult = await authenticateRequest(request)

    if (authResult.error) {
      return authResult
    }

    const roleCheck = checkRole(authResult.user, requiredRoles)
    if (roleCheck.error) {
      return roleCheck
    }

    return { error: false, user: authResult.user }
  }
}