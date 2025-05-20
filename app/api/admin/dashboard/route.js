import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import logger from "@/lib/utils/logger-server"
import { authorize } from "@/lib/middleware/authMiddleware"
import { validateRequest, dashboardQuerySchema } from "@/lib/utils/validation"

export async function GET(request) {
  try {
    const authResult = await authorize("admin", "super-admin")(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: authResult.status })
    }
    
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    const validation = await validateRequest(dashboardQuerySchema, queryParams);
    
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 });
    }

    const { timeframe = "week" } = validation.data;
    logger.info(`Dashboard diakses dengan timeframe: ${timeframe}`);
    
    await connectToDatabase()
    
    const totalPins = await PinCode.countDocuments()
    const activePins = await PinCode.countDocuments({
      isActive: true,
    })
    const usedPins = await PinCode.countDocuments({
      "usedBy.0": { $exists: true },
    })
    const last7Days = new Date()
    last7Days.setDate(last7Days.getDate() - 7)
    const recentPins = await PinCode.find({
      createdAt: { $gte: last7Days },
    })
    .sort({ createdAt: -1 })
    .limit(10)
    const recentUsage = await PinCode.aggregate([
      { $unwind: "$usedBy" },
      { $sort: { "usedBy.usedAt": -1 } },
      { $limit: 10 },
      {
        $project: {
          code: 1,
          userId: "$usedBy.userId",
          usedAt: "$usedBy.usedAt",
          deviceInfo: "$usedBy.deviceInfo",
          ipAddress: "$usedBy.ipAddress",
        },
      },
    ])

    logger.info(`Statistik dashboard diakses oleh ${authResult.user.username}`)

    return NextResponse.json({
      status: "success",
      data: {
        stats: {
          totalPins,
          activePins,
          usedPins,
        },
        recentPins,
        recentUsage,
      },
    })
  } catch (err) {
    logger.error(`Error getting dashboard stats: ${err.message}`)
    return NextResponse.json(
      { status: "error", message: "Terjadi kesalahan saat mengambil statistik dashboard" },
      { status: 500 },
    )
  }
}