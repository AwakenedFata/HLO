"use client"

import { useState, useEffect } from "react"
import { Container, Row, Col } from "react-bootstrap"
import { ShoppingCart, Plus, Minus, Star, Search, Filter, Heart, Eye } from "lucide-react"
import { merchandiseProducts, merchandiseCategories } from "@/data/index.js"
import { useMobileDetect } from "@/hooks/use-mobile"
import Image from "next/image"
// Simplified types
interface Product {
  id: number
  name: string
  description: string
  price: number
  originalPrice: number
  image: string
  category: string
  stock: number
  rating: number
  reviewCount: number
  sizes?: string[]
  colors?: string[]
  tags: string[]
  isNew: boolean
  isBestseller: boolean
  discount: number
}

interface CartItem extends Product {
  quantity: number
  selectedSize?: string | null
  selectedColor?: string | null
}

function MerchanPage() {
  const isMobile = useMobileDetect()
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showCart, setShowCart] = useState(false)
  const [sortBy, setSortBy] = useState("newest")
  const [priceRange, setPriceRange] = useState([0, 500000])
  const [showFilters, setShowFilters] = useState(false)
  const [wishlist, setWishlist] = useState<number[]>([])
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("hokMerchCart")
    const savedWishlist = localStorage.getItem("hokMerchWishlist")
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart))
      } catch (error) {
        console.error("Error parsing saved cart:", error)
      }
    }
    if (savedWishlist) {
      try {
        setWishlist(JSON.parse(savedWishlist))
      } catch (error) {
        console.error("Error parsing saved wishlist:", error)
      }
    }
  }, [])

  // Save cart to localStorage whenever cart changes
  useEffect(() => {
    localStorage.setItem("hokMerchCart", JSON.stringify(cart))
  }, [cart])

  // Save wishlist to localStorage whenever wishlist changes
  useEffect(() => {
    localStorage.setItem("hokMerchWishlist", JSON.stringify(wishlist))
  }, [wishlist])

  const addToCart = (product: Product, selectedSize: string | null = null, selectedColor: string | null = null) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(
        (item) => item.id === product.id && item.selectedSize === selectedSize && item.selectedColor === selectedColor,
      )

      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id && item.selectedSize === selectedSize && item.selectedColor === selectedColor
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      }

      const newCartItem: CartItem = {
        ...product,
        quantity: 1,
        selectedSize: selectedSize || product.sizes?.[0] || null,
        selectedColor: selectedColor || product.colors?.[0] || null,
      }

      return [...prevCart, newCartItem]
    })
  }

  const removeFromCart = (productId: number, selectedSize: string | null, selectedColor: string | null) => {
    setCart((prevCart) =>
      prevCart.filter(
        (item) =>
          !(item.id === productId && item.selectedSize === selectedSize && item.selectedColor === selectedColor),
      ),
    )
  }

  const updateQuantity = (
    productId: number,
    selectedSize: string | null,
    selectedColor: string | null,
    newQuantity: number,
  ) => {
    if (newQuantity === 0) {
      removeFromCart(productId, selectedSize, selectedColor)
      return
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId && item.selectedSize === selectedSize && item.selectedColor === selectedColor
          ? { ...item, quantity: newQuantity }
          : item,
      ),
    )
  }

  const toggleWishlist = (productId: number) => {
    setWishlist((prevWishlist) => {
      if (prevWishlist.includes(productId)) {
        return prevWishlist.filter((id) => id !== productId)
      }
      return [...prevWishlist, productId]
    })
  }

  const filteredProducts = merchandiseProducts.filter((product: any) => {
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1]
    return matchesCategory && matchesSearch && matchesPrice
  })

  const sortedProducts = [...filteredProducts].sort((a: any, b: any) => {
    switch (sortBy) {
      case "price-low":
        return a.price - b.price
      case "price-high":
        return b.price - a.price
      case "rating":
        return b.rating - a.rating
      case "popular":
        return b.reviewCount - a.reviewCount
      case "newest":
      default:
        return b.id - a.id
    }
  })

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  const cartItemsCount = cart.reduce((total, item) => total + item.quantity, 0)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const ProductCard = ({ product }: { product: any }) => {
    const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || null)
    const [selectedColor, setSelectedColor] = useState(product.colors?.[0] || null)
    const isInWishlist = wishlist.includes(product.id)

    return (
      <Col lg={3} md={4} sm={6} xs={12} className="mb-4">
        <div
          className="product-card h-100 position-relative shadow-sm border-0 rounded-3 overflow-hidden"
          style={{ backgroundColor: "white", transition: "all 0.3s ease" }}
          onMouseEnter={(e) => {
            if (!isMobile) {
              e.currentTarget.style.transform = "translateY(-5px)"
              e.currentTarget.style.boxShadow = "0 10px 25px rgba(245, 171, 29, 0.15)"
            }
          }}
          onMouseLeave={(e) => {
            if (!isMobile) {
              e.currentTarget.style.transform = "translateY(0)"
              e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)"
            }
          }}
        >
          {/* Product Badges */}
          <div className="product-badges position-absolute" style={{ top: "15px", left: "15px", zIndex: 2 }}>
            {product.isNew && (
              <span
                className="badge me-1 mb-1 px-2 py-1 rounded-pill fw-bold"
                style={{ backgroundColor: "#f5ab1d", color: "white", fontSize: "0.7rem" }}
              >
                NEW
              </span>
            )}
            {product.isBestseller && (
              <span
                className="badge me-1 mb-1 px-2 py-1 rounded-pill fw-bold"
                style={{ backgroundColor: "#28a745", color: "white", fontSize: "0.7rem" }}
              >
                BESTSELLER
              </span>
            )}
            {product.discount > 0 && (
              <span
                className="badge me-1 mb-1 px-2 py-1 rounded-pill fw-bold"
                style={{ backgroundColor: "#dc3545", color: "white", fontSize: "0.7rem" }}
              >
                -{product.discount}%
              </span>
            )}
          </div>

          {/* Wishlist & Quick View */}
          <div className="product-actions position-absolute" style={{ top: "15px", right: "15px", zIndex: 2 }}>
            <button
              className={`btn btn-sm rounded-circle me-2 shadow-sm ${isInWishlist ? "text-white" : "text-dark"}`}
              style={{
                backgroundColor: isInWishlist ? "#f5ab1d" : "white",
                border: "1px solid #f5ab1d",
                width: "35px",
                height: "35px",
              }}
              onClick={() => toggleWishlist(product.id)}
            >
              <Heart size={16} fill={isInWishlist ? "white" : "none"} />
            </button>
            <button
              className="btn btn-sm rounded-circle shadow-sm"
              style={{
                backgroundColor: "white",
                border: "1px solid #f5ab1d",
                color: "#f5ab1d",
                width: "35px",
                height: "35px",
              }}
              onClick={() => setQuickViewProduct(product)}
            >
              <Eye size={16} />
            </button>
          </div>

          {/* Product Image */}
          <div className="product-image-container position-relative overflow-hidden">
            <Image
              src={product.image || "/placeholder.svg?height=300&width=300"}
              alt={product.name}
              className="product-image w-100"
              style={{ height: "280px", objectFit: "cover" }}
              width={1000} height={1000}
            />
          </div>

          {/* Product Info */}
          <div className="product-info p-4">
            <h6 className="product-name fw-bold mb-2" style={{ color: "#2c3e50", fontSize: "1.1rem" }}>
              {product.name}
            </h6>
            <p className="product-description mb-3" style={{ color: "#6c757d", fontSize: "0.9rem", lineHeight: "1.4" }}>
              {product.description.substring(0, 80)}...
            </p>

            {/* Rating */}
            <div className="product-rating d-flex align-items-center mb-3">
              <div className="stars me-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={i < Math.floor(product.rating) ? "text-warning" : "text-muted"}
                    fill={i < Math.floor(product.rating) ? "currentColor" : "none"}
                  />
                ))}
              </div>
              <small style={{ color: "#6c757d" }}>({product.reviewCount})</small>
            </div>

            {/* Price */}
            <div className="product-price mb-3">
              <span className="current-price fw-bold fs-5" style={{ color: "#f5ab1d" }}>
                {formatPrice(product.price)}
              </span>
              {product.originalPrice > product.price && (
                <span className="original-price text-muted text-decoration-line-through ms-2 small">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>

            {/* Size Selection */}
            {product.sizes && product.sizes.length > 1 && (
              <div className="size-selection mb-3">
                <small className="d-block mb-2 fw-semibold" style={{ color: "#495057" }}>
                  Size:
                </small>
                <div className="d-flex flex-wrap gap-1">
                  {product.sizes.map((size: string) => (
                    <button
                      key={size}
                      className={`btn btn-sm px-3 py-1 rounded-pill ${selectedSize === size ? "text-white" : ""}`}
                      style={{
                        backgroundColor: selectedSize === size ? "#f5ab1d" : "transparent",
                        border: "1px solid #f5ab1d",
                        color: selectedSize === size ? "white" : "#f5ab1d",
                        fontSize: "0.8rem",
                      }}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Selection */}
            {product.colors && product.colors.length > 1 && (
              <div className="color-selection mb-3">
                <small className="d-block mb-2 fw-semibold" style={{ color: "#495057" }}>
                  Color:
                </small>
                <div className="d-flex flex-wrap gap-1">
                  {product.colors.map((color: string) => (
                    <button
                      key={color}
                      className={`btn btn-sm px-3 py-1 rounded-pill ${selectedColor === color ? "text-white" : ""}`}
                      style={{
                        backgroundColor: selectedColor === color ? "#f5ab1d" : "transparent",
                        border: "1px solid #f5ab1d",
                        color: selectedColor === color ? "white" : "#f5ab1d",
                        fontSize: "0.8rem",
                      }}
                      onClick={() => setSelectedColor(color)}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock Info */}
            <div className="stock-info mb-3">
              <small
                className={`fw-semibold ${
                  product.stock > 10 ? "text-success" : product.stock > 0 ? "text-warning" : "text-danger"
                }`}
              >
                {product.stock > 10
                  ? "✓ In Stock"
                  : product.stock > 0
                    ? `⚠ Only ${product.stock} left`
                    : "✗ Out of Stock"}
              </small>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={() => addToCart(product, selectedSize, selectedColor)}
              className="btn w-100 d-flex align-items-center justify-content-center fw-semibold rounded-pill py-2"
              style={{
                backgroundColor: product.stock === 0 ? "#6c757d" : "#f5ab1d",
                border: "none",
                color: "white",
                transition: "all 0.3s ease",
              }}
              disabled={product.stock === 0}
            >
              <Plus size={16} className="me-2" />
              {product.stock === 0 ? "Out of Stock" : "Add to Cart"}
            </button>
          </div>
        </div>
      </Col>
    )
  }

  return (
    <div className="merchandise-page min-vh-100" style={{ backgroundColor: "#f6f8fd" }}>
      {/* Hero Section */}
      <div className="hero-section py-5" style={{ backgroundColor: "white", borderBottom: "3px solid #f5ab1d" }}>
        <Container>
          <Row className="align-items-center">
            <Col lg={8}>
              <h1 className="display-4 fw-bold mb-3" style={{ color: "#2c3e50" }}>
                HOK Merchandise Store
              </h1>
              <p className="lead mb-4" style={{ color: "#6c757d" }}>
                Koleksi merchandise eksklusif Honor of Kings Lampung. Dapatkan gear gaming premium untuk menunjukkan
                support kamu ke komunitas!
              </p>
              <div className="d-flex gap-3 flex-wrap">
                <span
                  className="badge fs-6 px-3 py-2 rounded-pill"
                  style={{ backgroundColor: "#28a745", color: "white" }}
                >
                  ✓ Original Products
                </span>
                <span
                  className="badge fs-6 px-3 py-2 rounded-pill"
                  style={{ backgroundColor: "#f5ab1d", color: "white" }}
                >
                  ✓ Fast Shipping
                </span>
                <span
                  className="badge fs-6 px-3 py-2 rounded-pill"
                  style={{ backgroundColor: "#17a2b8", color: "white" }}
                >
                  ✓ Member Discount
                </span>
              </div>
            </Col>
            <Col lg={4} className="text-center">
              <div className="hero-stats">
                <div className="stat-item mb-4 p-3 rounded-3" style={{ backgroundColor: "#f6f8fd" }}>
                  <h3 style={{ color: "#f5ab1d", marginBottom: "0.5rem" }}>{merchandiseProducts.length}+</h3>
                  <p className="mb-0" style={{ color: "#6c757d" }}>
                    Products Available
                  </p>
                </div>
                <div className="stat-item p-3 rounded-3" style={{ backgroundColor: "#f6f8fd" }}>
                  <h3 style={{ color: "#28a745", marginBottom: "0.5rem" }}>500+</h3>
                  <p className="mb-0" style={{ color: "#6c757d" }}>
                    Happy Customers
                  </p>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Filters & Search Section */}
      <div
        className="filters-section py-4"
        style={{ backgroundColor: "white", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
      >
        <Container>
          <Row className="align-items-center">
            <Col lg={4} md={6} className="mb-3 mb-lg-0">
              <div className="search-box position-relative">
                <Search
                  className="position-absolute"
                  style={{ left: "15px", top: "50%", transform: "translateY(-50%)", color: "#f5ab1d" }}
                  size={20}
                />
                <input
                  type="text"
                  className="form-control ps-5 rounded-pill"
                  placeholder="Search merchandise..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    backgroundColor: "#f6f8fd",
                    border: "2px solid #e9ecef",
                    color: "#495057",
                    padding: "12px 20px 12px 45px",
                  }}
                />
              </div>
            </Col>

            <Col lg={6} md={6} className="mb-3 mb-lg-0">
              <div className="category-filters d-flex gap-2 flex-wrap">
                {merchandiseCategories.map((category: any) => (
                  <button
                    key={category.id}
                    className={`btn btn-sm rounded-pill px-3 py-2 fw-semibold ${
                      selectedCategory === category.id ? "text-white" : ""
                    }`}
                    style={{
                      backgroundColor: selectedCategory === category.id ? "#f5ab1d" : "transparent",
                      border: "2px solid #f5ab1d",
                      color: selectedCategory === category.id ? "white" : "#f5ab1d",
                      transition: "all 0.3s ease",
                    }}
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    {category.name} ({category.count})
                  </button>
                ))}
              </div>
            </Col>

            <Col lg={2} className="text-end">
              <div className="d-flex gap-2 justify-content-end">
                <button
                  className="btn btn-sm d-flex align-items-center rounded-pill px-3 py-2"
                  style={{
                    backgroundColor: showFilters ? "#f5ab1d" : "transparent",
                    border: "2px solid #f5ab1d",
                    color: showFilters ? "white" : "#f5ab1d",
                  }}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter size={16} className="me-1" />
                  Filters
                </button>
                <button
                  className="btn position-relative rounded-pill px-3 py-2"
                  style={{ backgroundColor: "#f5ab1d", border: "none", color: "white" }}
                  onClick={() => setShowCart(!showCart)}
                >
                  <ShoppingCart size={20} />
                  {cartItemsCount > 0 && (
                    <span
                      className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
                      style={{ backgroundColor: "#dc3545" }}
                    >
                      {cartItemsCount}
                    </span>
                  )}
                </button>
              </div>
            </Col>
          </Row>

          {/* Advanced Filters */}
          {showFilters && (
            <Row className="mt-4 pt-4" style={{ borderTop: "2px solid #f6f8fd" }}>
              <Col md={4}>
                <label className="form-label fw-semibold" style={{ color: "#495057" }}>
                  Sort By:
                </label>
                <select
                  className="form-select rounded-pill"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    backgroundColor: "#f6f8fd",
                    border: "2px solid #e9ecef",
                    color: "#495057",
                  }}
                >
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                  <option value="popular">Most Popular</option>
                </select>
              </Col>
              <Col md={4}>
                <label className="form-label fw-semibold" style={{ color: "#495057" }}>
                  Price Range:
                </label>
                <div className="d-flex gap-2">
                  <input
                    type="number"
                    className="form-control rounded-pill"
                    placeholder="Min"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                    style={{
                      backgroundColor: "#f6f8fd",
                      border: "2px solid #e9ecef",
                      color: "#495057",
                    }}
                  />
                  <input
                    type="number"
                    className="form-control rounded-pill"
                    placeholder="Max"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    style={{
                      backgroundColor: "#f6f8fd",
                      border: "2px solid #e9ecef",
                      color: "#495057",
                    }}
                  />
                </div>
              </Col>
            </Row>
          )}
        </Container>
      </div>

      {/* Products Grid */}
      <div className="products-section py-5">
        <Container>
          <Row className="mb-4">
            <Col>
              <h3 style={{ color: "#2c3e50" }}>
                {selectedCategory === "all"
                  ? "All Products"
                  : merchandiseCategories.find((c: any) => c.id === selectedCategory)?.name}
                <span className="ms-2" style={{ color: "#6c757d" }}>
                  ({sortedProducts.length} items)
                </span>
              </h3>
            </Col>
          </Row>

          <Row>
            {sortedProducts.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </Row>

          {sortedProducts.length === 0 && (
            <Row>
              <Col className="text-center py-5">
                <div className="p-5 rounded-3" style={{ backgroundColor: "white" }}>
                  <h4 style={{ color: "#6c757d" }}>No products found</h4>
                  <p style={{ color: "#6c757d" }}>Try adjusting your search or filter criteria</p>
                </div>
              </Col>
            </Row>
          )}
        </Container>
      </div>

      {/* Shopping Cart Sidebar */}
      {showCart && (
        <div
          className="cart-overlay position-fixed w-100 h-100"
          style={{ top: 0, left: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
          onClick={() => setShowCart(false)}
        >
          <div
            className="cart-sidebar position-fixed h-100 overflow-auto"
            style={{ top: 0, right: 0, width: "420px", backgroundColor: "white", zIndex: 1051 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cart-header p-4" style={{ borderBottom: "3px solid #f5ab1d" }}>
              <div className="d-flex justify-content-between align-items-center">
                <h4 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                  Shopping Cart ({cartItemsCount})
                </h4>
                <button
                  className="btn btn-sm rounded-circle"
                  style={{ backgroundColor: "#f6f8fd", border: "2px solid #f5ab1d", color: "#f5ab1d" }}
                  onClick={() => setShowCart(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="cart-items p-4" style={{ backgroundColor: "#f6f8fd" }}>
              {cart.length === 0 ? (
                <div className="text-center py-5">
                  <div className="p-4 rounded-3" style={{ backgroundColor: "white" }}>
                    <ShoppingCart size={48} className="mb-3" style={{ color: "#f5ab1d" }} />
                    <p style={{ color: "#6c757d" }}>Your cart is empty</p>
                  </div>
                </div>
              ) : (
                <div className="cart-items-list">
                  {cart.map((item, index) => (
                    <div
                      key={`${item.id}-${item.selectedSize}-${item.selectedColor}-${index}`}
                      className="cart-item mb-3 p-3 rounded-3 shadow-sm"
                      style={{ backgroundColor: "white" }}
                    >
                      <div className="d-flex gap-3">
                        <Image
                          src={item.image || "/placeholder.svg?height=60&width=60"}
                          alt={item.name}
                          style={{ width: "60px", height: "60px", objectFit: "cover" }}
                          className="rounded-3"
                          width={1000} height={1000}
                        />
                        <div className="flex-grow-1">
                          <h6 className="mb-1 fw-semibold" style={{ color: "#2c3e50" }}>
                            {item.name}
                          </h6>
                          {item.selectedSize && (
                            <small className="d-block" style={{ color: "#6c757d" }}>
                              Size: {item.selectedSize}
                            </small>
                          )}
                          {item.selectedColor && (
                            <small className="d-block" style={{ color: "#6c757d" }}>
                              Color: {item.selectedColor}
                            </small>
                          )}
                          <div className="price-quantity d-flex justify-content-between align-items-center mt-2">
                            <span className="fw-bold" style={{ color: "#f5ab1d" }}>
                              {formatPrice(item.price)}
                            </span>
                            <div className="quantity-controls d-flex align-items-center gap-2">
                              <button
                                className="btn btn-sm rounded-circle"
                                style={{ backgroundColor: "#f6f8fd", border: "1px solid #f5ab1d", color: "#f5ab1d" }}
                                onClick={() =>
                                  updateQuantity(item.id, item.selectedSize, item.selectedColor, item.quantity - 1)
                                }
                              >
                                <Minus size={14} />
                              </button>
                              <span className="fw-semibold" style={{ color: "#2c3e50" }}>
                                {item.quantity}
                              </span>
                              <button
                                className="btn btn-sm rounded-circle"
                                style={{ backgroundColor: "#f6f8fd", border: "1px solid #f5ab1d", color: "#f5ab1d" }}
                                onClick={() =>
                                  updateQuantity(item.id, item.selectedSize, item.selectedColor, item.quantity + 1)
                                }
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                        <button
                          className="btn btn-sm align-self-start rounded-circle"
                          style={{ backgroundColor: "#f6f8fd", border: "1px solid #dc3545", color: "#dc3545" }}
                          onClick={() => removeFromCart(item.id, item.selectedSize, item.selectedColor)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="cart-footer p-4" style={{ borderTop: "3px solid #f5ab1d", backgroundColor: "white" }}>
                <div className="total-section mb-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 fw-bold" style={{ color: "#2c3e50" }}>
                      Total:
                    </h5>
                    <h5 className="mb-0 fw-bold" style={{ color: "#f5ab1d" }}>
                      {formatPrice(cartTotal)}
                    </h5>
                  </div>
                </div>
                <div className="checkout-buttons d-grid gap-2">
                  <button
                    className="btn btn-lg rounded-pill fw-semibold"
                    style={{ backgroundColor: "#f5ab1d", border: "none", color: "white" }}
                  >
                    Proceed to Checkout
                  </button>
                  <button
                    className="btn rounded-pill"
                    style={{ backgroundColor: "transparent", border: "2px solid #f5ab1d", color: "#f5ab1d" }}
                    onClick={() => setShowCart(false)}
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewProduct && (
        <div
          className="modal-overlay position-fixed w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ top: 0, left: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1060 }}
          onClick={() => setQuickViewProduct(null)}
        >
          <div
            className="modal-content rounded-3 p-4 shadow-lg"
            style={{ maxWidth: "700px", width: "90%", backgroundColor: "white" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header d-flex justify-content-between align-items-center mb-4">
              <h4 className="fw-bold" style={{ color: "#2c3e50" }}>
                Quick View
              </h4>
              <button
                className="btn btn-sm rounded-circle"
                style={{ backgroundColor: "#f6f8fd", border: "2px solid #f5ab1d", color: "#f5ab1d" }}
                onClick={() => setQuickViewProduct(null)}
              >
                ✕
              </button>
            </div>
            <Row>
              <Col md={6}>
                <Image
                  src={quickViewProduct.image || "/placeholder.svg?height=400&width=400"}
                  alt={quickViewProduct.name}
                  className="w-100 rounded-3"
                  width={1000} height={1000}
                />
              </Col>
              <Col md={6}>
                <h5 className="fw-bold mb-3" style={{ color: "#2c3e50" }}>
                  {quickViewProduct.name}
                </h5>
                <p style={{ color: "#6c757d", lineHeight: "1.6" }}>{quickViewProduct.description}</p>
                <div className="price mb-3">
                  <span className="h4 fw-bold" style={{ color: "#f5ab1d" }}>
                    {formatPrice(quickViewProduct.price)}
                  </span>
                  {quickViewProduct.originalPrice > quickViewProduct.price && (
                    <span className="text-muted text-decoration-line-through ms-2">
                      {formatPrice(quickViewProduct.originalPrice)}
                    </span>
                  )}
                </div>
                <div className="rating mb-4">
                  <div className="d-flex align-items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className={i < Math.floor(quickViewProduct.rating) ? "text-warning" : "text-muted"}
                        fill={i < Math.floor(quickViewProduct.rating) ? "currentColor" : "none"}
                      />
                    ))}
                    <span className="ms-2" style={{ color: "#6c757d" }}>
                      ({quickViewProduct.reviewCount} reviews)
                    </span>
                  </div>
                </div>
                <button
                  className="btn w-100 fw-semibold rounded-pill py-3"
                  style={{ backgroundColor: "#f5ab1d", border: "none", color: "white" }}
                  onClick={() => {
                    addToCart(quickViewProduct)
                    setQuickViewProduct(null)
                  }}
                >
                  <Plus size={16} className="me-2" />
                  Add to Cart
                </button>
              </Col>
            </Row>
          </div>
        </div>
      )}
    </div>
  )
}

export default MerchanPage
