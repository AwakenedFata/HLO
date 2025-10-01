import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Gallery from "@/lib/models/galleryItems"

export async function GET() {
  await connectToDatabase()

  // ambil 10 gallery terbaru yang aktif
  const galleries = await Gallery.find({ isActive: true })
    .sort({ uploadDate: -1 })
    .limit(10)

  const rssItems = galleries
    .map(
      (item) => `
      <item>
        <title><![CDATA[${item.title} (${item.label})]]></title>
        <link>https://hoklampung.com/gallery</link>
        <pubDate>${new Date(item.uploadDate || item.createdAt).toUTCString()}</pubDate>
        <description><![CDATA[Gambar di ${item.location}. Klik untuk lihat lebih lanjut.]]></description>
        <enclosure url="${item.imageUrl}" type="image/jpeg" />
      </item>
    `
    )
    .join("")

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0">
    <channel>
      <title>HOK Lampung - Gallery</title>
      <link>https://hoklampung.com/gallery</link>
      <description>Update galeri terbaru dari HOK Lampung</description>
      ${rssItems}
    </channel>
  </rss>`

  return new NextResponse(rss, {
    headers: { "Content-Type": "application/xml" },
  })
}
