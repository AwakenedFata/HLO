import logger from "@/lib/utils/logger"

// Only run this in server environment
if (typeof window === "undefined") {
  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    logger.error("UNCAUGHT EXCEPTION! 💥", {
      name: err.name,
      message: err.message,
      stack: err.stack,
    })

    // In production, we might want to gracefully restart the process
    // rather than crashing it immediately
    if (process.env.NODE_ENV === "production") {
      console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...")
      process.exit(1)
    }
  })

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("UNHANDLED REJECTION! 💥", {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
    })

    // In production, we might want to gracefully restart the process
    // rather than crashing it immediately
    if (process.env.NODE_ENV === "production") {
      console.error("UNHANDLED REJECTION! 💥 Shutting down...")
      process.exit(1)
    }
  })
}

// Initialize process handlers (this is imported in app/layout.js)
export function initProcessHandlers() {
  // This function doesn't need to do anything, just importing the file
  // is enough to set up the handlers
}
