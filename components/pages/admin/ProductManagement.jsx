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
  FaTimesCircle,
  FaImage,
  FaCalendarAlt,
  FaTag,
  FaCrop,
  FaUpload,
  FaInfoCircle,
  FaTimes,
  FaDollarSign,
  FaBarcode,
  FaStore,
  FaPalette,
  FaRuler,
  FaBox,
  FaShoppingCart,
} from "react-icons/fa"

// API instance
const withBuster = (url) => {
  if (!url) return url
  try {
    const sep = url.includes("?") ? "&" : "?"
    return `${url}${sep}t=${Date.now()}`
  } catch {
    return url
  }
}

const api = axios.create({
  timeout: 30000,
})

function ProductManagement() {
  const router = useRouter()
  const mainImageInputRef = useRef(null)
  const thumbnailInputRef = useRef(null)
  const isMountedRef = useRef(false)

  // Basic state
  const [isClient, setIsClient] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [error, setError] = useState("")

  // Toast notifications
  const [toasts, setToasts] = useState([])

  // Form state
  const [activeTab, setActiveTab] = useState("add")
  const [formData, setFormData] = useState({
    title: "",
    storeName: "",
    price: "",
    sku: "",
    category: "",
    badge: "",
    mainImage: { url: "", key: "" },
    thumbnails: [],
    description: "",
    details: [],
    limitedMessage: "",
    colors: [],
    sizes: [],
    sizeChart: [],
    stockVariants: [],
    has2DView: true,
    has3DView: false,
    marketplaceLinks: [],
  })
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Edit state
  const [editingProduct, setEditingProduct] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    thisMonth: 0,
  })

  // Selection and modals
  const [selectedProducts, setSelectedProducts] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [productToDelete, setProductToDelete] = useState(null)
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false)
  const [deletingMultiple, setDeletingMultiple] = useState(false)

  // Filtering and search
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterCategory, setFilterCategory] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalItems, setTotalItems] = useState(0)

  // Image crop state
  const [previewImage, setPreviewImage] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [showCropModal, setShowCropModal] = useState(false)
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState()
  const [aspectRatio, setAspectRatio] = useState(1)
  const [imgRef, setImgRef] = useState()
  const [currentImageType, setCurrentImageType] = useState("main") // 'main' or 'thumbnail'

  // Image viewer modal states
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState("")
  const [selectedImageTitle, setSelectedImageTitle] = useState("")

  // Variant management state
  const [newColor, setNewColor] = useState({ name: "", code: "#000000" })
  const [newSize, setNewSize] = useState("")
  const [newSizeChartItem, setNewSizeChartItem] = useState({ size: "", dimensions: "" })
  const [newDetail, setNewDetail] = useState("")
  const [newMarketplace, setNewMarketplace] = useState({ platform: "", url: "" })

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

  // Fetch products
  const fetchProducts = useCallback(
    async (page = 1, limit = 20) => {
      if (!isMountedRef.current) return

      setLoading(true)
      setError("")

      try {
        const token = checkAuth()
        if (!token) return

        const params = {
          page,
          limit,
          search: searchTerm,
          status: filterStatus,
          category: filterCategory,
        }

        const response = await api.get("/api/admin/product", {
          params,
          headers: { Authorization: `Bearer ${token}` },
        })

        if (isMountedRef.current) {
          setProducts(response.data.products)
          setFilteredProducts(response.data.products)
          setStats(response.data.stats)
          setCurrentPage(response.data.pagination.current)
          setTotalPages(response.data.pagination.total)
          setTotalItems(response.data.pagination.totalItems)
          setDataLoaded(true)
        }
      } catch (error) {
        if (!isMountedRef.current) return

        if (error.response?.status === 401) {
          sessionStorage.removeItem("adminToken")
          setAuthError(true)
          router.push("/admin/login")
        } else {
          setError("Gagal mengambil data produk: " + (error.response?.data?.error || error.message))
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    },
    [checkAuth, searchTerm, filterStatus, filterCategory, router],
  )

  // Initialize
  useEffect(() => {
    setIsClient(true)
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (isClient) {
      fetchProducts(currentPage, itemsPerPage)
    }
  }, [isClient, currentPage, itemsPerPage, searchTerm, filterStatus, filterCategory, fetchProducts])

  // Image crop handlers
  const onImageLoad = useCallback(
    (e) => {
      if (aspectRatio) {
        const { width, height } = e.currentTarget
        setCrop(centerCrop(makeAspectCrop({ unit: "%", width: 90 }, aspectRatio, width, height), width, height))
      }
      setImgRef(e.currentTarget)
    },
    [aspectRatio],
  )

  const createCroppedImage = useCallback(async () => {
    try {
      if (!imgRef || !completedCrop) return null

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("No 2d context")

      const pixelRatio = window.devicePixelRatio
      const pixelCrop = convertToPixelCrop(completedCrop, imgRef.naturalWidth, imgRef.naturalHeight)

      const scaleX = imgRef.naturalWidth / imgRef.width
      const scaleY = imgRef.naturalHeight / imgRef.height

      canvas.width = Math.floor(pixelCrop.width * scaleX * pixelRatio)
      canvas.height = Math.floor(pixelCrop.height * scaleY * pixelRatio)

      ctx.scale(pixelRatio, pixelRatio)
      ctx.imageSmoothingQuality = "high"

      const cropX = pixelCrop.x * scaleX
      const cropY = pixelCrop.y * scaleY

      ctx.drawImage(
        imgRef,
        cropX,
        cropY,
        pixelCrop.width * scaleX,
        pixelCrop.height * scaleY,
        0,
        0,
        pixelCrop.width * scaleX,
        pixelCrop.height * scaleY,
      )

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const croppedFile = new File([blob], selectedFile.name, {
                type: selectedFile.type,
                lastModified: Date.now(),
              })
              resolve(croppedFile)
            } else {
              reject(new Error("Failed to create blob from canvas"))
            }
          },
          selectedFile.type,
          0.95,
        )
      })
    } catch (error) {
      console.error("Error creating cropped image:", error)
      return null
    }
  }, [imgRef, completedCrop, selectedFile])

  const handleCropAndUpload = async () => {
    try {
      const croppedFile = await createCroppedImage()
      if (croppedFile) {
        await handleFileUpload(croppedFile)
      }
    } catch (error) {
      console.error("Error cropping and uploading:", error)
      addToast("Gagal memproses gambar. Silakan coba lagi.", "error")
    }
  }

  const handleFileUpload = useCallback(
    async (file) => {
      if (!file) return

      setUploading(true)

      try {
        const token = checkAuth()
        if (!token) return

        const formData = new FormData()
        formData.append("file", file)

        const response = await api.post("/api/admin/product/upload", formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        })

        if (response.data.imageUrl && typeof response.data.imageUrl === "string") {
          if (currentImageType === "main") {
            setFormData((prev) => ({
              ...prev,
              mainImage: {
                url: response.data.imageUrl,
                key: response.data.imageKey,
              },
            }))
          } else {
            setFormData((prev) => ({
              ...prev,
              thumbnails: [
                ...prev.thumbnails,
                {
                  url: response.data.imageUrl,
                  key: response.data.imageKey,
                },
              ],
            }))
          }
          addToast("Gambar berhasil diupload", "success")
        }

        setPreviewImage(null)
        setSelectedFile(null)
        setShowCropModal(false)
        setCrop(undefined)
        setCompletedCrop(undefined)
        setImgRef(undefined)
      } catch (error) {
        console.error("Image upload error:", error)
        addToast("Gagal upload gambar: " + (error.response?.data?.error || error.message), "error")
      } finally {
        setUploading(false)
      }
    },
    [checkAuth, addToast, currentImageType],
  )

  const handleFileSelect = useCallback(
    (file, imageType = "main") => {
      if (!file) return

      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
      if (!allowedTypes.includes(file.type)) {
        addToast("Format file harus JPG, PNG, atau WebP", "error")
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        addToast("Ukuran file maksimal 10MB", "error")
        return
      }

      setCurrentImageType(imageType)
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewImage(e.target.result)
        setSelectedFile(file)
        setShowCropModal(true)
      }
      reader.readAsDataURL(file)
    },
    [addToast],
  )

  // Variant management handlers
  const handleAddColor = () => {
    if (!newColor.name || !newColor.code) {
      addToast("Nama dan kode warna harus diisi", "error")
      return
    }
    setFormData((prev) => ({
      ...prev,
      colors: [...prev.colors, { ...newColor }],
    }))
    setNewColor({ name: "", code: "#000000" })
    addToast("Warna berhasil ditambahkan", "success")
  }

  const handleRemoveColor = (index) => {
    setFormData((prev) => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index),
    }))
  }

  const handleAddSize = () => {
    if (!newSize) {
      addToast("Ukuran harus diisi", "error")
      return
    }
    setFormData((prev) => ({
      ...prev,
      sizes: [...prev.sizes, newSize],
    }))
    setNewSize("")
    addToast("Ukuran berhasil ditambahkan", "success")
  }

  const handleRemoveSize = (index) => {
    setFormData((prev) => ({
      ...prev,
      sizes: prev.sizes.filter((_, i) => i !== index),
    }))
  }

  const handleAddSizeChart = () => {
    if (!newSizeChartItem.size || !newSizeChartItem.dimensions) {
      addToast("Ukuran dan dimensi harus diisi", "error")
      return
    }
    setFormData((prev) => ({
      ...prev,
      sizeChart: [...prev.sizeChart, { ...newSizeChartItem }],
    }))
    setNewSizeChartItem({ size: "", dimensions: "" })
    addToast("Size chart berhasil ditambahkan", "success")
  }

  const handleRemoveSizeChart = (index) => {
    setFormData((prev) => ({
      ...prev,
      sizeChart: prev.sizeChart.filter((_, i) => i !== index),
    }))
  }

  const handleAddDetail = () => {
    if (!newDetail) {
      addToast("Detail harus diisi", "error")
      return
    }
    setFormData((prev) => ({
      ...prev,
      details: [...prev.details, newDetail],
    }))
    setNewDetail("")
    addToast("Detail berhasil ditambahkan", "success")
  }

  const handleRemoveDetail = (index) => {
    setFormData((prev) => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== index),
    }))
  }

  const handleAddMarketplace = () => {
    if (!newMarketplace.platform || !newMarketplace.url) {
      addToast("Platform dan URL harus diisi", "error")
      return
    }
    setFormData((prev) => ({
      ...prev,
      marketplaceLinks: [...prev.marketplaceLinks, { ...newMarketplace, isActive: true }],
    }))
    setNewMarketplace({ platform: "", url: "" })
    addToast("Marketplace link berhasil ditambahkan", "success")
  }

  const handleRemoveMarketplace = (index) => {
    setFormData((prev) => ({
      ...prev,
      marketplaceLinks: prev.marketplaceLinks.filter((_, i) => i !== index),
    }))
  }

  const handleRemoveThumbnail = (index) => {
    setFormData((prev) => ({
      ...prev,
      thumbnails: prev.thumbnails.filter((_, i) => i !== index),
    }))
  }

  // Form submit
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()

      if (!formData.title || !formData.storeName || !formData.price || !formData.mainImage.url) {
        addToast("Field wajib harus diisi", "error")
        return
      }

      setSubmitting(true)

      try {
        const token = checkAuth()
        if (!token) return

        await api.post("/api/admin/product", formData, {
          headers: { Authorization: `Bearer ${token}` },
        })

        addToast("Produk berhasil ditambahkan", "success")
        setFormData({
          title: "",
          storeName: "",
          price: "",
          sku: "",
          category: "",
          badge: "",
          mainImage: { url: "", key: "" },
          thumbnails: [],
          description: "",
          details: [],
          limitedMessage: "",
          colors: [],
          sizes: [],
          sizeChart: [],
          stockVariants: [],
          has2DView: true,
          has3DView: false,
          marketplaceLinks: [],
        })

        await fetchProducts(1, itemsPerPage)
      } catch (error) {
        addToast("Gagal menambahkan produk: " + (error.response?.data?.error || error.message), "error")
      } finally {
        setSubmitting(false)
      }
    },
    [formData, checkAuth, addToast, fetchProducts, itemsPerPage],
  )

  // Delete handlers
  const handleDelete = useCallback(async () => {
    if (!productToDelete) return

    try {
      const token = checkAuth()
      if (!token) return

      await api.delete(`/api/admin/product/${productToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      addToast("Produk berhasil dihapus", "success")
      setShowDeleteModal(false)
      setProductToDelete(null)
      await fetchProducts(currentPage, itemsPerPage)
    } catch (error) {
      addToast("Gagal menghapus produk: " + (error.response?.data?.error || error.message), "error")
    }
  }, [productToDelete, checkAuth, addToast, fetchProducts, currentPage, itemsPerPage])

  const handleBulkDelete = useCallback(async () => {
    if (selectedProducts.length === 0) return

    try {
      setDeletingMultiple(true)
      const token = checkAuth()
      if (!token) return

      const response = await api.post(
        "/api/admin/product/bulk-delete",
        { ids: selectedProducts },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      addToast(`${response.data.deletedCount} produk berhasil dihapus`, "success")
      setShowDeleteMultipleModal(false)
      setSelectedProducts([])
      setSelectAll(false)
      await fetchProducts(currentPage, itemsPerPage)
    } catch (error) {
      addToast("Gagal menghapus produk: " + (error.response?.data?.error || error.message), "error")
    } finally {
      setDeletingMultiple(false)
    }
  }, [selectedProducts, checkAuth, addToast, fetchProducts, currentPage, itemsPerPage])

  // Selection handlers
  const handleSelectAll = useCallback(
    (checked) => {
      setSelectAll(checked)
      if (checked) {
        setSelectedProducts(filteredProducts.map((p) => p._id))
      } else {
        setSelectedProducts([])
      }
    },
    [filteredProducts],
  )

  const handleSelectProduct = useCallback((id, checked) => {
    if (checked) {
      setSelectedProducts((prev) => [...prev, id])
    } else {
      setSelectedProducts((prev) => prev.filter((pId) => pId !== id))
      setSelectAll(false)
    }
  }, [])

  // Utility handlers
  const handleRefresh = useCallback(() => {
    fetchProducts(currentPage, itemsPerPage)
  }, [fetchProducts, currentPage, itemsPerPage])

  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }, [])

  const handleImageView = useCallback((imageUrl, title) => {
    if (imageUrl && typeof imageUrl === "string") {
      setSelectedImageUrl(imageUrl)
      setSelectedImageTitle(title)
      setShowImageModal(true)
    }
  }, [])

  // Pagination
  const renderPagination = () => {
    if (totalPages <= 1) return null

    const items = []
    const maxVisible = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const endPage = Math.min(totalPages, startPage + maxVisible - 1)

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }

    return (
      <div className="d-flex justify-content-center mt-4">
        <Pagination>
          <Pagination.First onClick={() => setCurrentPage(1)} disabled={currentPage === 1} />
          <Pagination.Prev onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1} />

          {startPage > 1 && (
            <>
              <Pagination.Item onClick={() => setCurrentPage(1)}>1</Pagination.Item>
              {startPage > 2 && <Pagination.Ellipsis />}
            </>
          )}

          {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((page) => (
            <Pagination.Item key={page} active={page === currentPage} onClick={() => setCurrentPage(page)}>
              {page}
            </Pagination.Item>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <Pagination.Ellipsis />}
              <Pagination.Item onClick={() => setCurrentPage(totalPages)}>{totalPages}</Pagination.Item>
            </>
          )}

          <Pagination.Next onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages} />
          <Pagination.Last onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} />
        </Pagination>
      </div>
    )
  }

  // Loading states
  if (!isClient) {
    return (
      <div className="product-management-page">
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
      <div className="product-management-page">
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
      <div className="product-management-page">
        <h1 className="mb-4">Manajemen Produk</h1>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
          <div className="text-center">
            <Spinner animation="border" variant="primary" size="lg" />
            <p className="mt-3">Memuat data produk...</p>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => fetchProducts(1, itemsPerPage)}
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

  return (
    <div className="product-management-page">
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            bg={toast.type === "success" ? "success" : toast.type === "error" ? "danger" : "warning"}
            onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            delay={toast.duration}
            autohide
          >
            <Toast.Header>
              <strong className="me-auto">
                {toast.type === "success" ? "Berhasil" : toast.type === "error" ? "Error" : "Peringatan"}
              </strong>
            </Toast.Header>
            <Toast.Body className="text-white">{toast.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>

      <h1 className="mb-4">
        <FaShoppingCart className="me-2" />
        Manajemen Produk E-Commerce
      </h1>

      {/* Stats Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center shadow-sm">
            <Card.Body>
              <FaBox size={32} className="text-primary mb-2" />
              <h3>{stats.total}</h3>
              <p className="text-muted mb-0">Total Produk</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center shadow-sm">
            <Card.Body>
              <FaCheckCircle size={32} className="text-success mb-2" />
              <h3>{stats.active}</h3>
              <p className="text-muted mb-0">Produk Aktif</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center shadow-sm">
            <Card.Body>
              <FaTimesCircle size={32} className="text-danger mb-2" />
              <h3>{stats.inactive}</h3>
              <p className="text-muted mb-0">Produk Tidak Aktif</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center shadow-sm">
            <Card.Body>
              <FaCalendarAlt size={32} className="text-info mb-2" />
              <h3>{stats.thisMonth}</h3>
              <p className="text-muted mb-0">Produk Bulan Ini</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Main Content */}
      <Card className="shadow-sm">
        <Card.Body>
          <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
            {/* Add Product Tab */}
            <Tab
              eventKey="add"
              title={
                <>
                  <FaPlus className="me-2" />
                  Tambah Produk
                </>
              }
            >
              <Form onSubmit={handleSubmit}>
                <h5 className="mb-3">Informasi Dasar</h5>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaTag className="me-2" />
                        Nama Produk *
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Masukkan nama produk"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaStore className="me-2" />
                        Nama Toko *
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.storeName}
                        onChange={(e) => setFormData((prev) => ({ ...prev, storeName: e.target.value }))}
                        placeholder="Masukkan nama toko"
                        required
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaDollarSign className="me-2" />
                        Harga *
                      </Form.Label>
                      <Form.Control
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                        placeholder="Masukkan harga"
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaBarcode className="me-2" />
                        SKU
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.sku}
                        onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                        placeholder="Masukkan SKU"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <FaTag className="me-2" />
                        Kategori
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                        placeholder="Masukkan kategori"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>Badge</Form.Label>
                      <Form.Select
                        value={formData.badge}
                        onChange={(e) => setFormData((prev) => ({ ...prev, badge: e.target.value }))}
                      >
                        <option value="">Pilih Badge</option>
                        <option value="NEW">NEW</option>
                        <option value="BEST">BEST SELLER</option>
                        <option value="LIMITED">LIMITED</option>
                        <option value="SALE">SALE</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <hr />
                <h5 className="mb-3">Gambar Produk</h5>

                {/* Main Image */}
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaImage className="me-2" />
                    Gambar Utama *
                  </Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    ref={mainImageInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileSelect(file, "main")
                    }}
                    style={{ display: formData.mainImage.url ? "none" : "block" }}
                  />
                  {formData.mainImage.url && (
                    <div className="mt-2">
                      <Image
                        src={formData.mainImage.url || "/placeholder.svg"}
                        alt="Main"
                        thumbnail
                        style={{ width: "150px", cursor: "pointer" }}
                        onClick={() => handleImageView(formData.mainImage.url, "Main Image")}
                      />
                      <Button
                        variant="outline-danger"
                        size="sm"
                        className="ms-2"
                        onClick={() => setFormData((prev) => ({ ...prev, mainImage: { url: "", key: "" } }))}
                      >
                        <FaTrash />
                      </Button>
                    </div>
                  )}
                </Form.Group>

                {/* Thumbnails */}
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaImage className="me-2" />
                    Gambar Tambahan
                  </Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*"
                    ref={thumbnailInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileSelect(file, "thumbnail")
                    }}
                  />
                  {formData.thumbnails.length > 0 && (
                    <div className="mt-2 d-flex gap-2 flex-wrap">
                      {formData.thumbnails.map((thumb, index) => (
                        <div key={index} className="position-relative">
                          <Image
                            src={thumb.url || "/placeholder.svg"}
                            alt={`Thumbnail ${index + 1}`}
                            thumbnail
                            style={{ width: "100px", cursor: "pointer" }}
                            onClick={() => handleImageView(thumb.url, `Thumbnail ${index + 1}`)}
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            className="position-absolute top-0 end-0"
                            onClick={() => handleRemoveThumbnail(index)}
                          >
                            <FaTimes />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Form.Group>

                <hr />
                <h5 className="mb-3">Deskripsi & Detail</h5>

                <Form.Group className="mb-3">
                  <Form.Label>Deskripsi Produk</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Masukkan deskripsi produk"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Limited Message</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.limitedMessage}
                    onChange={(e) => setFormData((prev) => ({ ...prev, limitedMessage: e.target.value }))}
                    placeholder="Contoh: Limited drop. Grab yours before it's gone!"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Detail Produk</Form.Label>
                  <InputGroup className="mb-2">
                    <Form.Control
                      type="text"
                      value={newDetail}
                      onChange={(e) => setNewDetail(e.target.value)}
                      placeholder="Masukkan detail produk"
                    />
                    <Button variant="primary" onClick={handleAddDetail}>
                      <FaPlus />
                    </Button>
                  </InputGroup>
                  {formData.details.length > 0 && (
                    <ul className="list-group">
                      {formData.details.map((detail, index) => (
                        <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                          {detail}
                          <Button variant="outline-danger" size="sm" onClick={() => handleRemoveDetail(index)}>
                            <FaTrash />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Form.Group>

                <hr />
                <h5 className="mb-3">Varian Produk</h5>

                {/* Colors */}
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaPalette className="me-2" />
                    Warna
                  </Form.Label>
                  <Row>
                    <Col md={5}>
                      <Form.Control
                        type="text"
                        value={newColor.name}
                        onChange={(e) => setNewColor((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Nama warna"
                      />
                    </Col>
                    <Col md={5}>
                      <Form.Control
                        type="color"
                        value={newColor.code}
                        onChange={(e) => setNewColor((prev) => ({ ...prev, code: e.target.value }))}
                      />
                    </Col>
                    <Col md={2}>
                      <Button variant="primary" onClick={handleAddColor} className="w-100">
                        <FaPlus />
                      </Button>
                    </Col>
                  </Row>
                  {formData.colors.length > 0 && (
                    <div className="mt-2 d-flex gap-2 flex-wrap">
                      {formData.colors.map((color, index) => (
                        <Badge key={index} bg="light" text="dark" className="d-flex align-items-center gap-2 p-2">
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              backgroundColor: color.code,
                              border: "1px solid #ccc",
                              borderRadius: "4px",
                            }}
                          />
                          {color.name}
                          <FaTimes style={{ cursor: "pointer" }} onClick={() => handleRemoveColor(index)} />
                        </Badge>
                      ))}
                    </div>
                  )}
                </Form.Group>

                {/* Sizes */}
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FaRuler className="me-2" />
                    Ukuran
                  </Form.Label>
                  <InputGroup className="mb-2">
                    <Form.Control
                      type="text"
                      value={newSize}
                      onChange={(e) => setNewSize(e.target.value)}
                      placeholder="Masukkan ukuran (contoh: XS, S, M, L, XL)"
                    />
                    <Button variant="primary" onClick={handleAddSize}>
                      <FaPlus />
                    </Button>
                  </InputGroup>
                  {formData.sizes.length > 0 && (
                    <div className="d-flex gap-2 flex-wrap">
                      {formData.sizes.map((size, index) => (
                        <Badge key={index} bg="secondary" className="d-flex align-items-center gap-2 p-2">
                          {size}
                          <FaTimes style={{ cursor: "pointer" }} onClick={() => handleRemoveSize(index)} />
                        </Badge>
                      ))}
                    </div>
                  )}
                </Form.Group>

                {/* Size Chart */}
                <Form.Group className="mb-3">
                  <Form.Label>Tabel Ukuran</Form.Label>
                  <Row className="mb-2">
                    <Col md={5}>
                      <Form.Control
                        type="text"
                        value={newSizeChartItem.size}
                        onChange={(e) => setNewSizeChartItem((prev) => ({ ...prev, size: e.target.value }))}
                        placeholder="Ukuran (contoh: S)"
                      />
                    </Col>
                    <Col md={5}>
                      <Form.Control
                        type="text"
                        value={newSizeChartItem.dimensions}
                        onChange={(e) => setNewSizeChartItem((prev) => ({ ...prev, dimensions: e.target.value }))}
                        placeholder="Dimensi (contoh: 46 x 66 cm)"
                      />
                    </Col>
                    <Col md={2}>
                      <Button variant="primary" onClick={handleAddSizeChart} className="w-100">
                        <FaPlus />
                      </Button>
                    </Col>
                  </Row>
                  {formData.sizeChart.length > 0 && (
                    <Table striped bordered size="sm">
                      <thead>
                        <tr>
                          <th>Ukuran</th>
                          <th>Dimensi</th>
                          <th style={{ width: "80px" }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.sizeChart.map((item, index) => (
                          <tr key={index}>
                            <td>{item.size}</td>
                            <td>{item.dimensions}</td>
                            <td>
                              <Button variant="outline-danger" size="sm" onClick={() => handleRemoveSizeChart(index)}>
                                <FaTrash />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Form.Group>

                <hr />
                <h5 className="mb-3">Marketplace Links</h5>

                <Form.Group className="mb-3">
                  <Row className="mb-2">
                    <Col md={5}>
                      <Form.Control
                        type="text"
                        value={newMarketplace.platform}
                        onChange={(e) => setNewMarketplace((prev) => ({ ...prev, platform: e.target.value }))}
                        placeholder="Platform (contoh: Shopee, Tokopedia)"
                      />
                    </Col>
                    <Col md={5}>
                      <Form.Control
                        type="url"
                        value={newMarketplace.url}
                        onChange={(e) => setNewMarketplace((prev) => ({ ...prev, url: e.target.value }))}
                        placeholder="URL produk"
                      />
                    </Col>
                    <Col md={2}>
                      <Button variant="primary" onClick={handleAddMarketplace} className="w-100">
                        <FaPlus />
                      </Button>
                    </Col>
                  </Row>
                  {formData.marketplaceLinks.length > 0 && (
                    <Table striped bordered size="sm">
                      <thead>
                        <tr>
                          <th>Platform</th>
                          <th>URL</th>
                          <th style={{ width: "80px" }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.marketplaceLinks.map((link, index) => (
                          <tr key={index}>
                            <td>{link.platform}</td>
                            <td>
                              <a href={link.url} target="_blank" rel="noopener noreferrer">
                                {link.url.substring(0, 50)}...
                              </a>
                            </td>
                            <td>
                              <Button variant="outline-danger" size="sm" onClick={() => handleRemoveMarketplace(index)}>
                                <FaTrash />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Form.Group>

                <hr />
                <h5 className="mb-3">Opsi Tampilan</h5>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Tampilkan 2D View"
                    checked={formData.has2DView}
                    onChange={(e) => setFormData((prev) => ({ ...prev, has2DView: e.target.checked }))}
                  />
                  <Form.Check
                    type="checkbox"
                    label="Tampilkan 3D View"
                    checked={formData.has3DView}
                    onChange={(e) => setFormData((prev) => ({ ...prev, has3DView: e.target.checked }))}
                  />
                </Form.Group>

                <div className="d-flex gap-2 justify-content-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setFormData({
                        title: "",
                        storeName: "",
                        price: "",
                        sku: "",
                        category: "",
                        badge: "",
                        mainImage: { url: "", key: "" },
                        thumbnails: [],
                        description: "",
                        details: [],
                        limitedMessage: "",
                        colors: [],
                        sizes: [],
                        sizeChart: [],
                        stockVariants: [],
                        has2DView: true,
                        has3DView: false,
                        marketplaceLinks: [],
                      })
                    }}
                  >
                    Reset Form
                  </Button>
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <FaPlus className="me-2" />
                        Tambah Produk
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </Tab>

            {/* Manage Products Tab */}
            <Tab
              eventKey="manage"
              title={
                <>
                  <FaBox className="me-2" />
                  Kelola Produk
                </>
              }
            >
              {/* Action Buttons */}
              <div className="d-flex justify-content-between mb-3">
                <div className="d-flex gap-2">
                  <Button variant="primary" onClick={handleRefresh} disabled={loading}>
                    <FaSync className={loading ? "fa-spin" : ""} />
                  </Button>
                  {selectedProducts.length > 0 && (
                    <Button variant="danger" onClick={() => setShowDeleteMultipleModal(true)}>
                      <FaTrash className="me-2" />
                      Hapus {selectedProducts.length} Produk
                    </Button>
                  )}
                </div>
                <div className="text-muted">Total: {totalItems} produk</div>
              </div>

              {/* Search and Filter */}
              <Row className="mb-3">
                <Col md={6}>
                  <InputGroup>
                    <InputGroup.Text>
                      <FaSearch />
                    </InputGroup.Text>
                    <Form.Control
                      placeholder="Cari nama produk, SKU, atau kategori..."
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
                        {filterStatus === "active" && "Aktif"}
                        {filterStatus === "inactive" && "Tidak Aktif"}
                      </>
                    }
                    variant="outline-secondary"
                  >
                    <Dropdown.Item active={filterStatus === "all"} onClick={() => setFilterStatus("all")}>
                      Semua Status
                    </Dropdown.Item>
                    <Dropdown.Item active={filterStatus === "active"} onClick={() => setFilterStatus("active")}>
                      Aktif
                    </Dropdown.Item>
                    <Dropdown.Item active={filterStatus === "inactive"} onClick={() => setFilterStatus("inactive")}>
                      Tidak Aktif
                    </Dropdown.Item>
                  </DropdownButton>
                </Col>
                <Col md={3}>
                  <Form.Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="all">Semua Kategori</option>
                    <option value="T-Shirt">T-Shirt</option>
                    <option value="Stickers">Stickers</option>
                    <option value="Accessories">Accessories</option>
                  </Form.Select>
                </Col>
              </Row>

              {/* Table */}
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead className="table-dark">
                    <tr>
                      <th style={{ width: "50px" }}>
                        <Form.Check
                          type="checkbox"
                          checked={selectAll}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          disabled={loading || filteredProducts.length === 0}
                        />
                      </th>
                      <th>Gambar</th>
                      <th>Nama Produk</th>
                      <th>Harga</th>
                      <th>Kategori</th>
                      <th>Status</th>
                      <th style={{ width: "140px" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-4">
                          <Spinner animation="border" size="sm" className="me-2" />
                          Loading...
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-4 text-muted">
                          {searchTerm ? "Tidak ada produk yang sesuai dengan pencarian" : "Belum ada produk"}
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => (
                        <tr key={product._id}>
                          <td>
                            <Form.Check
                              type="checkbox"
                              checked={selectedProducts.includes(product._id)}
                              onChange={(e) => handleSelectProduct(product._id, e.target.checked)}
                            />
                          </td>
                          <td>
                            <Image
                              src={product.mainImage?.url || "/placeholder.svg"}
                              alt={product.title}
                              thumbnail
                              style={{ width: "80px", height: "60px", objectFit: "cover", cursor: "pointer" }}
                              onClick={() => handleImageView(product.mainImage?.url, product.title)}
                            />
                          </td>
                          <td>
                            <div>{product.title}</div>
                            {product.badge && (
                              <Badge bg="warning" className="mt-1">
                                {product.badge}
                              </Badge>
                            )}
                          </td>
                          <td>Rp {Number(product.price).toLocaleString("id-ID")}</td>
                          <td>{product.category || "-"}</td>
                          <td>
                            {product.isActive ? (
                              <Badge bg="success">
                                <FaCheckCircle className="me-1" />
                                Aktif
                              </Badge>
                            ) : (
                              <Badge bg="danger">
                                <FaTimesCircle className="me-1" />
                                Tidak Aktif
                              </Badge>
                            )}
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <OverlayTrigger placement="top" overlay={<Tooltip>Lihat Detail</Tooltip>}>
                                <Button
                                  variant="outline-info"
                                  size="sm"
                                  onClick={() => handleImageView(product.mainImage?.url, product.title)}
                                >
                                  <FaEye />
                                </Button>
                              </OverlayTrigger>
                              <OverlayTrigger placement="top" overlay={<Tooltip>Edit Produk</Tooltip>}>
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => {
                                    setEditingProduct(product)
                                    setShowEditModal(true)
                                  }}
                                >
                                  <FaEdit />
                                </Button>
                              </OverlayTrigger>
                              <OverlayTrigger placement="top" overlay={<Tooltip>Hapus Produk</Tooltip>}>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => {
                                    setProductToDelete(product)
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

              {renderPagination()}
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      {/* Image Viewer Modal */}
      <Modal show={showImageModal} onHide={() => setShowImageModal(false)} centered size="xl">
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title>
            <FaImage className="me-2" />
            {selectedImageTitle}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          className="p-0 bg-dark d-flex justify-content-center align-items-center"
          style={{ minHeight: "60vh" }}
        >
          <Image
            src={selectedImageUrl || "/placeholder.svg"}
            alt={selectedImageTitle}
            style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }}
          />
        </Modal.Body>
        <Modal.Footer className="bg-dark text-white">
          <Button variant="outline-light" onClick={() => setShowImageModal(false)}>
            <FaTimes className="me-1" />
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" />
            Konfirmasi Hapus
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menghapus produk <strong className="text-danger">{productToDelete?.title}</strong>?
          </p>
          <Alert variant="warning" className="mb-0">
            <FaExclamationTriangle className="me-2" />
            Tindakan ini tidak dapat dibatalkan dan akan menghapus semua gambar dari server.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            <FaTrash className="me-2" />
            Hapus
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Multiple Modal */}
      <Modal show={showDeleteMultipleModal} onHide={() => setShowDeleteMultipleModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" />
            Konfirmasi Hapus Multiple
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Apakah Anda yakin ingin menghapus <strong>{selectedProducts.length}</strong> produk yang dipilih?
          </p>
          <Alert variant="warning" className="mb-0">
            <FaExclamationTriangle className="me-2" />
            Tindakan ini tidak dapat dibatalkan.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteMultipleModal(false)} disabled={deletingMultiple}>
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
                <FaTrash className="me-1" />
                Hapus {selectedProducts.length} Produk
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Crop Modal */}
      <Modal show={showCropModal} onHide={() => setShowCropModal(false)} centered size="lg" backdrop="static">
        <Modal.Header>
          <Modal.Title>
            <FaCrop className="me-2 text-primary" />
            Crop Gambar
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {previewImage && (
            <>
              <div className="mb-3">
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
                    style={{ maxWidth: "100%", maxHeight: "400px", display: "block" }}
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
              </div>

              <div className="mb-3">
                <Form.Label>Aspect Ratio:</Form.Label>
                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={aspectRatio === 1 ? "primary" : "outline-primary"}
                    onClick={() => setAspectRatio(1)}
                  >
                    1:1
                  </Button>
                  <Button
                    size="sm"
                    variant={aspectRatio === 4 / 3 ? "primary" : "outline-primary"}
                    onClick={() => setAspectRatio(4 / 3)}
                  >
                    4:3
                  </Button>
                  <Button
                    size="sm"
                    variant={aspectRatio === 16 / 9 ? "primary" : "outline-primary"}
                    onClick={() => setAspectRatio(16 / 9)}
                  >
                    16:9
                  </Button>
                  <Button
                    size="sm"
                    variant={aspectRatio === 3 / 4 ? "primary" : "outline-primary"}
                    onClick={() => setAspectRatio(3 / 4)}
                  >
                    3:4
                  </Button>
                  <Button
                    size="sm"
                    variant={!aspectRatio ? "primary" : "outline-primary"}
                    onClick={() => setAspectRatio(undefined)}
                  >
                    Free
                  </Button>
                </div>
              </div>

              <Alert variant="info">
                <FaInfoCircle className="me-2" />
                Drag sudut atau sisi crop area untuk mengubah ukuran. Drag bagian tengah untuk memindahkan posisi.
              </Alert>
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
            }}
            disabled={uploading}
          >
            <FaTimes className="me-2" />
            Batal
          </Button>
          <Button variant="primary" onClick={handleCropAndUpload} disabled={uploading || !completedCrop}>
            {uploading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Mengupload...
              </>
            ) : (
              <>
                <FaUpload className="me-2" />
                Crop & Upload
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default ProductManagement
