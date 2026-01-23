import mongoose from "mongoose"
import logger from "@/lib/utils/logger"

class DatabaseMonitor {
  constructor() {
    this.isMonitoring = false
    this.metrics = {
      connections: 0,
      queries: 0,
      errors: 0,
      lastError: null,
      uptime: Date.now(),
    }
  }

  attachListeners() {
    if (this.isMonitoring) return

    const connection = mongoose.connection

    if (!connection) {
      logger.warn("Database monitor: No connection available")
      return
    }

    if (connection.readyState === 0 || connection.readyState === 2) {
      connection.once("connected", () => {
        this.metrics.connections++
        logger.info("Database monitor: Connected to MongoDB")
      })
    } else if (connection.readyState === 1) {
      // Already connected
      this.metrics.connections++
      logger.info("Database monitor: Already connected to MongoDB")
    }

    connection.on("error", (err) => {
      this.metrics.errors++
      this.metrics.lastError = {
        message: err.message,
        timestamp: new Date().toISOString(),
      }
      logger.error("Database monitor: Connection error", { error: err.message })
    })

    connection.on("disconnected", () => {
      logger.warn("Database monitor: Disconnected from MongoDB")
    })

    connection.on("reconnected", () => {
      this.metrics.connections++
      logger.info("Database monitor: Reconnected to MongoDB")
    })

    this.isMonitoring = true
  }

  getStatus() {
    const connection = mongoose.connection

    if (!connection) {
      return {
        status: "disconnected",
        readyState: 0,
        message: "No connection available",
      }
    }

    const states = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    }

    return {
      status: states[connection.readyState] || "unknown",
      readyState: connection.readyState,
      host: connection.host,
      name: connection.name,
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      connectionState: mongoose.connection.readyState,
      uptime: Date.now() - this.metrics.uptime,
    }
  }

  async checkHealth() {
    try {
      const connection = mongoose.connection

      if (!connection || connection.readyState !== 1) {
        return {
          healthy: false,
          message: "Database not connected",
          readyState: connection?.readyState || 0,
        }
      }

      // Ping the database
      await connection.db.admin().ping()

      return {
        healthy: true,
        message: "Database connection is healthy",
        readyState: connection.readyState,
      }
    } catch (error) {
      logger.error("Database health check failed:", { error: error.message })
      return {
        healthy: false,
        message: error.message,
        error: error.toString(),
      }
    }
  }
}

export const dbMonitor = new DatabaseMonitor()
export default dbMonitor
