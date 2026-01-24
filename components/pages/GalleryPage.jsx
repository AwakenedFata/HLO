"use client"
import styled from "styled-components"
import { useState, useMemo, useEffect } from "react"
import GalleryCard from "@/components/cards/GalleryCard"
import Image from "next/image"

const WrapperGalleryPage = styled.div`
  padding-top: 32px;
  min-height: 100vh;

  @media (min-width: 640px) {
    padding-top: 40px;
  }
`

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
`

const BannerWrapper = styled.div`
  position: relative;
  width: 100%;
  height: clamp(100px, 28vw, 360px);
  margin-bottom: 32px;

  @media (min-width: 640px) {
    margin-bottom: 40px;
  }

  @media (min-width: 1024px) {
    margin-bottom: 50px;
  }
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  min-height: 400px;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    min-height: 500px;
    padding: 0 20px;
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 36px;
    min-height: 600px;
  }
`

const PaginationWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin: 28px 0 40px 0;
  padding: 0 16px;

  @media (min-width: 640px) {
    gap: 8px;
    margin: 32px 0 50px 0;
    padding: 0 20px;
  }
`

const PaginationButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: ${(props) => (props.$active ? "#f5a623" : "#ffffff")};
  color: ${(props) => (props.$active ? "#ffffff" : "#333333")};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  @media (min-width: 640px) {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }

  &:hover {
    background: ${(props) => (props.$active ? "#e6951f" : "#f5f5f5")};
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;

    &:hover {
      transform: none;
    }
  }
`

const PaginationArrow = styled(PaginationButton)`
  font-size: 22px;
  line-height: 1;
  padding-bottom: 4px;
  color: #666;

  @media (min-width: 640px) {
    font-size: 26px;
  }

  &:hover:not(:disabled) {
    background: #f5f5f5;
    color: #333;
  }
`

const PaginationDots = styled.span`
  font-size: 14px;
  color: #666;
  padding: 0 6px;

  @media (min-width: 640px) {
    font-size: 16px;
    padding: 0 8px;
  }
`

// Helper to check if image is from external source (R2 storage) - REMOVED to enable optimization
// const isExternalImage = (url) => { ... }

const GalleryPage = ({ banner, galleries }) => {
  const [currentPage, setCurrentPage] = useState(1)
  const [isInitialized, setIsInitialized] = useState(false)
  const itemsPerPage = 6

  // Restore pagination from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPage = sessionStorage.getItem("galleryCurrentPage")
      if (savedPage) {
        const pageNum = parseInt(savedPage, 10)
        const maxPage = Math.ceil(galleries.length / itemsPerPage)
        if (pageNum >= 1 && pageNum <= maxPage) {
          setCurrentPage(pageNum)
        }
      }
      setIsInitialized(true)
    }
  }, [galleries.length, itemsPerPage])

  // Save pagination to sessionStorage when it changes
  useEffect(() => {
    if (typeof window !== "undefined" && isInitialized) {
      sessionStorage.setItem("galleryCurrentPage", currentPage.toString())
    }
  }, [currentPage, isInitialized])

  const { totalPages, currentItems } = useMemo(() => {
    const total = Math.ceil(galleries.length / itemsPerPage)
    const indexOfLastItem = currentPage * itemsPerPage
    const indexOfFirstItem = indexOfLastItem - itemsPerPage
    const items = galleries.slice(indexOfFirstItem, indexOfLastItem)
    return { totalPages: total, currentItems: items }
  }, [galleries, currentPage, itemsPerPage])

  const getPaginationNumbers = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, "…")
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push("…", totalPages)
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
      setCurrentPage(currentPage + 1)
    }
  }

  return (
    <WrapperGalleryPage>
      <Wrapper>
        {banner && (
          <BannerWrapper>
            <Image
              src={banner.imageUrl || "/placeholder.svg?height=320&width=1200&query=gallery%20banner"}
              alt="Gallery Banner"
              fill
              priority
              sizes="100vw"
              style={{
                objectFit: "cover",
                objectPosition: "center",
              }}
              quality={75}
              // unoptimized={isExternalImage(banner.imageUrl)} // ENABLED OPTIMIZATION
            />
          </BannerWrapper>
        )}

        <Grid>
          {currentItems.map((item) => (
            <GalleryCard key={item._id} item={item} />
          ))}
        </Grid>

        {totalPages > 1 && (
          <PaginationWrapper>
            <PaginationArrow
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              aria-label="Halaman sebelumnya"
              title="Sebelumnya"
            >
              ‹
            </PaginationArrow>

            {getPaginationNumbers().map((number, index) => (
              <span key={index}>
                {number === "…" ? (
                  <PaginationDots aria-hidden>…</PaginationDots>
                ) : (
                  <PaginationButton
                    $active={currentPage === number}
                    onClick={() => handlePageChange(number)}
                    aria-current={currentPage === number ? "page" : undefined}
                    aria-label={`Ke halaman ${number}`}
                    title={`Halaman ${number}`}
                  >
                    {number}
                  </PaginationButton>
                )}
              </span>
            ))}

            <PaginationArrow
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              aria-label="Halaman berikutnya"
              title="Berikutnya"
            >
              ›
            </PaginationArrow>
          </PaginationWrapper>
        )}
      </Wrapper>
    </WrapperGalleryPage>
  )
}

export default GalleryPage