import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import logger from "@/lib/utils/logger-server"
import crypto from "crypto"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdminSession } from "@/lib/utils/auth"

const limiter = rateLimit({
  interval: 60 * 1000,
  uniqueTokenPerInterval: 100,
  limit: 40,
})

export async function GET(request) {
  try {
    // Rate limit
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await limiter.check(identifier, 40, "redemptions")
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

    // Auth first (lightweight)
    let session
    try {
      session = await requireAdminSession()
    } catch (err) {
      const status = err?.statusCode || 401
      return NextResponse.json({ error: err?.message || "Unauthorized" }, { status })
    }

    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "50", 10), 100)
    const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10), 1)
    const sortField = searchParams.get("sort") || "redeemedAt"
    const sortDirection = searchParams.get("direction") || "desc"
    const searchTerm = searchParams.get("search")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const cacheBuster = searchParams.get("_t")
    const bypassCache = !!cacheBuster || request.headers.get("cache-control")?.includes("no-cache")

    if (Number.isNaN(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 })
    }
    if (Number.isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid limit parameter (1-100)" }, { status: 400 })
    }

    const skip = (page - 1) * limit

    const matchStage = { used: true }
    if (searchTerm) {
      matchStage.$or = [
        { code: { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.nama": { $regex: searchTerm, $options: "i" } },
        { "redeemedBy.idGame": { $regex: searchTerm, $options: "i" } },
      ]
    }
    if (startDate || endDate) {
      const dateFilter = {}
      if (startDate) {
        const s = new Date(startDate)
        s.setHours(0, 0, 0, 0)
        dateFilter.$gte = s
      }
      if (endDate) {
        const e = new Date(endDate)
        e.setHours(23, 59, 59, 999)
        dateFilter.$lte = e
      }
      matchStage["redeemedBy.redeemedAt"] = dateFilter
    }

    const sortObj = {}
    if (sortField === "redeemedAt") sortObj["redeemedBy.redeemedAt"] = sortDirection === "asc" ? 1 : -1
    else if (sortField === "nama") sortObj["redeemedBy.nama"] = sortDirection === "asc" ? 1 : -1
    else if (sortField === "idGame") sortObj["redeemedBy.idGame"] = sortDirection === "asc" ? 1 : -1
    else if (sortField === "processed") sortObj["processed"] = sortDirection === "asc" ? 1 : -1
    else sortObj[sortField] = sortDirection === "asc" ? 1 : -1

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          redemptions: [
            { $sort: sortObj },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                code: 1,
                used: 1,
                processed: 1,
                processedAt: 1,
                redeemedBy: 1,
                createdAt: 1,
                redeemedAt: { $ifNull: ["$redeemedBy.redeemedAt", "$processedAt"] },
                nama: { $ifNull: ["$redeemedBy.nama", "Data tidak tersedia"] },
                idGame: { $ifNull: ["$redeemedBy.idGame", "Data tidak tersedia"] },
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ]

    const [result] = await PinCode.aggregate(pipeline)
    const redemptions = result.redemptions || []
    const totalCount = result.totalCount[0]?.count || 0

    const responseData = {
      redemptions,
      count: redemptions.length,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      lastUpdated: new Date(),
    }

    const headers = {
      "X-Total-Count": totalCount.toString(),
      "X-Total-Pages": Math.ceil(totalCount / limit).toString(),
    }

    if (bypassCache) {
      headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
      headers["Pragma"] = "no-cache"
      headers["Expires"] = "0"
    } else {
      headers["Cache-Control"] = "private, max-age=30"
      const dataHash = crypto.createHash("md5").update(JSON.stringify(responseData)).digest("hex")
      headers["ETag"] = `"redemptions-${dataHash}"`
      const ifNoneMatch = request.headers.get("if-none-match")
      if (ifNoneMatch === headers["ETag"]) {
        return new NextResponse(null, { status: 304, headers })
      }
    }

    logger.info(`Redemptions fetched by ${session.user?.email || "unknown"} — page ${page}, limit ${limit}`)

    return NextResponse.json(responseData, { headers })
  } catch (error) {
    logger.error("Error fetching redemptions:", error)
    return NextResponse.json({ error: "Server error", message: error.message }, { status: 500 })
  }
}
