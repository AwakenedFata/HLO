import connectToDatabase from "@/lib/db"
import Article from "@/lib/models/article"
import { NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/utils/auth"

export async function GET(request, { params }) {
  try {
    const auth = await requireAdminSession()
    if (!auth.ok) {
      return NextResponse.json({ status: "error", message: auth.message }, { status: auth.status })
    }

    const { galleryId } = await params
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
      return NextResponse.json({ success: false, message: "Artikel tidak ditemukan" }, { status: 404 })
    }

    return NextResponse.json({ success: true, article })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Terjadi kesalahan server" }, { status: 500 })
  }
}
