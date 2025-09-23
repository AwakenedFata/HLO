"use client"
import styled from "styled-components"
import { Calendar, Tag, ArrowLeft, Clock, Search } from "lucide-react"
import { Poppins } from "next/font/google"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import Link from "next/link"
import { useState } from "react"

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
})

const ArticleContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding-top: 100px;
  font-family: ${poppins.style.fontFamily};
`

const BackButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #666;
  text-decoration: none;
  margin-bottom: 20px;
  font-size: 14px;
  transition: color 0.2s ease;

  &:hover {
    color: #f5a623;
  }
`

const ArticleLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 40px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 20px;
  }
`

const MainContent = styled.article`
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`

const CoverImage = styled.div`
  width: 100%;
  height: 400px;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const ArticleHeader = styled.div`
  padding: 30px;
  border-bottom: 1px solid #eee;
`

const ArticleTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: #333;
  margin-bottom: 20px;
  line-height: 1.2;
`

const ArticleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  color: #666;
  font-size: 14px;
  margin-bottom: 15px;
`

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 15px;
`

const TagBadge = styled.span`
  background: #f5a623;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
`

const ArticleContent = styled.div`
  padding: 30px;
  
  p {
    margin-bottom: 16px;
    line-height: 1.7;
    color: #444;
  }
  
  h2, h3, h4 {
    margin: 24px 0 16px 0;
    color: #333;
  }
  
  h2 {
    font-size: 1.8rem;
    font-weight: 600;
  }
  
  h3 {
    font-size: 1.4rem;
    font-weight: 600;
  }
  
  img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 20px 0;
  }
  
  blockquote {
    border-left: 4px solid #f5a623;
    padding-left: 20px;
    margin: 20px 0;
    font-style: italic;
    color: #666;
  }
`

const Sidebar = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 30px;
`

const SidebarSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`

const SidebarTitle = styled.h3`
  font-size: 1.2rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f5a623;
`

const RecentArticleItem = styled(Link)`
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #eee;
  text-decoration: none;
  color: inherit;
  transition: background 0.2s ease;
  
  &:hover {
    background: #f9f9f9;
    border-radius: 8px;
    padding: 12px;
    margin: 0 -12px;
  }
  
  &:last-child {
    border-bottom: none;
  }
`

const RecentArticleImage = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const RecentArticleContent = styled.div`
  flex: 1;
`

const RecentArticleTitle = styled.h4`
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const RecentArticleDate = styled.span`
  font-size: 12px;
  color: #666;
`

const DiscoveredTopicItem = styled(Link)`
  display: block;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 8px;
  margin-bottom: 12px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #f5a623;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  &:last-child {
    margin-bottom: 0;
  }
`

const TopicLabel = styled.span`
  background: #f5a623;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  margin-bottom: 8px;
  display: inline-block;
`

const TopicTitle = styled.h4`
  font-size: 14px;
  font-weight: 500;
  color: #333;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const LabelGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  margin-top: 15px;
`

const LabelItem = styled.button`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  color: #495057;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  
  &:hover {
    background: #f5a623;
    color: white;
    border-color: #f5a623;
    transform: translateY(-1px);
  }
`

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 15px;
  
  &:focus {
    outline: none;
    border-color: #f5a623;
  }
`

const FilteredArticlesSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
`

const FilteredArticleItem = styled(Link)`
  display: flex;
  gap: 15px;
  padding: 15px 0;
  border-bottom: 1px solid #eee;
  text-decoration: none;
  color: inherit;
  transition: background 0.2s ease;
  
  &:hover {
    background: #f9f9f9;
    border-radius: 8px;
    padding: 15px;
    margin: 0 -15px;
  }
  
  &:last-child {
    border-bottom: none;
  }
`

const FilteredArticleImage = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

const FilteredArticleContent = styled.div`
  flex: 1;
`

const FilteredArticleTitle = styled.h4`
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const FilteredArticleExcerpt = styled.p`
  font-size: 14px;
  color: #666;
  line-height: 1.4;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const FilteredArticleDate = styled.span`
  font-size: 12px;
  color: #999;
`

const ClearFilterButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 15px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  margin-left: 10px;
  transition: background 0.2s ease;
  
  &:hover {
    background: #c82333;
  }
