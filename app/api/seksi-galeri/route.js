import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Gallery from "@/lib/models/galleryItems"
import Frame from "@/lib/models/frame"

export async function GET() {
  try {
    await connectToDatabase()

    // Fetch active galleries with their related frames
    const galleries = await Gallery.find({ isActive: true }).sort({ uploadDate: -1 }).limit(10).lean()

    // Fetch frames for each gallery
    const galleriesWithFrames = await Promise.all(
      galleries.map(async (gallery) => {
        const frame = await Frame.findOne({
          relatedGallery: gallery._id,
          isActive: true,
        }).lean()

        return {
          ...gallery,
          frame: frame || null,
        }
      }),
    )

    return NextResponse.json({
      success: true,
      data: galleriesWithFrames,
    })
  } catch (error) {
    console.error("Error fetching galleries with frames:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch gallery data",
      },
      { status: 500 },
    )
  }
}
