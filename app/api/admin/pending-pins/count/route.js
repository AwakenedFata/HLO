import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import logger from "@/lib/utils/logger-server"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdminSession } from "@/lib/utils/auth"

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
  limit: 60,
  identifier: "pending-pins-count",
})

export async function GET(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "anonymous"

    try {
      await limiter.check(identifier)
    } catch (rateLimitError) {
      if (rateLimitError.statusCode === 429) {
        logger.warn(`Rate limit exceeded for pending-pins-count: ${identifier}`)
        return NextResponse.json(
          {
            error: "Too many requests. Please try again later.",
            reset: rateLimitError.rateLimitInfo?.reset || 60,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(rateLimitError.rateLimitInfo?.reset || 60),
              "X-RateLimit-Limit": String(rateLimitError.rateLimitInfo?.limit || 60),
              "X-RateLimit-Remaining": String(rateLimitError.rateLimitInfo?.remaining || 0),
              "X-RateLimit-Reset": String(rateLimitError.rateLimitInfo?.reset || 60),
            },
          },
        )
      }
      throw rateLimitError
    }

    // Use lightweight session check and avoid DB if unauthorized
    const auth = await requireAdminSession()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status })
    }
    const session = auth.session

    await connectToDatabase()

    const count = await PinCode.countDocuments({ used: true, processed: false })
    logger.info(`Pending pins count fetched by ${session.user.email}: ${count}`)

    const roundedTime = Math.floor(Date.now() / 30000) * 30000
    const etag = `"count-${count}-${roundedTime}"`

    const ifNoneMatch = request.headers.get("if-none-match")
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=15, must-revalidate",
        },
      })
    }

    return NextResponse.json(
      { count, lastUpdated: new Date() },
      {
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=15, must-revalidate",
        },
      },
    )
  } catch (error) {
    if (error.statusCode !== 429) {
      logger.error("Error fetching pending pins count:", error)
    }

    return NextResponse.json({ error: "Server error", message: error.message }, { status: error.statusCode || 500 })
  }
}
