// Types untuk Merchandise E-commerce
export interface Product {
  id: number
  name: string
  description: string
  price: number
  originalPrice: number
  image: string
  category: "clothing" | "accessories" | "collectibles" | "digital"
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

export interface Category {
  id: string
  name: string
  count: number
}

export interface CartItem extends Product {
  quantity: number
  selectedSize?: string | null
  selectedColor?: string | null
}

export interface CartState {
  items: CartItem[]
  total: number
  itemCount: number
}

export interface FilterState {
  category: string
  searchTerm: string
  sortBy: "newest" | "price-low" | "price-high" | "rating" | "popular"
  priceRange: [number, number]
}

export interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product, size?: string | null, color?: string | null) => void
  onToggleWishlist: (productId: number) => void
  onQuickView: (product: Product) => void
  isInWishlist: boolean
  isMobile: boolean
}

export interface ShoppingCartProps {
  isOpen: boolean
  onClose: () => void
  cart: CartItem[]
  onUpdateQuantity: (productId: number, size: string | null, color: string | null, quantity: number) => void
  onRemoveItem: (productId: number, size: string | null, color: string | null) => void
  total: number
  itemCount: number
}

export interface QuickViewModalProps {
  product: Product | null
  onClose: () => void
  onAddToCart: (product: Product) => void
}

// Utility types
export type SortOption = FilterState["sortBy"]
export type ProductCategory = Product["category"]
