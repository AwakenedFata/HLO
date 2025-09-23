"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import ReactCrop, { centerCrop, makeAspectCrop, convertToPixelCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import {
  Row,
  Col,
  Card,
  Button,
  Form,
  Table,
  Badge,
  Alert,
  Tabs,
  Tab,
  Modal,
  Spinner,
  InputGroup,
  Dropdown,
  DropdownButton,
  Pagination,
  OverlayTrigger,
  Tooltip,
  Toast,
  ToastContainer,
  Image,
} from "react-bootstrap"
import { useRouter } from "next/navigation"
import axios from "axios"
import {
  FaPlus,
  FaSync,
  FaTrash,
  FaEdit,
  FaFilter,
  FaSearch,
  FaExclamationTriangle,
  FaEye,
  FaCheckCircle,
  FaImage,
  FaCalendarAlt,
  FaTag,
  FaCrop,
  FaInfoCircle,
  FaTimes,
  FaLink,
  FaSearchPlus,
  FaFileAlt,
  FaNewspaper,
  FaArchive,
  FaDraft2Digital,
  FaGlobe,
  FaImages,
  FaQuoteLeft,
  FaCloudUploadAlt,
  FaExpand,
} from "react-icons/fa"

// Cache buster helper to avoid stale image URLs
const withBuster = (url) => {
  if (!url) return url
  try {
    const sep = url.includes("?") ? "&" : "?"
    return `${url}${sep}t=${Date.now()}`
  } catch {
    return url
  }
}

// Timezone helper functions
const formatDateForInput = (dateString) => {
  if (!dateString) return ""
  
  // Create date object from the input string
  const date = new Date(dateString)
  
  // Check if date is valid
  if (isNaN(date.getTime())) return ""
  
  // Get timezone offset in minutes and convert to milliseconds
  const timezoneOffset = date.getTimezoneOffset() * 60000
  
  // Adjust for local timezone
  const localTime = new Date(date.getTime() - timezoneOffset)
  
  // Format to YYYY-MM-DDTHH:mm format for datetime-local input
  return localTime.toISOString().slice(0, 16)
}

const formatDateForSubmission = (inputValue) => {
  if (!inputValue) return null
  
  // Create date object from datetime-local input
  // datetime-local returns YYYY-MM-DDTHH:mm format in local timezone
  const date = new Date(inputValue)
  
  // Check if date is valid
  if (isNaN(date.getTime())) return null
  
  // Return ISO string (UTC)
  return date.toISOString()
}

const getCurrentLocalDateTime = () => {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() * 60000
  const localTime = new Date(now.getTime() - timezoneOffset)
  return localTime.toISOString().slice(0, 16)
}

const api = axios.create({
  timeout: 180000, // 3 minutes for file uploads
})

