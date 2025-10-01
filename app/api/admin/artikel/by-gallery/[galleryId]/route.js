import connectToDatabase from "@/lib/db"
import Article from "@/lib/models/article"
import { NextResponse } from "next/server"

export async function GET(request, { params }) {
  try {
    const { galleryId } = params

    await connectToDatabase()

    const article = await Article.findOne({
      relatedGallery: galleryId,
      isActive: true,
      status: "published",
    })
      .select("slug title coverImage coverImageKey excerpt content tags publishedAt contentImages")
      .populate("relatedGallery", "title label location imageUrl")
      .lean()

    if (!article) {
      return NextResponse.json(
        {
          success: false,
          message: "Artikel tidak ditemukan",
        },
        { status: 404 },
      )
    }

    console.log("[v0] Article found:", {
      id: article._id,
      title: article.title,
      coverImage: article.coverImage,
      coverImageKey: article.coverImageKey,
      hasRelatedGallery: !!article.relatedGallery,
    })

    return NextResponse.json({
      success: true,
      article,
    })
  } catch (error) {
    console.error("Error fetching article by gallery:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan server",
      },
      { status: 500 },
    )
  }
}
