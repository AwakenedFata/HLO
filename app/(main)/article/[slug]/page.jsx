import connectToDatabase from "@/lib/db"
import Article from "@/lib/models/article"
import Gallery from "@/lib/models/galleryItems"
import GalleryArticlePage from "@/components/pages/GalleryArticlePage"
import { notFound } from "next/navigation"

export default async function ArticleDetailPage({ params }) {
  const { slug } = await params

  try {
    await connectToDatabase()

    const article = await Article.findOne({
      slug,
      isActive: true,
      status: "published",
    })
      .populate("relatedGallery")
      .lean()

    if (!article) {
      notFound()
    }

    const recentArticles = await Article.find({
      isActive: true,
      status: "published",
      _id: { $ne: article._id },
    })
      .sort({ publishedAt: -1 })
      .limit(5)
      .select("title slug coverImage publishedAt")
      .lean()

    let discoveredTopics = []
    if (article.relatedGallery?.label) {
      const relatedGalleries = await Gallery.find({
        label: article.relatedGallery.label,
        isActive: true,
        _id: { $ne: article.relatedGallery._id },
      })
        .limit(6)
        .lean()

      // Find articles related to these galleries
      const relatedGalleryIds = relatedGalleries.map((g) => g._id)
      discoveredTopics = await Article.find({
        relatedGallery: { $in: relatedGalleryIds },
        isActive: true,
        status: "published",
        _id: { $ne: article._id },
      })
        .populate("relatedGallery")
        .sort({ publishedAt: -1 })
        .limit(6)
        .lean()
    }

    const allLabels = await Gallery.distinct("label", { isActive: true })

    const allArticles = await Article.find({
      isActive: true,
      status: "published",
    })
      .populate("relatedGallery")
      .select("title slug coverImage publishedAt excerpt relatedGallery")
      .sort({ publishedAt: -1 })
      .lean()

    const articleData = JSON.parse(JSON.stringify(article))
    const recentArticlesData = JSON.parse(JSON.stringify(recentArticles))
    const discoveredTopicsData = JSON.parse(JSON.stringify(discoveredTopics))
    const allArticlesData = JSON.parse(JSON.stringify(allArticles))

    return (
      <GalleryArticlePage
        article={articleData}
        recentArticles={recentArticlesData}
        discoveredTopics={discoveredTopicsData}
        allLabels={allLabels}
        allArticles={allArticlesData}
      />
    )
  } catch (error) {
    console.error("Error fetching article:", error)
    notFound()
  }
}

export async function generateMetadata({ params }) {
  // Await params before destructuring
  const { slug } = await params

  try {
    await connectToDatabase()
    const article = await Article.findOne({
      slug,
      isActive: true,
      status: "published",
    }).lean()

    if (!article) {
      return {
        title: "Article Not Found",
      }
    }

    return {
      title: article.title,
      description: article.excerpt || article.title,
      openGraph: {
        title: article.title,
        description: article.excerpt || article.title,
        images: article.coverImage ? [article.coverImage] : [],
      },
    }
  } catch (error) {
    return {
      title: "Article Not Found",
    }
  }
}