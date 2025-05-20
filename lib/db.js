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

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }

    // Log connection attempt
    logger.info("Attempting to connect to MongoDB...")

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongoose) => {
        logger.info("✅ MongoDB connected successfully")
        return mongoose
      })
      .catch((err) => {
        logger.error("❌ MongoDB connection error:", {
          message: err.message,
          code: err.code,
          // Hide credentials in connection string for logging
          connectionString: MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//\\1:****@"),
        })
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

// Handle graceful shutdown
if (typeof process !== "undefined") {
  process.on("SIGINT", async () => {
    logger.info("SIGINT received, closing MongoDB connection...")

    try {
      if (cached.conn) {
        await mongoose.connection.close()
        logger.info("MongoDB connection closed")
      }
    } catch (err) {
      logger.error("Error closing MongoDB connection:", {
        error: err.message,
      })
    }

    process.exit(0)
  })
}

export default connectToDatabase
