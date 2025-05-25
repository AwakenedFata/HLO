import { NextResponse } from "next/server"
import { checkDatabaseHealth } from "@/lib/db"
import { dbMonitor } from "@/lib/utils/db-monitor"
import logger from "@/lib/utils/logger"

export async function GET() {
  try {
    const health = await checkDatabaseHealth()
    const metrics = dbMonitor.getMetrics()

    const response = {
      timestamp: new Date().toISOString(),
      database: health,
      metrics,
      environment: process.env.NODE_ENV,
    }

    const status = health.status === "healthy" ? 200 : 503

    return NextResponse.json(response, { status })
  } catch (error) {
    logger.error("Health check endpoint error:", { error: error.message })

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        database: { status: "error", error: error.message },
        environment: process.env.NODE_ENV,
      },
      { status: 503 },
    )
  }
}
