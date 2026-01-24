"use client"
import styled from "styled-components"
import { Calendar, Tag, ArrowLeft, Clock, Search } from "lucide-react"
import { Poppins } from "next/font/google"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import Link from "next/link"
import Image from "next/image"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
})

// Helper to check if image is from external source (R2 storage) - REMOVED to enable optimization
// const isExternalImage = (url) => { ... };

const ArticleContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 100px 20px 40px;
  font-family: ${poppins.style.fontFamily};

  @media (max-width: 768px) {
    padding: 80px 15px 30px;
  }
`

const BackButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #666;
  text-decoration: none;
  margin-bottom: 20px;
  font-size: 14px;
  transition: color 0.2s ease;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: #f5a623;
  }
`

const ArticleLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 40px;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr 250px;
    gap: 30px;
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 25px;
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
  border-radius: 12px;
  position: relative;
  
  @media (max-width: 768px) {
    height: 250px;
  }
`

const ArticleHeader = styled.div`
  padding: 30px;
  border-bottom: 1px solid #eee;

  @media (max-width: 768px) {
    padding: 20px;
  }
`

const ArticleTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  color: #333;
  margin-bottom: 20px;
  line-height: 1.2;

  @media (max-width: 768px) {
    font-size: 1.8rem;
  }
`

const ArticleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  color: #666;
  font-size: 14px;
  margin-bottom: 15px;

  @media (max-width: 768px) {
    gap: 15px;
    font-size: 13px;
  }
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
  text-align: justify;
  
  @media (max-width: 768px) {
    padding: 20px;
  }
  
  p {
    margin-bottom: 16px;
    line-height: 1.7;
    color: #444;
    font-size: 16px;

    @media (max-width: 768px) {
      font-size: 15px;
      line-height: 1.6;
    }
  }
  
  h2, h3, h4 {
    margin: 24px 0 16px 0;
    color: #333;
  }
  
  h2 {
    font-size: 1.8rem;
    font-weight: 600;

    @media (max-width: 768px) {
      font-size: 1.4rem;
    }
  }
  
  h3 {
    font-size: 1.4rem;
    font-weight: 600;

    @media (max-width: 768px) {
      font-size: 1.2rem;
    }
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

  @media (max-width: 768px) {
    gap: 20px;
  }
`

const SidebarSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  @media (max-width: 1024px) {
    padding: 20px;
  }

  @media (max-width: 768px) {
    padding: 20px;
  }
`

const SidebarTitle = styled.h3`
  font-size: 1.2rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f5a623;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;

  @media (max-width: 1024px) {
    font-size: 1.1rem;
  }

  @media (max-width: 768px) {
    font-size: 1rem;
    margin-bottom: 15px;
  }
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
  position: relative;
  
  @media (max-width: 768px) {
    width: 50px;
    height: 50px;
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

  @media (max-width: 768px) {
    font-size: 13px;
  }
`

const RecentArticleDate = styled.span`
  font-size: 12px;
  color: #666;

  @media (max-width: 768px) {
    font-size: 11px;
  }
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

  @media (max-width: 768px) {
    padding: 12px;
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

  @media (max-width: 768px) {
    font-size: 13px;
  }
`

const LabelGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  margin-top: 15px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 6px;
  }
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

  @media (max-width: 768px) {
    padding: 6px 10px;
    font-size: 11px;
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

  @media (max-width: 768px) {
    font-size: 13px;
    padding: 8px 10px;
  }
`

const FilteredArticlesSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;

  @media (max-width: 768px) {
    padding: 20px;
    margin-bottom: 20px;
  }
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

  @media (max-width: 768px) {
    gap: 12px;
    padding: 12px 0;
  }
`

const FilteredArticleImage = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  
  @media (max-width: 768px) {
    width: 60px;
    height: 60px;
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

  @media (max-width: 768px) {
    font-size: 14px;
  }
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

  @media (max-width: 768px) {
    font-size: 13px;
  }
`

const FilteredArticleDate = styled.span`
  font-size: 12px;
  color: #999;

  @media (max-width: 768px) {
    font-size: 11px;
  }
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

  @media (max-width: 768px) {
    padding: 5px 10px;
    font-size: 11px;
    margin-left: 0;
    margin-top: 5px;
  }
`

const RelatedGalleryImage = styled(Image)`
  width: 100%;
  max-width: 200px;
  height: auto;
  border-radius: 8px;
  margin: 0 auto 15px;
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  @media (max-width: 1024px) {
    max-width: 180px;
  }

  @media (max-width: 768px) {
    max-width: 160px;
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
  const [formattedContent, setFormattedContent] = useState("")

  const formatDate = (date) => {
    if (!date) return ""
    return format(new Date(date), "dd MMMM yyyy", { locale: id })
  }

  const imagePlacements = useMemo(() => {
    if (!article.content || !article.contentImages || article.contentImages.length === 0) {
      return {}
    }

    const paragraphs = article.content.split("\n").filter((p) => p.trim())
    const totalParagraphs = paragraphs.length
    const images = Array.isArray(article.contentImages) ? article.contentImages.filter(Boolean) : []

    if (images.length === 0 || totalParagraphs === 0) {
      return {}
    }

    const availablePositions = totalParagraphs > 1 ? totalParagraphs - 1 : 0
    
    if (availablePositions === 0) {
      return {}
    }

    const seed = article._id ? article._id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0
    
    let seedValue = seed
    const seededRandom = () => {
      seedValue = (seedValue * 9301 + 49297) % 233280
      return seedValue / 233280
    }

    const gaps = Array.from({ length: availablePositions }, (_, i) => i)

    for (let i = gaps.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1))
      ;[gaps[i], gaps[j]] = [gaps[j], gaps[i]]
    }

    const placements = {}
    images.forEach((img, idx) => {
      const gapIdx = gaps[idx % gaps.length]
      if (!placements[gapIdx]) placements[gapIdx] = []
      placements[gapIdx].push(img)
    })

    return placements
  }, [article._id, article.content, article.contentImages])

  useEffect(() => {
    if (!article.content) {
      setFormattedContent("")
      return
    }

    const paragraphs = article.content.split("\n").filter((p) => p.trim())
    
    if (!article.contentImages || article.contentImages.length === 0) {
      const simpleHtml = paragraphs
        .map((paragraph, index) => (paragraph.trim() ? `<p key="p-${index}">${paragraph.trim()}</p>` : ""))
        .join("")
      setFormattedContent(simpleHtml)
      return
    }

    let result = ""
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.trim()) {
        result += `<p key="p-${index}">${paragraph.trim()}</p>`
      }

      const imgsHere = imagePlacements[index] || []
      if (imgsHere.length > 0) {
        imgsHere.forEach((image, i) => {
          result += `<div style="margin: 20px 0; text-align: center; padding: 12px; background: #f8f9fa; border-radius: 8px;">
            <img src="${image.url}" 
                 alt="${image.originalName || `Gambar ${i + 1}`}" 
                 style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
            
          </div>`
        })
      }
    })

    setFormattedContent(result)
  }, [article.content, article.contentImages, imagePlacements])

  const filteredLabels = allLabels.filter((label) => label.toLowerCase().includes(labelSearch.toLowerCase()))

  const getFilteredArticles = () => {
    if (!selectedLabel) return []
    return allArticles.filter(
      (articleItem) => articleItem.relatedGallery?.label === selectedLabel && articleItem._id !== article._id,
    )
  }

  const filteredArticles = getFilteredArticles()

  const router = useRouter()

  const handleBackToGallery = () => {
    // Scroll to top first
    window.scrollTo({ top: 0, behavior: "instant" })
    // Navigate to gallery (pagination will be restored from sessionStorage)
    router.push("/gallery")
  }

  return (
    <ArticleContainer>
      <BackButton onClick={handleBackToGallery}>
        <ArrowLeft size={16} />
        Kembali ke Gallery
      </BackButton>

      <ArticleLayout>
        <MainContent>
          {article.coverImage && (
            <CoverImage>
               <Image 
                src={article.coverImage || "/placeholder.svg"} 
                alt={article.title}
                fill
                style={{ objectFit: 'cover' }}
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 800px"
                // unoptimized={isExternalImage(article.coverImage)} // ENABLED OPTIMIZATION
              />
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
            <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
          </ArticleContent>
        </MainContent>

        <Sidebar>
          {selectedLabel && filteredArticles.length > 0 && (
            <FilteredArticlesSection>
              <SidebarTitle>
                <span>Artikel dengan Label: {selectedLabel}</span>
                <ClearFilterButton 
                  onClick={() => setSelectedLabel("")}
                  suppressHydrationWarning
                >
                  Hapus Filter
                </ClearFilterButton>
              </SidebarTitle>
              {filteredArticles.map((filteredArticle) => (
                <FilteredArticleItem key={filteredArticle._id} href={`/article/${filteredArticle.slug}`}>
                  <FilteredArticleImage>
                    <Image 
                      src={filteredArticle.coverImage || "/placeholder.svg"} 
                      alt={filteredArticle.title}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="80px"
                      loading="eager"
                      // unoptimized={isExternalImage(filteredArticle.coverImage)} // ENABLED OPTIMIZATION
                    />
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
                suppressHydrationWarning
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
                    suppressHydrationWarning
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
                    <Image 
                      src={recentArticle.coverImage || "/placeholder.svg"} 
                      alt={recentArticle.title}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="60px"
                      loading="eager"
                      // unoptimized={isExternalImage(recentArticle.coverImage)} // ENABLED OPTIMIZATION
                    />
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
                <RelatedGalleryImage
                  src={article.relatedGallery.imageUrl || "/placeholder.svg"}
                  alt={article.relatedGallery.title}
                  width={200}
                  height={200}
                  loading="eager"
                  // unoptimized={isExternalImage(article.relatedGallery.imageUrl)} // ENABLED OPTIMIZATION
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