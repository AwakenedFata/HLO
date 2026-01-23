import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Gallery from "@/lib/models/galleryItems"
import Frame from "@/lib/models/frame"

export async function GET() {
  try {
    await connectToDatabase()

    const galleries = await Gallery.find({ isActive: true })
      .sort({ uploadDate: -1 })
      .limit(10)
      .lean()
      .select("title label imageUrl location mapLink uploadDate _id formattedUploadDate")

    const galleriesWithFrames = await Frame.aggregate([
      {
        $match: {
          relatedGallery: { $in: galleries.map((g) => g._id) },
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$relatedGallery",
          frame: { $first: "$$ROOT" },
        },
      },
      {
        $project: {
          _id: 1,
          "frame.imageUrl": 1,
          "frame._id": 1,
        },
      },
    ])

    const frameMap = new Map(galleriesWithFrames.map((f) => [f._id.toString(), f.frame]))

    const result = galleries.map((gallery) => ({
      ...gallery,
      _id: gallery._id.toString(),
      frame: frameMap.get(gallery._id.toString()) || null,
    }))

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error("Error fetching galleries:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch gallery data" }, { status: 500 })
  }
}