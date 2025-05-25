import mongoose from "mongoose"
import logger from "@/lib/utils/logger"

/**
 * Database monitoring utilities for production
 */

export class DatabaseMonitor {
  constructor() {
    this.metrics = {
      connections: 0,
      queries: 0,
      errors: 0,
      lastError: null,
      uptime: Date.now(),
    }

    this.setupMonitoring()
  }

  setupMonitoring() {
    if (mongoose.connection.readyState === 1) {
      this.attachListeners()
    } else {
      mongoose.connection.once("connected", () => {
        this.attachListeners()
      })
    }
  }

  attachListeners() {
    const db = mongoose.connection

    // Monitor connection events
    db.on("connected", () => {
      this.metrics.connections++
      logger.info("Database monitor: Connection established")
    })

    db.on("error", (error) => {
      this.metrics.errors++
      this.metrics.lastError = {
        message: error.message,
        timestamp: new Date().toISOString(),
      }
      logger.error("Database monitor: Connection error", { error: error.message })
    })

    db.on("disconnected", () => {
      logger.warn("Database monitor: Connection lost")
    })

    // Monitor slow queries (if available)
    if (db.db) {
      db.db.on("commandStarted", (event) => {
        this.metrics.queries++
      })
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      connectionState: mongoose.connection.readyState,
      connectionStates: {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting",
      },
      uptime: Date.now() - this.metrics.uptime,
    }
  }

  async getDetailedStatus() {
    try {
      const adminDb = mongoose.connection.db.admin()
      const serverStatus = await adminDb.serverStatus()

      return {
        metrics: this.getMetrics(),
        server: {
          version: serverStatus.version,
          uptime: serverStatus.uptime,
          connections: serverStatus.connections,
          memory: serverStatus.mem,
          network: serverStatus.network,
        },
      }
    } catch (error) {
      logger.error("Failed to get detailed database status:", { error: error.message })
      return {
        metrics: this.getMetrics(),
        error: error.message,
      }
    }
  }
}

// Singleton instance
export const dbMonitor = new DatabaseMonitor()
