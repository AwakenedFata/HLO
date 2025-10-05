import connectToDatabase from "@/lib/db"
import Article from "@/lib/models/article"
import { NextResponse } from "next/server"

export async function GET(request, { params }) {
  try {
    const { galleryId } = await params
    
    if (!galleryId) {
      return NextResponse.json(
        { success: false, message: "Gallery ID is required" }, 
        { status: 400 }
      )
    }
    
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
        { success: false, message: "Artikel tidak ditemukan" }, 
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, article })
  } catch (error) {
    console.error("[PUBLIC API] Error fetching article by gallery:", error)
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" }, 
      { status: 500 }
    )
  }
}