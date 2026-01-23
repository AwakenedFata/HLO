"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
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
  FaPencilAlt,
  FaGlobe,
  FaImages,
  FaQuoteLeft,
  FaCloudUploadAlt,
  FaExpand,
  FaUpload,
} from "react-icons/fa"

import axios from "axios"
import { useRouter } from "next/navigation"

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

  const date = new Date(dateString)

  if (isNaN(date.getTime())) return ""

  const timezoneOffset = date.getTimezoneOffset() * 60000

  const localTime = new Date(date.getTime() - timezoneOffset)

  return localTime.toISOString().slice(0, 16)
}

const formatDateForSubmission = (inputValue) => {
  if (!inputValue) return null

  const date = new Date(inputValue)

  if (isNaN(date.getTime())) return null

  return date.toISOString()
}

const getCurrentLocalDateTime = () => {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() * 60000
  const localTime = new Date(now.getTime() - timezoneOffset)
  return localTime.toISOString().slice(0, 16)
}

const api = axios.create({
  timeout: 180000,
})

function ArticleManagement() {
  const { status } = useSession()
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

  const [noCrop, setNoCrop] = useState(false)
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("16-9")

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

  const checkAuth = useCallback(() => {
    if (status !== "authenticated") {
      console.log("⏳ Waiting for authentication..., current status:", status)
      return null
    }
    return true
  }, [status])

  const logout = useCallback(() => {
    setAuthError(true)
    router.push("/admin/login")
  }, [router])

  const fetchGalleries = useCallback(async () => {
    if (status !== "authenticated") {
      console.log("⏳ Waiting for authentication before fetching galleries, current status:", status)
      return
    }

    try {
      const response = await api.get("/api/admin/galeri", {
        params: { limit: 100, status: "active" },
      })

      if (response.data?.galleries) {
        setGalleries(response.data.galleries)
      }
    } catch (error) {
      console.error("Error fetching galleries:", error)
    }
  }, [status])

  const fetchArticles = useCallback(
    async (page = 1, limit = 20) => {
      if (!isMountedRef.current) return

      if (status !== "authenticated") {
        console.log("⏳ Waiting for authentication before fetching articles, current status:", status)
        return
      }

      setLoading(true)
      try {
        const params = {
          page: page.toString(),
          limit: limit.toString(),
          _t: Date.now(),
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

        const response = await api.get("/api/admin/artikel", {
          headers: {
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
    [status, logout, searchTerm, filterStatus, filterGallery, addToast],
  )

  useEffect(() => {
    setIsClient(true)
    isMountedRef.current = true

    const initializeData = async () => {
      if (status === "authenticated") {
        await fetchGalleries()
        await fetchArticles(1, itemsPerPage)
      }
    }

    initializeData()

    return () => {
      isMountedRef.current = false
    }
  }, [status, fetchArticles, fetchGalleries, itemsPerPage])

  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && status === "authenticated") {
        fetchArticles(1, itemsPerPage)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, filterStatus, filterGallery, fetchArticles, itemsPerPage, status])

  useEffect(() => {
    if (dataLoaded && status === "authenticated") {
      fetchArticles(1, itemsPerPage)
      setCurrentPage(1)
    }
  }, [filterStatus, filterGallery, searchTerm, itemsPerPage, fetchArticles, dataLoaded, status])

  const handleFileSelect = useCallback(
    (file) => {
      if (!file) return

      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"]
      const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".avif"]

      const isValidType = allowedTypes.includes(file.type)
      const isValidExt = allowedExts.some((ext) => file.name?.toLowerCase().endsWith(ext))

      if (!isValidType && !isValidExt) {
        addToast("Format file harus JPG, PNG, WebP, atau AVIF", "error")
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        addToast("Ukuran file maksimal 10MB", "error")
        return
      }

      setSelectedFile(file)

      if (noCrop) {
        setSelectedAspectRatio("no-crop")
        setAspectRatio(undefined)
        setShowCropModal(false)
        handleDirectUpload(file)
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewImage(e.target.result)
        setShowCropModal(true)
      }
      reader.readAsDataURL(file)
    },
    [noCrop, addToast],
  )

  const onImageLoad = useCallback(
    (e) => {
      const { width, height } = e.currentTarget
      if (aspectRatio) {
        setCrop(
          centerCrop(
            makeAspectCrop(
              {
                unit: "%",
                width: 90,
              },
              aspectRatio,
              width,
              height,
            ),
            width,
            height,
          ),
        )
      }
      try {
        e.currentTarget.crossOrigin = "anonymous"
      } catch {}
      setImgRef(e.currentTarget)
    },
    [aspectRatio],
  )

  const getCroppedImg = useCallback((image, completedCrop) => {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")

        if (!ctx) {
          reject(new Error("No 2d context"))
          return
        }

        const pixelRatio = window.devicePixelRatio || 1
        const pixelCrop = convertToPixelCrop(completedCrop, image.naturalWidth, image.naturalHeight)

        const scaleX = image.naturalWidth / image.width
        const scaleY = image.naturalHeight / image.height

        canvas.width = Math.floor(pixelCrop.width * scaleX * pixelRatio)
        canvas.height = Math.floor(pixelCrop.height * scaleY * pixelRatio)

        ctx.scale(pixelRatio, pixelRatio)
        ctx.imageSmoothingQuality = "high"

        const cropX = pixelCrop.x * scaleX
        const cropY = pixelCrop.y * scaleY

        ctx.drawImage(
          image,
          cropX,
          cropY,
          pixelCrop.width * scaleX,
          pixelCrop.height * scaleY,
          0,
          0,
          pixelCrop.width * scaleX,
          pixelCrop.height * scaleY,
        )

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error("Canvas is empty"))
            }
          },
          "image/jpeg",
          0.95,
        )
      } catch (error) {
        reject(error)
      }
    })
  }, [])

  const handleCoverUpload = useCallback(
    async (file) => {
      if (!file) {
        addToast("Pilih file cover terlebih dahulu", "error")
        return
      }

      if (status !== "authenticated") {
        addToast("Anda harus login terlebih dahulu", "error")
        return
      }

      setUploading(true)
      try {
        const fd = new FormData()
        fd.append("file", file)

        const response = await api.post("/api/admin/artikel/upload", fd, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 180000,
        })

        if (response.data?.success) {
          setFormData((prev) => ({
            ...prev,
            coverImage: response.data.imageUrl,
            coverImageKey: response.data.imageKey,
          }))
          addToast("Cover image berhasil diupload", "success")
        } else {
          throw new Error(response.data?.message || "Upload gagal")
        }

        setPreviewImage(null)
        setSelectedFile(null)
        setShowCropModal(false)
        setCrop(undefined)
        setCompletedCrop(undefined)
        setImgRef(undefined)
        setNoCrop(false)
        setAspectRatio(16 / 9)
      } catch (error) {
        console.error("Cover upload error:", error)
        addToast("Gagal upload cover: " + (error.response?.data?.error || error.message), "error")
        setFormData((prev) => ({ ...prev, coverImage: "", coverImageKey: "" }))
      } finally {
        setUploading(false)
      }
    },
    [status, addToast],
  )

  const handleCropAndUpload = useCallback(async () => {
    if (!selectedFile || !previewImage || !completedCrop || !imgRef) return
    try {
      setUploading(true)
      const croppedBlob = await getCroppedImg(imgRef, completedCrop)
      const croppedFile = new File([croppedBlob], selectedFile.name, { type: selectedFile.type })
      await handleCoverUpload(croppedFile)
    } catch (error) {
      console.error("Error cropping cover:", error)
      addToast("Gagal memproses gambar", "error")
      setUploading(false)
    }
  }, [selectedFile, previewImage, completedCrop, imgRef, getCroppedImg, handleCoverUpload, addToast])

  const handleDirectUpload = useCallback(
    async (fileParam) => {
      const file = fileParam || selectedFile
      if (!file) {
        addToast("Pilih file cover terlebih dahulu", "error")
        return
      }

      try {
        setUploading(true)
        await handleCoverUpload(file)
      } catch (error) {
        console.error("Error uploading cover directly:", error)
        addToast("Gagal mengupload cover", "error")
      } finally {
        setUploading(false)
      }
    },
    [selectedFile, handleCoverUpload, addToast],
  )

  const handlePreviewClick = useCallback(() => {
    if (previewImage) {
      setShowCropModal(true)
    }
  }, [previewImage])

  const handleReplaceCover = useCallback(() => {
    setSelectedFile(null)
    setPreviewImage(null)
    setShowCropModal(false)
    setCrop(undefined)
    setCompletedCrop(undefined)
    setNoCrop(false)
    setSelectedAspectRatio("16-9")
    setAspectRatio(16 / 9)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    setFormData((prev) => ({
      ...prev,
      coverImage: "",
      coverImageKey: "",
    }))
  }, [])

  const handleContentImagesUpload = async (event) => {
    const files = event.target?.files
    if (!files || files.length === 0) return

    if (status !== "authenticated") {
      addToast("Anda harus login terlebih dahulu", "error")
      return
    }

    console.log("[v0] Upload attempt - files selected:", files.length)
    console.log(
      "[v0] Files details:",
      Array.from(files).map((f) => ({ name: f.name, size: f.size, type: f.type })),
    )

    setUploadingContentImages(true)

    try {
      const formData = new FormData()
      for (const file of files) {
        formData.append("files", file)
      }

      console.log("[v0] FormData created, uploading to /api/admin/artikel/upload-multiple")

      const response = await api.post("/api/admin/artikel/upload-multiple", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 300000,
      })

      console.log("[v0] Upload response:", response.data)

      if (response.data?.success && response.data.images) {
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

  const updateContentImagesOrder = (newOrder) => {
    setFormData((prev) => ({
      ...prev,
      contentImages: newOrder,
    }))
  }

  const removeContentImage = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      contentImages: prev.contentImages.filter((_, index) => index !== indexToRemove),
    }))
    addToast("Gambar berhasil dihapus", "info")
  }

  const handleCropSave = useCallback(async () => {
    if (!completedCrop || !imgRef || !selectedFile) return

    if (status !== "authenticated") {
      addToast("Anda harus login terlebih dahulu", "error")
      return
    }

    try {
      setUploading(true)

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

      canvas.toBlob(
        async (blob) => {
          const formData = new FormData()
          formData.append("file", blob, selectedFile.name)

          try {
            const response = await api.post("/api/admin/artikel/upload", formData, {
              headers: {
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
  }, [completedCrop, imgRef, selectedFile, status, addToast])

  const parseTagsFromInput = (input) => {
    if (!input || typeof input !== "string") return []

    const tags = input
      .trim()
      .split(/[\s,#]+/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .map((tag) => (tag.startsWith("#") ? tag.slice(1) : tag))
      .filter((tag) => tag.length > 0)

    return [...new Set(tags)]
  }

  const handleAddTag = () => {
    if (!tagInput.trim()) return

    const newTags = parseTagsFromInput(tagInput)
    const currentTags = formData.tags || []

    const combinedTags = [...new Set([...currentTags, ...newTags])]

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
    setPreviewImage(null)
    setSelectedFile(null)
    setCrop(undefined)
    setCompletedCrop(undefined)
    setImgRef(undefined)
    setNoCrop(false)
    setSelectedAspectRatio("16-9")
    setAspectRatio(16 / 9)
  }

  const processFinalTags = () => {
    let finalTags = [...(formData.tags || [])]

    if (tagInput.trim()) {
      const remainingTags = parseTagsFromInput(tagInput)
      finalTags = [...new Set([...finalTags, ...remainingTags])]
    }

    return finalTags
      .filter((tag) => tag && typeof tag === "string" && tag.trim().length > 0)
      .map((tag) => tag.trim())
      .slice(0, 10)
  }

// Ganti fungsi handleSubmit dengan yang ini:

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    if (status !== "authenticated") {
      addToast("Anda harus login terlebih dahulu", "error")
      return
    }

    setSubmitting(true)
    try {
      const finalTags = processFinalTags()

      // FIX: Pastikan publishedAt sesuai dengan status
      let publishedAtValue = null
      
      if (formData.status === "published") {
        if (formData.publishedAt && formData.publishedAt.trim() !== "") {
          publishedAtValue = formatDateForSubmission(formData.publishedAt)
        } else {
          publishedAtValue = new Date().toISOString()
        }
      } else {
        // Untuk draft/archived, publishedAt harus null atau undefined
        publishedAtValue = undefined
      }

      const submitData = {
        title: formData.title,
        content: formData.content,
        excerpt: formData.excerpt || "",
        coverImage: formData.coverImage || "",
        coverImageKey: formData.coverImageKey || "",
        relatedGallery: formData.relatedGallery || undefined,
        tags: finalTags,
        status: formData.status || "draft",
        publishedAt: publishedAtValue,
        contentImages: formData.contentImages || [],
      }

      // Debug log
      console.log("[Submit Debug] Final data being sent:", {
        ...submitData,
        contentLength: submitData.content.length,
        tagsCount: submitData.tags.length,
        hasPublishedAt: submitData.publishedAt !== undefined && submitData.publishedAt !== null,
      })

      let response
      if (editingArticle) {
        response = await api.put(`/api/admin/artikel/${editingArticle._id}`, submitData, {
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } else {
        response = await api.post("/api/admin/artikel", submitData, {
          headers: {
            'Content-Type': 'application/json',
          },
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
      console.error("Error response:", error.response?.data)
      
      if (error.response?.status === 401) {
        logout()
      } else {
        const errorMessage = error.response?.data?.message 
          || error.response?.data?.error 
          || error.message 
          || "Gagal menyimpan artikel"
        addToast(errorMessage, "error")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleRefresh = () => {
    fetchArticles(currentPage, itemsPerPage)
  }

  const handleImageView = (imageUrl, title) => {
    setSelectedImageUrl(imageUrl)
    setSelectedImageTitle(title)
    setShowImageModal(true)
  }

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

  const handleDelete = async (articleId) => {
    if (status !== "authenticated") {
      addToast("Anda harus login terlebih dahulu", "error")
      return
    }

    try {
      const response = await api.delete(`/api/admin/artikel/${articleId}`)

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

  const handleBulkDelete = async () => {
    if (selectedArticles.length === 0) return

    if (status !== "authenticated") {
      addToast("Anda harus login terlebih dahulu", "error")
      return
    }

    setDeletingMultiple(true)
    try {
      const response = await api.post("/api/admin/artikel/bulk-delete", { ids: selectedArticles })

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
      icon: FaPencilAlt,
      variant: "warning",
    },
    {
      title: "Archived",
      value: stats.archived || 0,
      icon: FaArchive,
      variant: "secondary",
    },
  ]

  const getStatusBadge = (status) => {
    const statusConfig = {
      published: { variant: "success", text: "Published" },
      draft: { variant: "warning", text: "Draft" },
      archived: { variant: "secondary", text: "Archived" },
    }
    const config = statusConfig[status] || { variant: "secondary", text: status }
    return <Badge bg={config.variant}>{config.text}</Badge>
  }

  const renderPagination = () => {
    if (totalPages <= 1) return null

    const items = []
    const maxVisible = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const endPage = Math.min(totalPages, startPage + maxVisible - 1)

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }

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

  if (status === "loading") {
    return (
      <div className="article-management-page">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="text-center">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Memuat sesi...</p>
          </div>
        </div>
      </div>
    )
  }

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
              disabled={loading || status !== "authenticated"}
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
      publishedAt: formatDateForInput(article.publishedAt),
      contentImages: article.contentImages || [],
    })
    setEditingArticle(article)
    setShowEditModal(true)
  }

  return (
    <div className="article-management-page">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Manajemen Artikel</h1>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || status !== "authenticated"}
        >
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
                          disabled={status !== "authenticated"}
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
                              publishedAt:
                                e.target.value === "published" && !prev.publishedAt
                                  ? getCurrentLocalDateTime()
                                  : prev.publishedAt,
                            }))
                          }
                          style={{ backgroundColor: "white", color: "black" }}
                          disabled={status !== "authenticated"}
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
                      disabled={status !== "authenticated"}
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
                      disabled={status !== "authenticated"}
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
                          disabled={status !== "authenticated"}
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
                            disabled={status !== "authenticated"}
                          />
                          <Form.Text className="text-muted">Kosongkan untuk menggunakan waktu sekarang</Form.Text>
                        </Form.Group>
                      )}
                    </Col>
                  </Row>

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
                        disabled={status !== "authenticated"}
                      />
                      <Button
                        variant="outline-secondary"
                        onClick={handleAddTag}
                        disabled={!tagInput.trim() || status !== "authenticated"}
                      >
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
                            style={{ cursor: status === "authenticated" ? "pointer" : "not-allowed" }}
                            onClick={() => status === "authenticated" && handleRemoveTag(tag)}
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
                        required={!formData.coverImage}
                        style={{
                          display: formData.coverImage ? "none" : "block",
                        }}
                        disabled={status !== "authenticated"}
                      />

                      {formData.coverImage && (
                        <div className="uploaded-image-container">
                          <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
                            <small className="text-success">
                              <FaCheckCircle className="me-1" />
                              Cover image berhasil diupload
                            </small>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={handleReplaceCover}
                              disabled={uploading || status !== "authenticated"}
                            >
                              <FaExpand className="me-1" />
                              Ganti Gambar
                            </Button>
                          </div>
                        </div>
                      )}

                      {(selectedFile || previewImage) && !noCrop && (
                        <Button
                          variant="outline-info"
                          onClick={handlePreviewClick}
                          disabled={uploading || status !== "authenticated"}
                          title="Preview & Crop Gambar"
                        >
                          <FaSearchPlus className="me-1" />
                          Preview
                        </Button>
                      )}
                    </div>
                    <Form.Text muted>Format yang didukung: JPEG, PNG, WebP, AVIF. Maksimal ukuran: 10MB</Form.Text>

                    {uploading && (
                      <div className="mt-2">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Mengupload cover image...
                      </div>
                    )}

                    {formData.coverImage && (
                      <div className="mt-3">
                        <div
                          className="preview-container"
                          style={{
                            maxWidth: "400px",
                            margin: "0 auto",
                            border: "1px solid #dee2e6",
                            borderRadius: "8px",
                            overflow: "hidden",
                            backgroundColor: "#f8f9fa",
                            position: "relative",
                            cursor: "pointer",
                          }}
                          onClick={() => handleImageView(formData.coverImage, "Cover Image")}
                        >
                          <Image
                            src={withBuster(formData.coverImage || "/placeholder.svg")}
                            alt="Cover Preview"
                            style={{
                              width: "100%",
                              height: "auto",
                              maxHeight: "200px",
                              objectFit: "contain",
                              display: "block",
                            }}
                            onError={(e) => {
                              console.warn("Cover preview load failed:", e.target.src)
                              e.target.src = `data:image/svg+xml;base64,${btoa(`
                                <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
                                  <rect width="400" height="200" fill="#f8f9fa"/>
                                  <text x="200" y="100" textAnchor="middle" dy="0.3em" fontFamily="Arial" fontSize="14" fill="#6c757d">
                                    Image Not Found
                                  </text>
                                </svg>
                              `)}`
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              backgroundColor: "rgba(0,0,0,0.7)",
                              color: "white",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              pointerEvents: "none",
                            }}
                          >
                            {selectedAspectRatio === "no-crop"
                              ? "Original"
                              : !aspectRatio || selectedAspectRatio === "free"
                                ? "Custom"
                                : selectedAspectRatio.replace("-", ":")}
                          </div>
                        </div>
                        <small className="text-muted d-block mt-2 text-center">
                          <FaLink className="me-1" />
                          URL:{" "}
                          {formData.coverImage.length > 50
                            ? formData.coverImage.substring(0, 50) + "..."
                            : formData.coverImage}
                        </small>
                      </div>
                    )}
                  </Form.Group>

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
                            disabled={status !== "authenticated"}
                          >
                            <FaTimes size={10} />
                          </Button>

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

                      <label
                        className="d-flex align-items-center justify-content-center text-center bg-white shadow-sm border border-primary text-gray-500 rounded cursor-pointer position-relative"
                        style={{
                          width: "120px",
                          height: "120px",
                          cursor: status === "authenticated" ? "pointer" : "not-allowed",
                          borderStyle: "dashed",
                          borderWidth: "1px",
                          opacity: status === "authenticated" ? 1 : 0.5,
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
                          disabled={status !== "authenticated"}
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
                    disabled={submitting || uploading || uploadingContentImages || status !== "authenticated"}
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
                          disabled={deletingMultiple || status !== "authenticated"}
                        >
                          <FaTrash className="me-1" />
                          {deletingMultiple ? "Menghapus..." : `Hapus (${selectedArticles.length})`}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card.Header>
                <Card.Body>
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
                          disabled={status !== "authenticated"}
                        />
                        {searchTerm && (
                          <Button
                            variant="outline-secondary"
                            onClick={() => handleSearchChange("")}
                            disabled={status !== "authenticated"}
                          >
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
                        disabled={status !== "authenticated"}
                      >
                        <Dropdown.Item
                          active={filterStatus === "all"}
                          onClick={() => setFilterStatus("all")}
                        >
                          <FaEye className="me-2" />
                          Semua Status
                        </Dropdown.Item>
                        <Dropdown.Item
                          active={filterStatus === "published"}
                          onClick={() => setFilterStatus("published")}
                        >
                          <FaCheckCircle className="me-2" />
                          Published
                        </Dropdown.Item>
                        <Dropdown.Item
                          active={filterStatus === "draft"}
                          onClick={() => setFilterStatus("draft")}
                        >
                          <FaPencilAlt className="me-2" />
                          Draft
                        </Dropdown.Item>
                        <Dropdown.Item
                          active={filterStatus === "archived"}
                          onClick={() => setFilterStatus("archived")}
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
                        disabled={status !== "authenticated"}
                      >
                        <Dropdown.Item
                          active={filterGallery === "all"}
                          onClick={() => setFilterGallery("all")}
                        >
                          Semua Gallery
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        {galleries.map((gallery) => (
                          <Dropdown.Item
                            key={gallery._id}
                            active={filterGallery === gallery._id}
                            onClick={() => setFilterGallery(gallery._id)}
                          >
                            {gallery.title} - {gallery.label}
                          </Dropdown.Item>
                        ))}
                      </DropdownButton>
                    </Col>
                  </Row>

                  <div className="table-responsive">
                    <Table striped bordered hover>
                      <thead>
                        <tr>
                          <th style={{ width: "50px" }}>
                            <Form.Check
                              type="checkbox"
                              checked={selectAll}
                              onChange={handleSelectAll}
                              disabled={status !== "authenticated"}
                            />
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
                                  disabled={status !== "authenticated"}
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
                                      disabled={status !== "authenticated"}
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
                                      disabled={status !== "authenticated"}
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

                  {renderPagination()}
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        </Card.Header>
      </Card>

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

      <Modal show={showCropModal} onHide={() => false} centered size="lg" backdrop="static" keyboard={false}>
        <Modal.Header>
          <Modal.Title>
            <FaCrop className="me-2 text-primary" />
            Crop Gambar
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {previewImage && (
            <>
              {!noCrop && (
                <div className="mb-3">
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={aspectRatio}
                    minWidth={50}
                    minHeight={50}
                    keepSelection
                    style={{ maxWidth: "100%", maxHeight: "400px" }}
                  >
                    <img
                      ref={setImgRef}
                      alt="Crop me"
                      src={previewImage || "/placeholder.svg"}
                      style={{ maxWidth: "100%", maxHeight: "400px", display: "block" }}
                      onLoad={onImageLoad}
                    />
                  </ReactCrop>
                </div>
              )}

              {noCrop && (
                <div className="mb-3 text-center">
                  <img
                    alt="Original image preview"
                    src={previewImage || "/placeholder.svg"}
                    style={{
                      maxWidth: "300px",
                      maxHeight: "250px",
                      height: "auto",
                      display: "block",
                      margin: "0 auto",
                      border: "2px solid #dee2e6",
                      borderRadius: "8px",
                      objectFit: "contain",
                    }}
                  />
                  <small className="text-muted mt-2 d-block">
                    Preview gambar original - akan diupload tanpa cropping
                  </small>
                </div>
              )}

              <div className="mb-3">
                <Form.Label>Aspect Ratio:</Form.Label>
                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={noCrop ? "success" : "outline-success"}
                    onClick={() => {
                      setNoCrop(true)
                      setAspectRatio(undefined)
                      setCrop(undefined)
                      setCompletedCrop(undefined)
                      setSelectedAspectRatio("no-crop")
                    }}
                  >
                    <FaUpload className="me-1" />
                    No Crop
                  </Button>
                  <Button
                    size="sm"
                    variant={aspectRatio === 16 / 9 && !noCrop ? "primary" : "outline-primary"}
                    onClick={() => {
                      setNoCrop(false)
                      setAspectRatio(16 / 9)
                      setCrop(undefined)
                      setCompletedCrop(undefined)
                      setSelectedAspectRatio("16-9")
                      setTimeout(() => {
                        if (imgRef) {
                          const { width, height } = imgRef
                          const ar = 16 / 9
                          let cw, ch
                          if (width / height > ar) {
                            ch = height * 0.8
                            cw = ch * ar
                          } else {
                            cw = width * 0.8
                            ch = cw / ar
                          }
                          setCrop({
                            unit: "%",
                            x: (100 - (cw / width) * 100) / 2,
                            y: (100 - (ch / height) * 100) / 2,
                            width: (cw / width) * 100,
                            height: (ch / height) * 100,
                          })
                        }
                      }, 100)
                    }}
                  >
                    16:9
                  </Button>
                  <Button
                    size="sm"
                    variant={aspectRatio === 4 / 3 && !noCrop ? "primary" : "outline-primary"}
                    onClick={() => {
                      setNoCrop(false)
                      setAspectRatio(4 / 3)
                      setCrop(undefined)
                      setCompletedCrop(undefined)
                      setSelectedAspectRatio("4-3")
                      setTimeout(() => {
                        if (imgRef) {
                          const { width, height } = imgRef
                          const ar = 4 / 3
                          let cw, ch
                          if (width / height > ar) {
                            ch = height * 0.8
                            cw = ch * ar
                          } else {
                            cw = width * 0.8
                            ch = cw / ar
                          }
                          setCrop({
                            unit: "%",
                            x: (100 - (cw / width) * 100) / 2,
                            y: (100 - (ch / height) * 100) / 2,
                            width: (cw / width) * 100,
                            height: (ch / height) * 100,
                          })
                        }
                      }, 100)
                    }}
                  >
                    4:3
                  </Button>
                  <Button
                    size="sm"
                    variant={aspectRatio === 1 && !noCrop ? "primary" : "outline-primary"}
                    onClick={() => {
                      setNoCrop(false)
                      setAspectRatio(1)
                      setCrop(undefined)
                      setCompletedCrop(undefined)
                      setSelectedAspectRatio("1-1")
                      setTimeout(() => {
                        if (imgRef) {
                          const { width, height } = imgRef
                          const size = Math.min(width, height) * 0.8
                          setCrop({
                            unit: "%",
                            x: (100 - (size / width) * 100) / 2,
                            y: (100 - (size / height) * 100) / 2,
                            width: (size / width) * 100,
                            height: (size / height) * 100,
                          })
                        }
                      }, 100)
                    }}
                  >
                    1:1
                  </Button>
                  <Button
                    size="sm"
                    variant={aspectRatio === 3 / 4 && !noCrop ? "primary" : "outline-primary"}
                    onClick={() => {
                      setNoCrop(false)
                      setAspectRatio(3 / 4)
                      setCrop(undefined)
                      setCompletedCrop(undefined)
                      setSelectedAspectRatio("3-4")
                      setTimeout(() => {
                        if (imgRef) {
                          const { width, height } = imgRef
                          const ar = 3 / 4
                          let cw, ch
                          if (width / height > ar) {
                            ch = height * 0.8
                            cw = ch * ar
                          } else {
                            cw = width * 0.8
                            ch = cw / ar
                          }
                          setCrop({
                            unit: "%",
                            x: (100 - (cw / width) * 100) / 2,
                            y: (100 - (ch / height) * 100) / 2,
                            width: (cw / width) * 100,
                            height: (ch / height) * 100,
                          })
                        }
                      }, 100)
                    }}
                  >
                    3:4
                  </Button>
                  <Button
                    size="sm"
                    variant={!aspectRatio && !noCrop ? "primary" : "outline-primary"}
                    onClick={() => {
                      setNoCrop(false)
                      setAspectRatio(undefined)
                      setCrop(undefined)
                      setCompletedCrop(undefined)
                      setSelectedAspectRatio("free")
                      setTimeout(() => {
                        if (imgRef) {
                          const { width, height } = imgRef
                          setCrop({
                            unit: "%",
                            x: 10,
                            y: 10,
                            width: 80,
                            height: 80,
                          })
                        }
                      }, 100)
                    }}
                  >
                    Free
                  </Button>
                </div>
                {noCrop && (
                  <Alert variant="info" className="mt-2">
                    <FaInfoCircle className="me-2" />
                    Mode "No Crop": Gambar akan diupload dalam ukuran original.
                  </Alert>
                )}
              </div>

              {!noCrop && (
                <Alert variant="info" className="mt-3">
                  <FaInfoCircle className="me-2" />
                  Drag sudut atau sisi crop area untuk mengubah ukuran. Drag bagian tengah untuk memindahkan posisi.
                </Alert>
              )}
            </>
          )}
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
              setNoCrop(false)
              setSelectedAspectRatio("16-9")
              if (fileInputRef.current) {
                fileInputRef.current.value = ""
              }
            }}
            disabled={uploading}
          >
            <FaTimes className="me-2" />
            Batal
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (noCrop) {
                handleDirectUpload()
              } else {
                handleCropAndUpload()
              }
            }}
            disabled={uploading || (!completedCrop && !noCrop)}
          >
            {uploading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Mengupload...
              </>
            ) : (
              <>
                <FaUpload className="me-2" />
                {noCrop ? "Upload Gambar" : "Crop & Upload"}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

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
                    disabled={status !== "authenticated"}
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
                        publishedAt:
                          e.target.value === "published" && !prev.publishedAt
                            ? getCurrentLocalDateTime()
                            : prev.publishedAt,
                      }))
                    }
                    style={{ backgroundColor: "white", color: "black" }}
                    disabled={status !== "authenticated"}
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
                disabled={status !== "authenticated"}
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
                disabled={status !== "authenticated"}
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
                    disabled={status !== "authenticated"}
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
                      disabled={status !== "authenticated"}
                    />
                    <Form.Text className="text-muted">Kosongkan untuk menggunakan waktu sekarang</Form.Text>
                  </Form.Group>
                )}
              </Col>
            </Row>

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
                  disabled={status !== "authenticated"}
                />
                <Button
                  variant="outline-secondary"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || status !== "authenticated"}
                >
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
                      style={{ cursor: status === "authenticated" ? "pointer" : "not-allowed" }}
                      onClick={() => status === "authenticated" && handleRemoveTag(tag)}
                    >
                      {tag} <FaTimes className="ms-1" />
                    </Badge>
                  ))}
                </div>
              )}
            </Form.Group>

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
                  disabled={status !== "authenticated"}
                />
                {(selectedFile || previewImage) && (
                  <Button
                    variant="outline-info"
                    onClick={handlePreviewClick}
                    disabled={uploading || status !== "authenticated"}
                    title="Preview & Crop Gambar"
                  >
                    <FaSearchPlus className="me-1" />
                    Preview
                  </Button>
                )}
                {formData.coverImage && (
                  <Button
                    variant="outline-danger"
                    onClick={handleReplaceCover}
                    disabled={uploading || status !== "authenticated"}
                    title="Ganti Cover Image"
                  >
                    <FaTrash className="me-1" />
                    Ganti
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
                      disabled={status !== "authenticated"}
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
                    cursor: status === "authenticated" ? "pointer" : "not-allowed",
                    borderStyle: "dashed",
                    borderWidth: "1px",
                    opacity: status === "authenticated" ? 1 : 0.5,
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
                    disabled={status !== "authenticated"}
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
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || uploading || uploadingContentImages || status !== "authenticated"}
          >
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
