'use client';

import jwt from "jsonwebtoken"
import logger from "@/lib/utils/logger-client"

// Sign JWT token (client-side version)
export const signToken = (id) => {
  return jwt.sign({ id }, process.env.NEXT_PUBLIC_JWT_SECRET, {
    expiresIn: process.env.NEXT_PUBLIC_JWT_EXPIRES_IN || "1h",
  })
}

// Get token from localStorage or cookies (client-side)
export const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token') || getCookieValue('jwt')
  }
  return null
}

// Get cookie value by name
export const getCookieValue = (name) => {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? match[2] : null
  }
  return null
}

// Set token in localStorage and cookie
export const setToken = (token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token)
    document.cookie = `jwt=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Strict`
  }
}

// Remove token from localStorage and cookie
export const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token')
    document.cookie = 'jwt=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
  }
}

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!getToken()
}

// Get user info from token
export const getUserFromToken = () => {
  const token = getToken()
  if (!token) return null
  
  try {
    const decoded = jwt.decode(token)
    return decoded
  } catch (error) {
    logger.error(`Error decoding token: ${error.message}`)
    return null
  }
}

// Login function
export const login = async (username, password) => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })
    
    const data = await response.json()
    
    if (response.ok) {
      setToken(data.token)
      return { success: true, data }
    } else {
      return { success: false, error: data.message || 'Login failed' }
    }
  } catch (error) {
    logger.error(`Login error: ${error.message}`)
    return { success: false, error: 'Network error' }
  }
}

// Logout function
export const logout = async () => {
  try {
    const token = getToken()
    
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
    }
    
    removeToken()
    return { success: true }
  } catch (error) {
    logger.error(`Logout error: ${error.message}`)
    return { success: false, error: 'Logout failed' }
  }
}