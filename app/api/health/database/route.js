import { NextResponse } from "next/server"
import dbConnect, { checkDatabaseHealth } from "@/lib/db"
import { dbMonitor } from "@/lib/utils/db-monitor"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    // Connect to database
    await dbConnect()

    // Attach monitoring listeners (only once)
    dbMonitor.attachListeners()

    // Check health
    const health = await checkDatabaseHealth()
    const metrics = dbMonitor.getMetrics()

    return NextResponse.json(
      {
        success: health.status === "healthy",
        database: health,
        metrics,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      },
      {
        status: health.status === "healthy" ? 200 : 503,
      },
    )
  } catch (error) {
    console.error("Health check error:", error)

    return NextResponse.json(
      {
        success: false,
        status: "error",
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
      },
    )
  }
}
