import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import UserMail from "@/lib/models/userMail"
import logger from "@/lib/utils/logger-server"
import crypto from "crypto"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdminSession } from "@/lib/utils/auth"

const getLimiter = rateLimit({
  interval: 60_000,
  uniqueTokenPerInterval: 100,
  limit: 30,
})

export async function GET(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await getLimiter.check(identifier, 30, "get-user-mails")

    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rate.reset },
        {
          status: 429,
          headers: {
            "Retry-After": rate.reset.toString(),
            "X-RateLimit-Limit": rate.limit.toString(),
            "X-RateLimit-Remaining": rate.remaining.toString(),
            "X-RateLimit-Reset": rate.reset.toString(),
          },
        },
      )
    }

    // Check admin session
    const guard = await requireAdminSession()
    if (!guard.ok) {
      return NextResponse.json({ status: "error", message: guard.message }, { status: guard.status })
    }
    const session = guard.session

    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10)
    const page = Number.parseInt(searchParams.get("page") || "1", 10)
    const skip = (page - 1) * limit
    const searchTerm = searchParams.get("search")
    const status = searchParams.get("status")
    const cacheBuster = searchParams.get("_t")
    const bypassCache = !!cacheBuster || request.headers.get("cache-control")?.includes("no-cache")

    if (Number.isNaN(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 })
    }
    if (Number.isNaN(limit) || limit < 1 || limit > 500) {
      return NextResponse.json({ error: "Invalid limit parameter (1-500)" }, { status: 400 })
    }

    // Build query
    const query = {}

    if (status && status !== "all") {
      if (status === "unread") {
        query.read = false
        query.archived = false
      } else if (status === "read") {
        query.read = true
        query.archived = false
      } else if (status === "archived") {
        query.archived = true
      }
    } else {
      query.archived = false // Default: show non-archived
    }

    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
        { subject: { $regex: searchTerm, $options: "i" } },
        { message: { $regex: searchTerm, $options: "i" } },
      ]
    }

    // Get total counts
    const totalAll = await UserMail.countDocuments({})
    const totalUnread = await UserMail.countDocuments({ read: false, archived: false })
    const totalRead = await UserMail.countDocuments({ read: true, archived: false })
    const totalArchived = await UserMail.countDocuments({ archived: true })
    const totalFiltered = await UserMail.countDocuments(query)

    // Fetch data
    const mails = await UserMail.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()

    logger.info(`User mails fetched by ${session.user?.email}, page: ${page}, limit: ${limit}`)

    const headers = {
      "X-Total-Count": totalFiltered.toString(),
      "X-Total-Pages": Math.ceil(totalFiltered / limit).toString(),
    }

    if (bypassCache) {
      headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
      headers["Pragma"] = "no-cache"
      headers["Expires"] = "0"
    } else {
      headers["Cache-Control"] = "private, max-age=30"
      const dataHash = crypto
        .createHash("md5")
        .update(JSON.stringify({ mails, stats: { totalAll, totalUnread, totalRead, totalArchived } }))
        .digest("hex")
      headers["ETag"] = `"mails-${dataHash}"`
      const ifNoneMatch = request.headers.get("if-none-match")
      if (ifNoneMatch === headers["ETag"]) {
        return new NextResponse(null, { status: 304, headers })
      }
    }

    return NextResponse.json(
      {
        mails,
        total: totalFiltered,
        page,
        totalPages: Math.ceil(totalFiltered / limit),
        stats: {
          total: totalAll,
          unread: totalUnread,
          read: totalRead,
          archived: totalArchived,
        },
      },
      { headers },
    )
  } catch (error) {
    logger.error("Error fetching user mails:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
