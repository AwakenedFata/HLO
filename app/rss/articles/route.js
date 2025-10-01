import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import Article from "@/lib/models/article"

export async function GET() {
  await connectToDatabase()

  // ambil 10 artikel terbaru yang published
  const articles = await Article.find({ status: "published", isActive: true })
    .sort({ publishedAt: -1 })
    .limit(10)

  const rssItems = articles
    .map(
      (item) => `
      <item>
        <title><![CDATA[${item.title}]]></title>
        <link>https://hoklampung.com/article/${item.slug}</link>
        <pubDate>${new Date(item.publishedAt || item.createdAt).toUTCString()}</pubDate>
        <description><![CDATA[${item.excerpt || item.content.substring(0, 200)}]]></description>
      </item>
    `
    )
    .join("")

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0">
    <channel>
      <title>HOK Lampung - Artikel</title>
      <link>https://hoklampung.com/article</link>
      <description>Update artikel terbaru dari HOK Lampung</description>
      ${rssItems}
    </channel>
  </rss>`

  return new NextResponse(rss, {
    headers: { "Content-Type": "application/xml" },
  })
}
