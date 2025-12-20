import mongoose from "mongoose"
import logger from "@/lib/utils/logger"

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable")
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

// Production-optimized connection options
const getConnectionOptions = () => {
  const baseOptions = {
    bufferCommands: false,
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4, // Use IPv4, skip trying IPv6
  }

  // Additional options for production
  if (process.env.NODE_ENV === "production") {
    return {
      ...baseOptions,
      maxPoolSize: 20, // Higher pool size for production
      minPoolSize: 5, // Minimum number of connections
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      retryWrites: true, // Retry failed writes
      w: "majority", // Write concern
      readPreference: "primary", // Read from primary
      heartbeatFrequencyMS: 10000, // Heartbeat every 10 seconds
      serverSelectionTimeoutMS: 10000, // Longer timeout for production
    }
  }

  return baseOptions
}

async function connectToDatabase() {
  // Return existing connection if available
  if (cached.conn) {
    // Check if connection is still alive
    if (mongoose.connection.readyState === 1) {
      return cached.conn
    } else {
      // Connection is stale, reset cache
      cached.conn = null
      cached.promise = null
    }
  }

  if (!cached.promise) {
    const opts = getConnectionOptions()

    // Log connection attempt (hide credentials)
    const sanitizedUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")
    logger.info(`Attempting to connect to MongoDB: ${sanitizedUri}`)

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongoose) => {
        logger.info("MongoDB connected successfully", {
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          name: mongoose.connection.name,
          poolSize: opts.maxPoolSize,
        })

        // Set up connection event listeners
        mongoose.connection.on("error", (err) => {
          logger.error("MongoDB connection error:", {
            message: err.message,
            code: err.code,
          })
        })

        mongoose.connection.on("disconnected", () => {
          logger.warn("MongoDB disconnected")
        })

        mongoose.connection.on("reconnected", () => {
          logger.info("MongoDB reconnected")
        })

        return mongoose
      })
      .catch((err) => {
        logger.error("MongoDB connection failed:", {
          message: err.message,
          code: err.code,
          name: err.name,
        })

        // Reset promise so next attempt can try again
        cached.promise = null
        throw err
      })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

// Enhanced connection health check
export async function checkDatabaseHealth() {
  try {
    if (!cached.conn) {
      await connectToDatabase()
    }

    // Ping the database
    await mongoose.connection.db.admin().ping()

    return {
      status: "healthy",
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    }
  } catch (error) {
    logger.error("Database health check failed:", {
      message: error.message,
      code: error.code,
    })

    return {
      status: "unhealthy",
      error: error.message,
      readyState: mongoose.connection.readyState,
    }
  }
}

// Graceful shutdown with improved error handling
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, closing MongoDB connection...`)

  try {
    if (cached.conn && mongoose.connection.readyState === 1) {
      await mongoose.connection.close(false) // Don't force close
      logger.info("MongoDB connection closed gracefully")
    }

    // Reset cache
    cached.conn = null
    cached.promise = null
  } catch (err) {
    logger.error("Error during graceful shutdown:", {
      error: err.message,
      signal,
    })
  }

  process.exit(0)
}

// Handle multiple shutdown signals
if (typeof process !== "undefined") {
  process.on("SIGINT", () => gracefulShutdown("SIGINT"))
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
  process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")) // Nodemon restart

  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception:", {
      message: err.message,
      stack: err.stack,
    })
    gracefulShutdown("UNCAUGHT_EXCEPTION")
  })

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection:", {
      reason: reason?.message || reason,
      promise: promise.toString(),
    })
  })
}

export default connectToDatabase