function ArticleManagement() {
  const router = useRouter()
  const fileInputRef = useRef(null)
  const contentImagesInputRef = useRef(null)
  const isMountedRef = useRef(false)

  // Basic state
  const [isClient, setIsClient] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [articles, setArticles] = useState([])
  const [filteredArticles, setFilteredArticles] = useState([])
  const [galleries, setGalleries] = useState([])
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [error, setError] = useState("")

  // Toast notifications
  const [toasts, setToasts] = useState([])

  // Form state
  const [activeTab, setActiveTab] = useState("add")
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    excerpt: "",
    coverImage: "",
    coverImageKey: "",
    relatedGallery: "",
    tags: [],
    status: "draft",
    publishedAt: "",
    contentImages: [],
  })
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Edit state
  const [editingArticle, setEditingArticle] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    archived: 0,
    thisMonth: 0,
  })

  // Selection and modals
  const [selectedArticles, setSelectedArticles] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [articleToDelete, setArticleToDelete] = useState(null)
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false)
  const [deletingMultiple, setDeletingMultiple] = useState(false)

  // Filtering and search
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterGallery, setFilterGallery] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalItems, setTotalItems] = useState(0)

  // Image handling
  const [previewImage, setPreviewImage] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [showCropModal, setShowCropModal] = useState(false)
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState()
  const [aspectRatio, setAspectRatio] = useState(16 / 9)
  const [imgRef, setImgRef] = useState()

  // Enhanced content images handling
  const [uploadingContentImages, setUploadingContentImages] = useState(false)
  const [contentImagesPreviews, setContentImagesPreviews] = useState([])

  // Image viewer modal states
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState("")
  const [selectedImageTitle, setSelectedImageTitle] = useState("")

  // Tag input
  const [tagInput, setTagInput] = useState("")

  // Toast helper
  const addToast = useCallback((message, type = "success", duration = 5000) => {
    const id = Date.now()
    const toast = { id, message, type, duration }
    setToasts((prev) => [...prev, toast])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  // Check authentication
  const checkAuth = useCallback(() => {
    const token = sessionStorage.getItem("adminToken")
    if (!token) {
      setAuthError(true)
      router.push("/admin/login")
      return null
    }
    return token
  }, [router])

  // Logout function
  const logout = useCallback(() => {
    sessionStorage.removeItem("adminToken")
    setAuthError(true)
    router.push("/admin/login")
  }, [router])

  // Fetch galleries for dropdown
  const fetchGalleries = useCallback(async () => {
    try {
      const token = checkAuth()
      if (!token) return

      const response = await api.get("/api/admin/gallery", {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 100, status: "active" },
      })

      if (response.data?.galleries) {
        setGalleries(response.data.galleries)
      }
    } catch (error) {
      console.error("Error fetching galleries:", error)
    }
  }, [checkAuth])

  // Fetch articles
  const fetchArticles = useCallback(
    async (page = 1, limit = 20) => {
      if (!isMountedRef.current) return

      setLoading(true)
      try {
        const token = checkAuth()
        if (!token) return

        const params = {
          page: page.toString(),
          limit: limit.toString(),
          _t: Date.now(), // Cache busting
        }

        if (searchTerm.trim()) {
          params.search = searchTerm.trim()
        }

        if (filterStatus && filterStatus !== "all") {
          params.status = filterStatus
        }

        if (filterGallery && filterGallery !== "all") {
          params.relatedGallery = filterGallery
        }

        const response = await api.get("/api/admin/article", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
          params,
        })

        if (response.data?.articles) {
          setArticles(response.data.articles)
          setFilteredArticles(response.data.articles)
          setStats(response.data.stats || {})
          setCurrentPage(response.data.pagination?.current || 1)
          setTotalPages(response.data.pagination?.total || 1)
          setTotalItems(response.data.pagination?.totalItems || 0)
          setDataLoaded(true)
        }
      } catch (error) {
        console.error("Error fetching articles:", error)
        if (error.response?.status === 401) {
          logout()
        } else {
          addToast(error.response?.data?.message || "Gagal memuat artikel", "error")
        }
      } finally {
        setLoading(false)
      }
    },
    [checkAuth, logout, searchTerm, filterStatus, filterGallery, addToast],
  )

  // Initialize component
  useEffect(() => {
    setIsClient(true)
    isMountedRef.current = true

    const initializeData = async () => {
      await fetchGalleries()
      await fetchArticles(1, itemsPerPage)
    }

    initializeData()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchArticles, fetchGalleries, itemsPerPage])

  // Handle search changes
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }, [])

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        fetchArticles(1, itemsPerPage)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, filterStatus, filterGallery, fetchArticles, itemsPerPage])

  useEffect(() => {
    if (dataLoaded) {
      fetchArticles(1, itemsPerPage)
      setCurrentPage(1)
    }
  }, [filterStatus, filterGallery, searchTerm, itemsPerPage, fetchArticles, dataLoaded])

  // Handle file selection for cover image
  const handleFileSelect = (file) => {
    if (!file) return

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewImage(e.target.result)
      setShowCropModal(true)
    }
    reader.readAsDataURL(file)
  }

  // Enhanced multiple content images upload with immediate preview
  const handleContentImagesUpload = async (event) => {
    const files = event.target?.files
    if (!files || files.length === 0) return

    console.log("[v0] Upload attempt - files selected:", files.length)
    console.log(
      "[v0] Files details:",
      Array.from(files).map((f) => ({ name: f.name, size: f.size, type: f.type })),
    )

    setUploadingContentImages(true)

    try {
      const token = checkAuth()
      if (!token) return

      // Create FormData for multiple files
      const formData = new FormData()
      for (const file of files) {
        formData.append("files", file) // Changed to "files" to match backend expectation for multiple
      }

      console.log("[v0] FormData created, uploading to /api/admin/article/upload-multiple")

      // Upload all files at once
      const response = await api.post("/api/admin/article/upload-multiple", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        timeout: 300000, // 5 minutes for large file uploads
      })

      console.log("[v0] Upload response:", response.data)

      if (response.data?.success && response.data.images) {
        // Add new images to existing content images
        setFormData((prev) => ({
          ...prev,
          contentImages: [...prev.contentImages, ...response.data.images],
        }))

        console.log("[v0] Images added to formData, total now:", formData.contentImages?.length || 0)
        addToast(`${response.data.images.length} gambar berhasil diupload`, "success")
      }
    } catch (error) {
      console.error("[v0] Error uploading content images:", error)
      console.error("[v0] Error response:", error.response?.data)
      addToast(error.response?.data?.message || "Gagal mengupload gambar", "error")
    } finally {
      setUploadingContentImages(false)
      if (event.target) {
        event.target.value = ""
      }
    }
  }

  // Update content images order (drag & drop functionality)
  const updateContentImagesOrder = (newOrder) => {
    setFormData((prev) => ({
      ...prev,
      contentImages: newOrder,
    }))
  }

  // Remove content image
  const removeContentImage = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      contentImages: prev.contentImages.filter((_, index) => index !== indexToRemove),
    }))
    addToast("Gambar berhasil dihapus", "info")
  }

  // Handle crop save
  const handleCropSave = useCallback(async () => {
    if (!completedCrop || !imgRef || !selectedFile) return

    try {
      setUploading(true)
      const token = checkAuth()
      if (!token) return

      // Create canvas for cropped image
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")

      const pixelCrop = convertToPixelCrop(completedCrop, imgRef.naturalWidth, imgRef.naturalHeight)

      canvas.width = pixelCrop.width
      canvas.height = pixelCrop.height

      ctx.drawImage(
        imgRef,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
      )

      // Convert to blob and upload
      canvas.toBlob(
        async (blob) => {
          const formData = new FormData()
          formData.append("file", blob, selectedFile.name)

          try {
            const response = await api.post("/api/admin/article/upload", formData, {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "multipart/form-data",
              },
            })

            if (response.data?.success) {
              setFormData((prev) => ({
                ...prev,
                coverImage: response.data.imageUrl,
                coverImageKey: response.data.imageKey,
              }))
              addToast("Cover image berhasil diupload", "success")
              setShowCropModal(false)
            }
          } catch (error) {
            console.error("Error uploading cropped image:", error)
            addToast("Gagal mengupload gambar", "error")
          } finally {
            setUploading(false)
          }
        },
        "image/jpeg",
        0.9,
      )
    } catch (error) {
      console.error("Error processing crop:", error)
      addToast("Gagal memproses gambar", "error")
      setUploading(false)
    }
  }, [completedCrop, imgRef, selectedFile, checkAuth, addToast])

  // Parse tags from input text - handles multiple formats
  const parseTagsFromInput = (input) => {
    if (!input || typeof input !== "string") return []

    // Remove extra spaces and split by various delimiters
    const tags = input
      .trim()
      .split(/[\s,#]+/) // Split by spaces, commas, or hash symbols
      .map((tag) => tag.trim()) // Trim each tag
      .filter((tag) => tag.length > 0) // Remove empty tags
      .map((tag) => (tag.startsWith("#") ? tag.slice(1) : tag)) // Remove # prefix if exists
      .filter((tag) => tag.length > 0) // Remove empty tags again after # removal

    return [...new Set(tags)] // Remove duplicates
  }

  // Handle tag addition
  const handleAddTag = () => {
    if (!tagInput.trim()) return

    const newTags = parseTagsFromInput(tagInput)
    const currentTags = formData.tags || []

    // Combine existing tags with new tags, remove duplicates
    const combinedTags = [...new Set([...currentTags, ...newTags])]

    // Limit to maximum 10 tags
    const finalTags = combinedTags.slice(0, 10)

    setFormData((prev) => ({
      ...prev,
      tags: finalTags,
    }))
    setTagInput("")

    if (newTags.length > 0) {
      addToast(`${newTags.length} tag berhasil ditambahkan`, "success", 3000)
    }
  }

  // Handle tag removal
  const handleRemoveTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }))
  }

  const validateForm = () => {
    if (!formData.title) {
      addToast("Judul artikel harus diisi", "error")
      return false
    }
    if (!formData.content) {
      addToast("Konten artikel harus diisi", "error")
      return false
    }
    if (formData.content.length < 50) {
      addToast("Konten artikel minimal 50 karakter", "error")
      return false
    }
    return true
  }

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      excerpt: "",
      coverImage: "",
      coverImageKey: "",
      relatedGallery: "",
      tags: [],
      status: "draft",
      publishedAt: "",
      contentImages: [],
    })
    setTagInput("")
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (contentImagesInputRef.current) contentImagesInputRef.current.value = ""
    setEditingArticle(null)
    setShowEditModal(false)
  }

  // Process final tags before submission
  const processFinalTags = () => {
    let finalTags = [...(formData.tags || [])]

    // If there's remaining input in tagInput, parse and add it
    if (tagInput.trim()) {
      const remainingTags = parseTagsFromInput(tagInput)
      finalTags = [...new Set([...finalTags, ...remainingTags])]
    }

    // Clean up tags: remove empty strings, limit to 10
    return finalTags
      .filter((tag) => tag && typeof tag === "string" && tag.trim().length > 0)
      .map((tag) => tag.trim())
      .slice(0, 10)
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const token = checkAuth()
      if (!token) return

      // Process final tags including any remaining input
      const finalTags = processFinalTags()

      // Handle publishedAt field with proper timezone handling
      let publishedAtValue = formData.publishedAt
      if (formData.status === "published") {
        if (!formData.publishedAt) {
          // If no publishedAt is provided for published articles, use current time
          publishedAtValue = new Date().toISOString()
        } else {
          // Convert the datetime-local input to proper ISO string
          publishedAtValue = formatDateForSubmission(formData.publishedAt)
        }
      } else {
        // For draft/archived articles, clear publishedAt
        publishedAtValue = null
      }

      const submitData = {
        ...formData,
        tags: finalTags, // Use processed tags instead of formData.tags directly
        status: formData.status || "draft", // Ensure status has a default value
        publishedAt: publishedAtValue,
      }

      console.log("[Submit Debug] Final tags being sent:", finalTags)
      console.log("[Submit Debug] Tag input remaining:", tagInput)
      console.log("[Submit Debug] PublishedAt value:", publishedAtValue)
      console.log("[Submit Debug] Original form publishedAt:", formData.publishedAt)

      let response
      if (editingArticle) {
        response = await api.put(`/api/admin/article/${editingArticle._id}`, submitData, {
          headers: { Authorization: `Bearer ${token}` },
        })
      } else {
        response = await api.post("/api/admin/article", submitData, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }

      if (response.data?.success) {
        addToast(
          response.data.message || (editingArticle ? "Artikel berhasil diupdate" : "Artikel berhasil dibuat"),
          "success",
        )
        resetForm()
        await fetchArticles(currentPage, itemsPerPage)
      }
    } catch (error) {
      console.error("Error saving article:", error)
      if (error.response?.status === 401) {
        logout()
      } else {
        addToast(error.response?.data?.message || "Gagal menyimpan artikel", "error")
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Handle refresh
  const handleRefresh = () => {
    fetchArticles(currentPage, itemsPerPage)
  }

  // Handle image view
  const handleImageView = (imageUrl, title) => {
    setSelectedImageUrl(imageUrl)
    setSelectedImageTitle(title)
    setShowImageModal(true)
  }

  // Handle selection
  const handleSelectArticle = (articleId) => {
    setSelectedArticles((prev) =>
      prev.includes(articleId) ? prev.filter((id) => id !== articleId) : [...prev, articleId],
    )
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedArticles([])
    } else {
      setSelectedArticles(articles.map((article) => article._id))
    }
    setSelectAll(!selectAll)
  }

  // Handle delete
  const handleDelete = async (articleId) => {
    try {
      const token = checkAuth()
      if (!token) return

      const response = await api.delete(`/api/admin/article/${articleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.data?.success) {
        addToast("Artikel berhasil dihapus", "success")
        await fetchArticles(currentPage, itemsPerPage)
        setShowDeleteModal(false)
        setArticleToDelete(null)
      }
    } catch (error) {
      console.error("Error deleting article:", error)
      addToast("Gagal menghapus artikel", "error")
    }
  }

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedArticles.length === 0) return

    setDeletingMultiple(true)
    try {
      const token = checkAuth()
      if (!token) return

      const response = await api.post(
        "/api/admin/article/bulk-delete",
        { ids: selectedArticles },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      if (response.data?.success) {
        addToast(`${response.data.deletedCount} artikel berhasil dihapus`, "success")
        setSelectedArticles([])
        setSelectAll(false)
        await fetchArticles(currentPage, itemsPerPage)
        setShowDeleteMultipleModal(false)
      }
    } catch (error) {
      console.error("Error bulk deleting articles:", error)
      addToast("Gagal menghapus artikel", "error")
    } finally {
      setDeletingMultiple(false)
    }
  }

  // Stats cards configuration
  const statsCards = [
    {
      title: "Total Artikel",
      value: stats.total || 0,
      icon: FaFileAlt,
      variant: "primary",
    },
    {
      title: "Published",
      value: stats.published || 0,
      icon: FaGlobe,
      variant: "success",
    },
    {
      title: "Draft",
      value: stats.draft || 0,
      icon: FaDraft2Digital,
      variant: "warning",
    },
    {
      title: "Archived",
      value: stats.archived || 0,
      icon: FaArchive,
      variant: "secondary",
    },
  ]

  // Status badge helper
  const getStatusBadge = (status) => {
    const statusConfig = {
      published: { variant: "success", text: "Published" },
      draft: { variant: "warning", text: "Draft" },
      archived: { variant: "secondary", text: "Archived" },
    }
    const config = statusConfig[status] || { variant: "secondary", text: status }
    return <Badge bg={config.variant}>{config.text}</Badge>
  }

  // Pagination component
  const renderPagination = () => {
    if (totalPages <= 1) return null

    const items = []
    const maxVisible = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const endPage = Math.min(totalPages, startPage + maxVisible - 1)

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }

    // First page
    if (startPage > 1) {
      items.push(
        <Pagination.Item key={1} onClick={() => fetchArticles(1, itemsPerPage)} disabled={loading}>
          1
        </Pagination.Item>,
      )
      if (startPage > 2) {
        items.push(<Pagination.Ellipsis key="start-ellipsis" />)
      }
    }

    // Page numbers
    for (let page = startPage; page <= endPage; page++) {
      items.push(
        <Pagination.Item
          key={page}
          active={page === currentPage}
          onClick={() => fetchArticles(page, itemsPerPage)}
          disabled={loading}
        >
          {page}
        </Pagination.Item>,
      )
    }

    // Last page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<Pagination.Ellipsis key="end-ellipsis" />)
      }
      items.push(
        <Pagination.Item key={totalPages} onClick={() => fetchArticles(totalPages, itemsPerPage)} disabled={loading}>
          {totalPages}
        </Pagination.Item>,
      )
    }

    return (
      <div className="d-flex justify-content-between align-items-center mt-4">
        <small className="text-muted">
          Menampilkan {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} -{" "}
          {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} artikel
        </small>
        <Pagination size="sm" className="mb-0">
          <Pagination.Prev
            onClick={() => fetchArticles(currentPage - 1, itemsPerPage)}
            disabled={currentPage === 1 || loading}
          />
          {items}
          <Pagination.Next
            onClick={() => fetchArticles(currentPage + 1, itemsPerPage)}
            disabled={currentPage === totalPages || loading}
          />
        </Pagination>
      </div>
    )
  }

  // Show loading while not client-side
  if (!isClient) {
    return (
      <div className="article-management-page">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Memuat aplikasi...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show auth error
  if (authError) {
    return (
      <div className="article-management-page">
        <div className="container mt-5">
          <Alert variant="danger" className="text-center">
            <FaExclamationTriangle size={48} className="mb-3" />
            <h4>Sesi Login Berakhir</h4>
            <p>Anda akan dialihkan ke halaman login...</p>
          </Alert>
        </div>
      </div>
    )
  }

  // Show loading while data hasn't loaded
  if (!dataLoaded) {
    return (
      <div className="article-management-page">
        <h1 className="mb-4">Manajemen Artikel</h1>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="text-center">
            <Spinner animation="border" variant="primary" size="lg" />
            <p className="mt-3">Memuat data artikel...</p>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => fetchArticles(1, itemsPerPage)}
              disabled={loading}
              className="mt-2"
            >
              {loading ? "Memuat ulang..." : "Muat Ulang Data"}
            </Button>
            {error && (
              <Alert variant="danger" className="mt-3">
                <FaExclamationTriangle className="me-2" />
                {error}
              </Alert>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Handle edit article - populate form with existing data
  const handleEditArticle = (article) => {
    setFormData({
      title: article.title || "",
      content: article.content || "",
      excerpt: article.excerpt || "",
      coverImage: article.coverImage || "",
      coverImageKey: article.coverImageKey || "",
      relatedGallery: article.relatedGallery?._id || "",
      tags: article.tags || [],
      status: article.status || "draft",
      publishedAt: formatDateForInput(article.publishedAt), // Use the timezone helper function
      contentImages: article.contentImages || [],
    })
    setEditingArticle(article)
    setShowEditModal(true)
  }

  return (
    <div className="article-management-page">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Manajemen Artikel</h1>
        <Button variant="outline-primary" size="sm" onClick={handleRefresh} disabled={loading}>
          <FaSync className={`me-1 ${loading ? "fa-spin" : ""}`} />
          {loading ? "Memuat..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")} className="mb-4">
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Row className="mb-4">
        {statsCards.map((stat, index) => (
          <Col md={3} key={index}>
            <Card className={`text-center h-100 border-${stat.variant}`}>
              <Card.Body>
                <div className="d-flex justify-content-center align-items-center mb-2">
                  <stat.icon className={`text-${stat.variant} me-2`} size={24} />
                  <h3 className="mb-0">{stat.value.toLocaleString("id-ID")}</h3>
                </div>
                <p className="mb-0 text-muted">{stat.title}</p>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Action Tabs */}
      <Card className="mb-4 shadow-sm">
        <Card.Header>
          <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="border-0" fill>
            <Tab
              eventKey="add"
              title={
                <>
                  <FaPlus className="me-2" />
                  Tambah Artikel
                </>
              }
            >
              <div className="p-3">
                <Form onSubmit={handleSubmit}>
                  <Row>
                    <Col md={8}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          <FaNewspaper className="me-2" />
                          Judul Artikel
                        </Form.Label>
                        <Form.Control
                          type="text"
                          value={formData.title}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                          placeholder="Masukkan judul artikel"
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          <FaTag className="me-2" />
                          Status
                        </Form.Label>
                        <Form.Select
                          value={formData.status}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              status: e.target.value,
                              // Auto-set publishedAt when status changes to published
                              publishedAt: e.target.value === "published" && !prev.publishedAt 
                                ? getCurrentLocalDateTime() 
                                : prev.publishedAt,
                            }))
                          }
                          style={{ backgroundColor: "white", color: "black" }}   
                        >
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                          <option value="archived">Archived</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FaQuoteLeft className="me-2" />
                      Excerpt (Ringkasan)
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      value={formData.excerpt}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          excerpt: e.target.value,
                        }))
                      }
                      placeholder="Masukkan ringkasan artikel (opsional, maks 300 karakter)"
                      maxLength={300}
                    />
                    <Form.Text muted>{formData.excerpt.length}/300 karakter</Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FaFileAlt className="me-2" />
                      Konten Artikel
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={10}
                      value={formData.content}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          content: e.target.value,
                        }))
                      }
                      placeholder="Masukkan konten artikel (minimal 50 karakter)"
                      required
                    />
                    <Form.Text muted>{formData.content.length} karakter (minimal 50)</Form.Text>
                  </Form.Group>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          <FaLink className="me-2" />
                          Related Gallery
                        </Form.Label>
                        <Form.Select
                          value={formData.relatedGallery}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              relatedGallery: e.target.value,
                            }))
                          }
                          style={{ backgroundColor: "white", color: "black" }}  
                        >
                          <option value="">Pilih Gallery (Opsional)</option>
                          {galleries.map((gallery) => (
                            <option key={gallery._id} value={gallery._id}>
                              {gallery.title} - {gallery.label}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      {formData.status === "published" && (
                        <Form.Group className="mb-3">
                          <Form.Label>
                            <FaCalendarAlt className="me-2" />
                            Tanggal Publish (Waktu Lokal)
                          </Form.Label>
                          <Form.Control
                            type="datetime-local"
                            value={formData.publishedAt}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                publishedAt: e.target.value,
                              }))
                            }
                          />
                          <Form.Text className="text-muted">
                            Kosongkan untuk menggunakan waktu sekarang
                          </Form.Text>
                        </Form.Group>
                      )}
                    </Col>
                  </Row>

                  {/* Enhanced Tags Section with Smart Parsing */}
                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FaTag className="me-2" />
                      Tags
                    </Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="Masukkan tags: #hokace #ace #season3 atau pisahkan dengan spasi/koma"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddTag()
                          }
                        }}
                        onBlur={() => {
                          // Auto-add tags when user leaves the input field
                          if (tagInput.trim()) {
                            handleAddTag()
                          }
                        }}
                      />
                      <Button variant="outline-secondary" onClick={handleAddTag} disabled={!tagInput.trim()}>
                        <FaPlus />
                      </Button>
                    </InputGroup>

                    {/* Live preview of tags that will be parsed */}
                    {tagInput.trim() && (
                      <div className="mt-2 p-2 bg-light border rounded">
                        <small className="text-muted">Tags yang akan ditambahkan: </small>
                        {parseTagsFromInput(tagInput).map((tag, index) => (
                          <Badge key={index} bg="info" className="me-1">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Current tags display */}
                    {formData.tags.length > 0 && (
                      <div className="mt-2">
                        <small className="text-muted d-block mb-1">Tags aktif ({formData.tags.length}/10):</small>
                        {formData.tags.map((tag, index) => (
                          <Badge
                            key={index}
                            bg="primary"
                            className="me-2 mb-2"
                            style={{ cursor: "pointer" }}
                            onClick={() => handleRemoveTag(tag)}
                          >
                            {tag} <FaTimes className="ms-1" />
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Form.Text muted>
                      Mendukung format: #tag, tag1 tag2, tag1,tag2. Maksimal 10 tags. Klik tag untuk menghapus.
                      {formData.tags.length >= 10 && (
                        <span className="text-warning fw-bold"> Maksimal tags tercapai!</span>
                      )}
                    </Form.Text>
                  </Form.Group>

                  {/* Cover Image Section */}
                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FaImage className="me-2" />
                      Cover Image
                    </Form.Label>
                    <div className="d-flex gap-2 mb-2">
                      <Form.Control
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={(e) => handleFileSelect(e.target.files[0])}
                        className="form-control-lg"
                      />
                      {(selectedFile || previewImage) && (
                        <Button
                          variant="outline-info"
                          onClick={() => setShowCropModal(true)}
                          disabled={uploading}
                          title="Preview & Crop Gambar"
                        >
                          <FaSearchPlus className="me-1" />
                          Preview
                        </Button>
                      )}
                    </div>
                    <Form.Text muted>Format yang didukung: JPEG, PNG, WebP. Maksimal ukuran: 10MB</Form.Text>
                    {uploading && (
                      <div className="mt-2">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Mengupload cover image...
                      </div>
                    )}
                    {formData.coverImage && (
                      <div className="mt-2">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <FaCheckCircle className="text-success" />
                          <small className="text-success">Cover image berhasil diupload</small>
                        </div>
                        <div
                          className="preview-container"
                          style={{
                            maxWidth: "400px",
                            margin: "0 auto",
                            border: "1px solid #dee2e6",
                            borderRadius: "8px",
                            overflow: "hidden",
                            backgroundColor: "#f8f9fa",
                            cursor: "pointer",
                          }}
                          onClick={() => handleImageView(formData.coverImage, "Cover Image")}
                        >
                          <Image
                            src={formData.coverImage || "/placeholder.svg"}
                            alt="Cover Preview"
                            style={{
                              width: "100%",
                              height: "200px",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </Form.Group>

                  {/* Enhanced Content Images Section */}
                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FaImages className="me-2" />
                      Content Images
                    </Form.Label>

                    {/* Image Grid with Drag & Drop Support */}
                    <div className="mb-3 d-flex flex-wrap gap-2">
                      {/* Display existing content images */}
                      {formData.contentImages.map((image, index) => (
                        <div
                          key={image.key || index}
                          className="position-relative bg-white shadow-sm rounded border"
                          style={{
                            width: "120px",
                            height: "120px",
                            padding: "8px",
                          }}
                        >
                          <Image
                            src={withBuster(image.url) || "/placeholder.svg"}
                            alt={`Content ${index + 1}`}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                            onClick={() => handleImageView(image.url, `Content Image ${index + 1}`)}
                          />

                          {/* Remove button */}
                          <Button
                            variant="danger"
                            size="sm"
                            className="position-absolute"
                            style={{
                              top: "4px",
                              right: "4px",
                              width: "24px",
                              height: "24px",
                              padding: "0",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onClick={() => removeContentImage(index)}
                            title="Hapus gambar"
                          >
                            <FaTimes size={10} />
                          </Button>

                          {/* Expand button */}
                          <Button
                            variant="info"
                            size="sm"
                            className="position-absolute"
                            style={{
                              bottom: "4px",
                              right: "4px",
                              width: "24px",
                              height: "24px",
                              padding: "0",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onClick={() => handleImageView(image.url, `Content Image ${index + 1}`)}
                            title="Lihat gambar penuh"
                          >
                            <FaExpand size={10} />
                          </Button>
                        </div>
                      ))}

                      {/* Upload indicator */}
                      {uploadingContentImages && (
                        <div
                          className="d-flex align-items-center justify-content-center bg-light border rounded"
                          style={{
                            width: "120px",
                            height: "120px",
                          }}
                        >
                          <div className="text-center">
                            <Spinner animation="border" size="sm" variant="primary" />
                            <div className="mt-1" style={{ fontSize: "10px" }}>
                              Uploading...
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Upload button */}
                      <label
                        className="d-flex align-items-center justify-content-center text-center bg-white shadow-sm border border-primary text-gray-500 rounded cursor-pointer position-relative"
                        style={{
                          width: "120px",
                          height: "120px",
                          cursor: "pointer",
                          borderStyle: "dashed",
                          borderWidth: "1px",
                        }}
                      >
                        <div className="text-center">
                          <FaCloudUploadAlt size={24} className="text-primary mb-2" />
                          <div className="text-primary fw-bold" style={{ fontSize: "12px" }}>
                            Upload
                          </div>
                          <div className="text-muted" style={{ fontSize: "10px" }}>
                            Multiple Images
                          </div>
                        </div>
                        <input
                          type="file"
                          ref={contentImagesInputRef}
                          multiple
                          accept="image/*"
                          onChange={handleContentImagesUpload}
                          className="d-none"
                        />
                      </label>
                    </div>

                    <Form.Text className="text-muted">
                      Pilih multiple gambar untuk konten artikel. Format: JPEG, PNG, WebP. Maksimal 10MB per file.
                      {formData.contentImages.length > 0 && (
                        <span className="fw-bold ms-2">({formData.contentImages.length} gambar dipilih)</span>
                      )}
                    </Form.Text>
                  </Form.Group>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={submitting || uploading || uploadingContentImages}
                  >
                    {submitting ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <FaPlus className="me-2" />
                        Tambah Artikel
                      </>
                    )}
                  </Button>
                </Form>
              </div>
            </Tab>

            <Tab
              eventKey="manage"
              title={
                <>
                  <FaEdit className="me-2" />
                  Kelola Artikel
                </>
              }
            >
              <Card className="shadow-sm">
                <Card.Header className="bg-light">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold">Daftar Artikel</span>
                    <div className="d-flex gap-2">
                      {selectedArticles.length > 0 && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setShowDeleteMultipleModal(true)}
                          disabled={deletingMultiple}
                        >
                          <FaTrash className="me-1" />
                          {deletingMultiple ? "Menghapus..." : `Hapus (${selectedArticles.length})`}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card.Header>
                <Card.Body>
                  {/* Search and Filter */}
                  <Row className="mb-3">
                    <Col md={6}>
                      <InputGroup>
                        <InputGroup.Text>
                          <FaSearch />
                        </InputGroup.Text>
                        <Form.Control
                          placeholder="Cari judul, konten, atau tags..."
                          value={searchTerm}
                          onChange={(e) => handleSearchChange(e.target.value)}
                        />
                        {searchTerm && (
                          <Button variant="outline-secondary" onClick={() => handleSearchChange("")}>
                            &times;
                          </Button>
                        )}
                      </InputGroup>
                    </Col>
                    <Col md={3}>
                      <DropdownButton
                        title={
                          <>
                            <FaFilter className="me-1" />
                            {filterStatus === "all" && "Semua Status"}
                            {filterStatus === "published" && "Published"}
                            {filterStatus === "draft" && "Draft"}
                            {filterStatus === "archived" && "Archived"}
                          </>
                        }
                        variant="outline-secondary"
                        className="w-100"
                        style={{ backgroundColor: "white" }}
                      >
                        <Dropdown.Item
                          active={filterStatus === "all"}
                          onClick={() => setFilterStatus("all")}
                          style={{
                            backgroundColor: filterStatus === "all" ? "#0d6efd" : "white",
                            color: filterStatus === "all" ? "white" : "black",
                          }}
                        >
                          <FaEye className="me-2" />
                          Semua Status
                        </Dropdown.Item>
                        <Dropdown.Item
                          active={filterStatus === "published"}
                          onClick={() => setFilterStatus("published")}
                          style={{
                            backgroundColor: filterStatus === "published" ? "#0d6efd" : "white",
                            color: filterStatus === "published" ? "white" : "black",
                          }}
                        >
                          <FaCheckCircle className="me-2" />
                          Published
                        </Dropdown.Item>
                        <Dropdown.Item
                          active={filterStatus === "draft"}
                          onClick={() => setFilterStatus("draft")}
                          style={{
                            backgroundColor: filterStatus === "draft" ? "#0d6efd" : "white",
                            color: filterStatus === "draft" ? "white" : "black",
                          }}
                        >
                          <FaEdit className="me-2" />
                          Draft
                        </Dropdown.Item>
                        <Dropdown.Item
                          active={filterStatus === "archived"}
                          onClick={() => setFilterStatus("archived")}
                          style={{
                            backgroundColor: filterStatus === "archived" ? "#0d6efd" : "white",
                            color: filterStatus === "archived" ? "white" : "black",
                          }}
                        >
                          <FaArchive className="me-2" />
                          Archived
                        </Dropdown.Item>
                      </DropdownButton>
                    </Col>
                    <Col md={3}>
                      <DropdownButton
                        title={
                          <>
                            <FaLink className="me-1" />
                            {filterGallery === "all"
                              ? "Semua Gallery"
                              : galleries.find((g) => g._id === filterGallery)?.title || "Gallery"}
                          </>
                        }
                        variant="outline-secondary"
                        className="w-100"
                        style={{ backgroundColor: "white" }}
                      >
                        <Dropdown.Item
                          active={filterGallery === "all"}
                          onClick={() => setFilterGallery("all")}
                          style={{
                            backgroundColor: filterGallery === "all" ? "#0d6efd" : "white",
                            color: filterGallery === "all" ? "white" : "black",
                          }}
                        >
                          Semua Gallery
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        {galleries.map((gallery) => (
                          <Dropdown.Item
                            key={gallery._id}
                            active={filterGallery === gallery._id}
                            onClick={() => setFilterGallery(gallery._id)}
                            style={{
                              backgroundColor: filterGallery === gallery._id ? "#0d6efd" : "white",
                              color: filterGallery === gallery._id ? "white" : "black",
                            }}
                          >
                            {gallery.title} - {gallery.label}
                          </Dropdown.Item>
                        ))}
                      </DropdownButton>
                    </Col>
                  </Row>

                  {/* Articles Table */}
                  <div className="table-responsive">
                    <Table striped bordered hover>
                      <thead>
                        <tr>
                          <th style={{ width: "50px" }}>
                            <Form.Check type="checkbox" checked={selectAll} onChange={handleSelectAll} />
                          </th>
                          <th>Judul</th>
                          <th>Status</th>
                          <th>Gallery</th>
                          <th>Tags</th>
                          <th>Dibuat</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {articles.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="text-center py-4">
                              <div className="text-muted">
                                <FaFileAlt size={48} className="opacity-50 mb-3" />
                                <p>Tidak ada artikel ditemukan</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          articles.map((article) => (
                            <tr key={article._id}>
                              <td>
                                <Form.Check
                                  type="checkbox"
                                  checked={selectedArticles.includes(article._id)}
                                  onChange={() => handleSelectArticle(article._id)}
                                />
                              </td>
                              <td>
                                <div>
                                  <strong>{article.title}</strong>
                                  {article.excerpt && (
                                    <div className="text-muted small">
                                      {article.excerpt.substring(0, 100)}
                                      {article.excerpt.length > 100 && "..."}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                {article.status ? getStatusBadge(article.status) : <Badge bg="secondary">Draft</Badge>}
                              </td>
                              <td>
                                {article.relatedGallery ? (
                                  <small>
                                    {article.relatedGallery.title} - {article.relatedGallery.label}
                                  </small>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              <td>
                                {article.tags && Array.isArray(article.tags) && article.tags.length > 0 ? (
                                  <div>
                                    {article.tags.slice(0, 2).map((tag, index) => (
                                      <Badge key={index} bg="secondary" className="me-1 mb-1">
                                        {tag}
                                      </Badge>
                                    ))}
                                    {article.tags.length > 2 && (
                                      <Badge bg="light" text="dark">
                                        +{article.tags.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              <td>
                                <small className="text-muted">
                                  {new Date(article.createdAt).toLocaleDateString("id-ID")}
                                  <br />
                                  {article.createdBy?.username}
                                </small>
                              </td>
                              <td>
                                <div className="d-flex gap-1">
                                  <OverlayTrigger overlay={<Tooltip>Edit Artikel</Tooltip>}>
                                    <Button
                                      variant="outline-primary"
                                      size="sm"
                                      onClick={() => handleEditArticle(article)}
                                    >
                                      <FaEdit />
                                    </Button>
                                  </OverlayTrigger>
                                  <OverlayTrigger overlay={<Tooltip>Hapus Artikel</Tooltip>}>
                                    <Button
                                      variant="outline-danger"
                                      size="sm"
                                      onClick={() => {
                                        setArticleToDelete(article)
                                        setShowDeleteModal(true)
                                      }}
                                    >
                                      <FaTrash />
                                    </Button>
                                  </OverlayTrigger>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {renderPagination()}
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        </Card.Header>
      </Card>

      {/* Toast Container */}
      <ToastContainer position="top-end" className="p-3">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            bg={toast.type === "success" ? "success" : "danger"}
            text="white"
            onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            delay={toast.duration}
            autohide
          >
            <Toast.Body>{toast.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>

      {/* Crop Modal */}
      <Modal
        show={showCropModal}
        onHide={() => {
          return false
        }}
        size="lg"
        centered
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaCrop className="me-2" />
            Crop Cover Image
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label fw-bold">Aspect Ratio:</label>
            <div className="d-flex gap-2 flex-wrap">
              <Button
                variant={aspectRatio === 16 / 9 ? "primary" : "outline-primary"}
                size="sm"
                onClick={() => setAspectRatio(16 / 9)}
              >
                16:9
              </Button>
              <Button
                variant={aspectRatio === 4 / 3 ? "primary" : "outline-primary"}
                size="sm"
                onClick={() => setAspectRatio(4 / 3)}
              >
                4:3
              </Button>
              <Button
                variant={aspectRatio === 1 ? "primary" : "outline-primary"}
                size="sm"
                onClick={() => setAspectRatio(1)}
              >
                1:1
              </Button>
              <Button
                variant={aspectRatio === 3 / 4 ? "primary" : "outline-primary"}
                size="sm"
                onClick={() => setAspectRatio(3 / 4)}
              >
                3:4
              </Button>
              <Button
                variant={aspectRatio === undefined ? "primary" : "outline-primary"}
                size="sm"
                onClick={() => setAspectRatio(undefined)}
              >
                Free
              </Button>
            </div>
          </div>
          {previewImage && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
              minWidth={50}
              minHeight={50}
              keepSelection
            >
              <img
                ref={setImgRef}
                alt="Crop me"
                src={previewImage || "/placeholder.svg"}
                style={{ maxHeight: "400px", width: "100%" }}
                onLoad={(e) => {
                  const { width, height } = e.currentTarget
                  setCrop(
                    centerCrop(
                      makeAspectCrop(
                        {
                          unit: "%",
                          width: 90,
                        },
                        aspectRatio || 16 / 9,
                        width,
                        height,
                      ),
                      width,
                      height,
                    ),
                  )
                }}
              />
            </ReactCrop>
          )}
          <Alert variant="info" className="mt-3">
            <FaInfoCircle className="me-2" />
            Drag sudut atau sisi crop area untuk mengubah ukuran. Drag bagian tengah untuk memindahkan posisi.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowCropModal(false)
              setPreviewImage(null)
              setSelectedFile(null)
              setCrop(undefined)
              setCompletedCrop(undefined)
            }}
            disabled={uploading}
          >
            Batal
          </Button>
          <Button variant="primary" onClick={handleCropSave} disabled={!completedCrop || uploading}>
            {uploading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Mengupload...
              </>
            ) : (
              "Simpan & Upload"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal show={showImageModal} onHide={() => setShowImageModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{selectedImageTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <Image
            src={selectedImageUrl || "/placeholder.svg"}
            alt={selectedImageTitle}
            style={{ maxWidth: "100%", maxHeight: "70vh" }}
          />
        </Modal.Body>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaExclamationTriangle className="text-warning me-2" />
            Konfirmasi Hapus
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menghapus artikel <strong>"{articleToDelete?.title}"</strong>?
          </p>
          <Alert variant="warning" className="mb-0">
            <FaInfoCircle className="me-2" />
            Tindakan ini tidak dapat dibatalkan. Semua gambar terkait juga akan dihapus.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Batal
          </Button>
          <Button variant="danger" onClick={() => handleDelete(articleToDelete?._id)}>
            <FaTrash className="me-2" />
            Hapus Artikel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal show={showDeleteMultipleModal} onHide={() => setShowDeleteMultipleModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaExclamationTriangle className="text-warning me-2" />
            Konfirmasi Hapus Multiple
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menghapus <strong>{selectedArticles.length} artikel</strong> yang dipilih?
          </p>
          <Alert variant="warning" className="mb-0">
            <FaInfoCircle className="me-2" />
            Tindakan ini tidak dapat dibatalkan. Semua gambar terkait juga akan dihapus.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteMultipleModal(false)}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleBulkDelete} disabled={deletingMultiple}>
            {deletingMultiple ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Menghapus...
              </>
            ) : (
              <>
                <FaTrash className="me-2" />
                Hapus {selectedArticles.length} Artikel
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Edit Modal */}
      <Modal
        show={showEditModal}
        onHide={() => {
          resetForm()
          setShowEditModal(false)
        }}
        size="xl"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FaEdit className="me-2" />
            Edit Artikel: {editingArticle?.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaNewspaper className="me-2" />
                    Judul Artikel
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Masukkan judul artikel"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaTag className="me-2" />
                    Status
                  </Form.Label>
                  <Form.Select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        status: e.target.value,
                        // Auto-set publishedAt when status changes to published (only if not already set)
                        publishedAt: e.target.value === "published" && !prev.publishedAt 
                          ? getCurrentLocalDateTime() 
                          : prev.publishedAt,
                      }))
                    }
                    style={{ backgroundColor: "white", color: "black" }}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>
                <FaQuoteLeft className="me-2" />
                Excerpt (Ringkasan)
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    excerpt: e.target.value,
                  }))
                }
                placeholder="Masukkan ringkasan artikel (opsional, maks 300 karakter)"
                maxLength={300}
              />
              <Form.Text muted>{formData.excerpt.length}/300 karakter</Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <FaFileAlt className="me-2" />
                Konten Artikel
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={8}
                value={formData.content}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    content: e.target.value,
                  }))
                }
                placeholder="Masukkan konten artikel (minimal 50 karakter)"
                required
              />
              <Form.Text muted>{formData.content.length} karakter (minimal 50)</Form.Text>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaLink className="me-2" />
                    Related Gallery
                  </Form.Label>
                  <Form.Select
                    value={formData.relatedGallery}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        relatedGallery: e.target.value,
                      }))
                    }
                    style={{ backgroundColor: "white", color: "black" }}
                  >
                    <option value="">Pilih Gallery (Opsional)</option>
                    {galleries.map((gallery) => (
                      <option key={gallery._id} value={gallery._id}>
                        {gallery.title} - {gallery.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                {formData.status === "published" && (
                  <Form.Group className="mb-3">
                    <Form.Label>
                      <FaCalendarAlt className="me-2" />
                      Tanggal Publish (Waktu Lokal)
                    </Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={formData.publishedAt}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          publishedAt: e.target.value,
                        }))
                      }
                    />
                    <Form.Text className="text-muted">
                      Kosongkan untuk menggunakan waktu sekarang
                    </Form.Text>
                  </Form.Group>
                )}
              </Col>
            </Row>

            {/* Tags Section */}
            <Form.Group className="mb-3">
              <Form.Label>
                <FaTag className="me-2" />
                Tags
              </Form.Label>
              <InputGroup>
                <Form.Control
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Masukkan tags: #hokace #ace #season3 atau pisahkan dengan spasi/koma"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                  onBlur={() => {
                    if (tagInput.trim()) {
                      handleAddTag()
                    }
                  }}
                />
                <Button variant="outline-secondary" onClick={handleAddTag} disabled={!tagInput.trim()}>
                  <FaPlus />
                </Button>
              </InputGroup>

              {tagInput.trim() && (
                <div className="mt-2 p-2 bg-light border rounded">
                  <small className="text-muted">Tags yang akan ditambahkan: </small>
                  {parseTagsFromInput(tagInput).map((tag, index) => (
                    <Badge key={index} bg="info" className="me-1">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {formData.tags.length > 0 && (
                <div className="mt-2">
                  <small className="text-muted d-block mb-1">Tags aktif ({formData.tags.length}/10):</small>
                  {formData.tags.map((tag, index) => (
                    <Badge
                      key={index}
                      bg="primary"
                      className="me-2 mb-2"
                      style={{ cursor: "pointer" }}
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag} <FaTimes className="ms-1" />
                    </Badge>
                  ))}
                </div>
              )}
            </Form.Group>

            {/* Cover Image Section */}
            <Form.Group className="mb-3">
              <Form.Label>
                <FaImage className="me-2" />
                Cover Image
              </Form.Label>
              <div className="d-flex gap-2 mb-2">
                <Form.Control
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                  className="form-control-lg"
                />
                {(selectedFile || previewImage) && (
                  <Button
                    variant="outline-info"
                    onClick={() => setShowCropModal(true)}
                    disabled={uploading}
                    title="Preview & Crop Gambar"
                  >
                    <FaSearchPlus className="me-1" />
                    Preview
                  </Button>
                )}
              </div>
              {uploading && (
                <div className="mt-2">
                  <Spinner animation="border" size="sm" className="me-2" />
                  Mengupload cover image...
                </div>
              )}
              {formData.coverImage && (
                <div className="mt-2">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <FaCheckCircle className="text-success" />
                    <small className="text-success">Cover image berhasil diupload</small>
                  </div>
                  <div
                    className="preview-container"
                    style={{
                      maxWidth: "300px",
                      border: "1px solid #dee2e6",
                      borderRadius: "8px",
                      overflow: "hidden",
                      backgroundColor: "#f8f9fa",
                      cursor: "pointer",
                    }}
                    onClick={() => handleImageView(formData.coverImage, "Cover Image")}
                  >
                    <Image
                      src={formData.coverImage || "/placeholder.svg"}
                      alt="Cover Preview"
                      style={{
                        width: "100%",
                        height: "150px",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                </div>
              )}
            </Form.Group>

            {/* Content Images Section */}
            <Form.Group className="mb-3">
              <Form.Label>
                <FaImages className="me-2" />
                Content Images
              </Form.Label>
              <div className="mb-3 d-flex flex-wrap gap-2">
                {formData.contentImages.map((image, index) => (
                  <div
                    key={image.key || index}
                    className="position-relative bg-white shadow-sm rounded border"
                    style={{
                      width: "100px",
                      height: "100px",
                      padding: "4px",
                    }}
                  >
                    <Image
                      src={withBuster(image.url) || "/placeholder.svg"}
                      alt={`Content ${index + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                      onClick={() => handleImageView(image.url, `Content Image ${index + 1}`)}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      className="position-absolute"
                      style={{
                        top: "2px",
                        right: "2px",
                        width: "20px",
                        height: "20px",
                        padding: "0",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onClick={() => removeContentImage(index)}
                      title="Hapus gambar"
                    >
                      <FaTimes size={8} />
                    </Button>
                  </div>
                ))}

                {uploadingContentImages && (
                  <div
                    className="d-flex align-items-center justify-content-center bg-light border rounded"
                    style={{
                      width: "100px",
                      height: "100px",
                    }}
                  >
                    <Spinner animation="border" size="sm" variant="primary" />
                  </div>
                )}

                <label
                  className="d-flex align-items-center justify-content-center text-center bg-white shadow-sm border border-primary text-gray-500 rounded cursor-pointer position-relative"
                  style={{
                    width: "100px",
                    height: "100px",
                    cursor: "pointer",
                    borderStyle: "dashed",
                    borderWidth: "1px",
                  }}
                >
                  <div className="text-center">
                    <FaCloudUploadAlt size={20} className="text-primary mb-1" />
                    <div className="text-primary fw-bold" style={{ fontSize: "10px" }}>
                      Upload
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={contentImagesInputRef}
                    multiple
                    accept="image/*"
                    onChange={handleContentImagesUpload}
                    className="d-none"
                  />
                </label>
              </div>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              resetForm()
              setShowEditModal(false)
            }}
          >
            Batal
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting || uploading || uploadingContentImages}>
            {submitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Menyimpan...
              </>
            ) : (
              <>
                <FaEdit className="me-2" />
                Update Artikel
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default ArticleManagement