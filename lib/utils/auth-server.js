import "server-only"
import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import connectToDatabase from "@/lib/db"
import Admin from "@/lib/models/admin"
import TokenBlacklist from "@/lib/models/tokenBlacklist"
import RefreshToken from "@/lib/models/refreshToken" 
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

// Get refresh token from request
export const getRefreshTokenFromRequest = (request) => {
  // Check cookies
  const cookieStore = cookies()
  const refreshToken = cookieStore.get("refreshToken")?.value

  if (refreshToken) {
    return refreshToken
  }

  // Try to get from request body
  try {
    const body = request.json()
    return body.refreshToken
  } catch (error) {
    return null
  }
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

    // Calculate token expiry
    const now = Math.floor(Date.now() / 1000)
    const tokenExpiry = decoded.exp
    const timeRemaining = tokenExpiry - now

    return {
      error: false,
      user,
      tokenExpiry: timeRemaining > 0 ? new Date(tokenExpiry * 1000) : null,
    }
  } catch (error) {
    logger.error(`Token verification error: ${error.message}`)

    if (error.name === "TokenExpiredError") {
      return { error: true, message: "Token has expired", expired: true }
    }

    return { error: true, message: "Invalid token" }
  }
}

// Verify refresh token
export const verifyRefreshToken = async (refreshToken) => {
  try {
    if (!refreshToken) {
      return { error: true, message: "No refresh token provided" }
    }

    // Check if refresh token exists in database and is not used
    await connectToDatabase()
    const storedToken = await RefreshToken.findOne({ token: refreshToken })

    if (!storedToken) {
      return { error: true, message: "Invalid refresh token" }
    }

    if (storedToken.used) {
      return { error: true, message: "Refresh token has already been used" }
    }

    if (storedToken.expiresAt < new Date()) {
      return { error: true, message: "Refresh token has expired" }
    }

    // Verify token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET)

    // Get user
    const user = await Admin.findById(decoded.id)
    if (!user) {
      return { error: true, message: "User not found" }
    }

    // Mark token as used
    storedToken.used = true
    await storedToken.save()

    return { error: false, user, tokenId: storedToken._id }
  } catch (error) {
    logger.error(`Refresh token verification error: ${error.message}`)
    return { error: true, message: "Invalid refresh token" }
  }
}

// Authenticate request
export const authenticateRequest = async (request) => {
  try {
    const token = getTokenFromRequest(request)
    if (!token) {
      return { error: true, message: "No token provided", statusCode: 401 }
    }

    const result = await verifyToken(token)
    if (result.error) {
      // If token is expired, try to use refresh token
      if (result.expired) {
        const refreshToken = getRefreshTokenFromRequest(request)
        if (refreshToken) {
          const refreshResult = await verifyRefreshToken(refreshToken)
          if (!refreshResult.error) {
            // Generate new token
            const newToken = signToken(refreshResult.user._id)

            // Generate new refresh token
            const newRefreshToken = signRefreshToken(refreshResult.user._id)

            // Save new refresh token to database
            const refreshTokenExpiry = new Date()
            refreshTokenExpiry.setDate(
              refreshTokenExpiry.getDate() + Number.parseInt(process.env.REFRESH_TOKEN_COOKIE_EXPIRES_IN || "7", 10),
            )

            await RefreshToken.create({
              token: newRefreshToken,
              user: refreshResult.user._id,
              userType: "admin",
              expiresAt: refreshTokenExpiry,
              used: false,
            })

            // Calculate token expiry
            const expiresIn = process.env.JWT_EXPIRES_IN || "1h"
            const expiryInSeconds =
              typeof expiresIn === "string" && expiresIn.endsWith("h")
                ? Number.parseInt(expiresIn.slice(0, -1), 10) * 3600
                : typeof expiresIn === "string" && expiresIn.endsWith("d")
                  ? Number.parseInt(expiresIn.slice(0, -1), 10) * 86400
                  : typeof expiresIn === "string" && expiresIn.endsWith("m")
                    ? Number.parseInt(expiresIn.slice(0, -1), 10) * 60
                    : Number.parseInt(expiresIn, 10)

            const tokenExpiry = new Date(Date.now() + expiryInSeconds * 1000)

            return {
              error: false,
              user: refreshResult.user,
              newToken,
              newRefreshToken,
              tokenExpiry,
            }
          }
        }
      }

      return { error: true, message: result.message, statusCode: 401 }
    }

    return { error: false, user: result.user, tokenExpiry: result.tokenExpiry }
  } catch (err) {
    logger.error(`Auth error: ${err.message}`, { stack: err.stack })
    return { error: true, message: "Failed to authenticate request", statusCode: 500 }
  }
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

    return {
      error: false,
      user: authResult.user,
      newToken: authResult.newToken,
      newRefreshToken: authResult.newRefreshToken,
      tokenExpiry: authResult.tokenExpiry,
    }
  }
}

// Blacklist token
export const blacklistToken = async (token) => {
  try {
    await connectToDatabase()
    await TokenBlacklist.create({ token })
    return { error: false }
  } catch (error) {
    logger.error(`Error blacklisting token: ${error.message}`)
    return { error: true, message: "Failed to blacklist token" }
  }
}

// Create refresh token in database
export const createRefreshTokenInDb = async (token, userId, userType = "admin") => {
  try {
    await connectToDatabase()

    const refreshTokenExpiry = new Date()
    refreshTokenExpiry.setDate(
      refreshTokenExpiry.getDate() + Number.parseInt(process.env.REFRESH_TOKEN_COOKIE_EXPIRES_IN || "7", 10),
    )

    await RefreshToken.create({
      token,
      user: userId,
      userType,
      expiresAt: refreshTokenExpiry,
      used: false,
    })

    return { error: false }
  } catch (error) {
    logger.error(`Error creating refresh token: ${error.message}`)
    return { error: true, message: "Failed to create refresh token" }
  }
}