`

const GalleryArticlePage = ({
  article,
  recentArticles = [],
  discoveredTopics = [],
  allLabels = [],
  allArticles = [],
}) => {
  const [labelSearch, setLabelSearch] = useState("")
  const [selectedLabel, setSelectedLabel] = useState("")

  const formatDate = (date) => {
    if (!date) return ""
    return format(new Date(date), "dd MMMM yyyy", { locale: id })
  }

  const formatContentWithImages = (content, contentImages = []) => {
    if (!content) return ""

    const paragraphs = content.split("\n").filter((p) => p.trim())
    const totalParagraphs = paragraphs.length
    const totalImages = contentImages.length

    if (totalImages === 0) {
      return paragraphs
        .map((paragraph, index) => {
          if (paragraph.trim()) {
            return `<p key="${index}">${paragraph.trim()}</p>`
          }
          return ""
        })
        .join("")
    }

    const imageInsertPoints = []
    if (totalImages > 0 && totalParagraphs > 1) {
      const interval = Math.max(2, Math.floor(totalParagraphs / (totalImages + 1)))
      for (let i = 1; i <= totalImages; i++) {
        const insertPoint = Math.min(interval * i, totalParagraphs - 1)
        imageInsertPoints.push(insertPoint)
      }
    }

    let result = ""
    let imageIndex = 0

    paragraphs.forEach((paragraph, index) => {
      if (paragraph.trim()) {
        result += `<p key="${index}">${paragraph.trim()}</p>`
      }

      if (imageInsertPoints.includes(index + 1) && imageIndex < contentImages.length) {
        const image = contentImages[imageIndex]
        result += `<div style="margin: 30px 0; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 12px;">
          <img src="${image.url}" 
               alt="${image.originalName || `Gambar ${imageIndex + 1}`}" 
               style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
          ${image.originalName ? `<p style="font-size: 13px; color: #666; margin-top: 12px; font-style: italic; font-weight: 500;">${image.originalName}</p>` : ""}
        </div>`
        imageIndex++
      }
    })

    while (imageIndex < contentImages.length) {
      const image = contentImages[imageIndex]
      result += `<div style="margin: 30px 0; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 12px;">
        <img src="${image.url}" 
             alt="${image.originalName || `Gambar ${imageIndex + 1}`}" 
             style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
        ${image.originalName ? `<p style="font-size: 13px; color: #666; margin-top: 12px; font-style: italic; font-weight: 500;">${image.originalName}</p>` : ""}
      </div>`
      imageIndex++
    }

    return result
  }

  const filteredLabels = allLabels.filter((label) => label.toLowerCase().includes(labelSearch.toLowerCase()))

  const getFilteredArticles = () => {
    if (!selectedLabel) return []
    return allArticles.filter(
      (articleItem) => articleItem.relatedGallery?.label === selectedLabel && articleItem._id !== article._id,
    )
  }

  const filteredArticles = getFilteredArticles()

  return (
    <ArticleContainer>
      <BackButton href="/gallery">
        <ArrowLeft size={16} />
        Kembali ke Gallery
      </BackButton>

      <ArticleLayout>
        <MainContent>
          {article.coverImage && (
            <CoverImage>
              <img src={article.coverImage || "/placeholder.svg"} alt={article.title} />
            </CoverImage>
          )}

          <ArticleHeader>
            <ArticleTitle>{article.title}</ArticleTitle>

            <ArticleMeta>
              {article.publishedAt && (
                <MetaItem>
                  <Calendar size={16} />
                  {formatDate(article.publishedAt)}
                </MetaItem>
              )}

              <MetaItem>
                <Clock size={16} />
                {Math.ceil(article.content?.length / 1000) || 1} menit baca
              </MetaItem>

              {article.relatedGallery?.label && (
                <MetaItem>
                  <Tag size={16} />
                  {article.relatedGallery.label}
                </MetaItem>
              )}
            </ArticleMeta>

            {article.excerpt && (
              <p style={{ fontSize: "1.1rem", color: "#666", fontStyle: "italic", marginBottom: "20px" }}>
                {article.excerpt}
              </p>
            )}

            {article.tags && article.tags.length > 0 && (
              <TagsContainer>
                {article.tags.map((tag, index) => (
                  <TagBadge key={index}>{tag}</TagBadge>
                ))}
              </TagsContainer>
            )}
          </ArticleHeader>

          <ArticleContent>
            <div
              dangerouslySetInnerHTML={{
                __html: formatContentWithImages(article.content, article.contentImages),
              }}
            />
          </ArticleContent>
        </MainContent>

        <Sidebar>
          {selectedLabel && filteredArticles.length > 0 && (
            <FilteredArticlesSection>
              <SidebarTitle>
                Artikel dengan Label: {selectedLabel}
                <ClearFilterButton onClick={() => setSelectedLabel("")}>Hapus Filter</ClearFilterButton>
              </SidebarTitle>
              {filteredArticles.map((filteredArticle) => (
                <FilteredArticleItem key={filteredArticle._id} href={`/article/${filteredArticle.slug}`}>
                  <FilteredArticleImage>
                    <img src={filteredArticle.coverImage || "/placeholder.svg"} alt={filteredArticle.title} />
                  </FilteredArticleImage>
                  <FilteredArticleContent>
                    <FilteredArticleTitle>{filteredArticle.title}</FilteredArticleTitle>
                    {filteredArticle.excerpt && (
                      <FilteredArticleExcerpt>{filteredArticle.excerpt}</FilteredArticleExcerpt>
                    )}
                    <FilteredArticleDate>{formatDate(filteredArticle.publishedAt)}</FilteredArticleDate>
                  </FilteredArticleContent>
                </FilteredArticleItem>
              ))}
            </FilteredArticlesSection>
          )}

          {allLabels.length > 0 && (
            <SidebarSection>
              <SidebarTitle>
                <Search size={16} style={{ marginRight: "8px", display: "inline" }} />
                Jelajahi Berdasarkan Label
              </SidebarTitle>
              <SearchInput
                type="text"
                placeholder="Cari label..."
                value={labelSearch}
                onChange={(e) => setLabelSearch(e.target.value)}
              />
              <LabelGrid>
                {filteredLabels.map((label, index) => (
                  <LabelItem
                    key={index}
                    onClick={() => setSelectedLabel(label)}
                    style={{
                      background: selectedLabel === label ? "#f5a623" : "#f8f9fa",
                      color: selectedLabel === label ? "white" : "#495057",
                      borderColor: selectedLabel === label ? "#f5a623" : "#e9ecef",
                    }}
                  >
                    {label}
                  </LabelItem>
                ))}
              </LabelGrid>
            </SidebarSection>
          )}

          {!selectedLabel && recentArticles.length > 0 && (
            <SidebarSection>
              <SidebarTitle>Artikel Terbaru</SidebarTitle>
              {recentArticles.map((recentArticle) => (
                <RecentArticleItem key={recentArticle._id} href={`/article/${recentArticle.slug}`}>
                  <RecentArticleImage>
                    <img src={recentArticle.coverImage || "/placeholder.svg"} alt={recentArticle.title} />
                  </RecentArticleImage>
                  <RecentArticleContent>
                    <RecentArticleTitle>{recentArticle.title}</RecentArticleTitle>
                    <RecentArticleDate>{formatDate(recentArticle.publishedAt)}</RecentArticleDate>
                  </RecentArticleContent>
                </RecentArticleItem>
              ))}
            </SidebarSection>
          )}

          {!selectedLabel && discoveredTopics.length > 0 && (
            <SidebarSection>
              <SidebarTitle>Topik Serupa: {article.relatedGallery?.label}</SidebarTitle>
              {discoveredTopics.map((topic) => (
                <DiscoveredTopicItem key={topic._id} href={`/article/${topic.slug}`}>
                  {topic.relatedGallery?.label && <TopicLabel>{topic.relatedGallery.label}</TopicLabel>}
                  <TopicTitle>{topic.title}</TopicTitle>
                </DiscoveredTopicItem>
              ))}
            </SidebarSection>
          )}

          {article.relatedGallery && (
            <SidebarSection>
              <SidebarTitle>Galeri Terkait</SidebarTitle>
              <div style={{ textAlign: "center" }}>
                <img
                  src={article.relatedGallery.imageUrl || "/placeholder.svg"}
                  alt={article.relatedGallery.title}
                  style={{ width: "100%", borderRadius: "8px", marginBottom: "15px" }}
                />
                <h4 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>
                  {article.relatedGallery.title}
                </h4>
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
                  {article.relatedGallery.location}
                </p>
                <TopicLabel>{article.relatedGallery.label}</TopicLabel>
              </div>
            </SidebarSection>
          )}
        </Sidebar>
      </ArticleLayout>
    </ArticleContainer>
  )
}

export default GalleryArticlePage