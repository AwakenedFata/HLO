import mongoose from "mongoose"

// Sub-schema untuk gambar produk
const productImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, "URL gambar harus diisi"],
      trim: true,
    },
    key: {
      type: String,
      required: [true, "Key gambar S3 harus diisi"],
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    alt: {
      type: String,
      trim: true,
      maxlength: [200, "Alt text maksimal 200 karakter"],
    },
  },
  { _id: false },
)

// Sub-schema untuk warna produk
const colorVariantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Nama warna harus diisi"],
      trim: true,
      maxlength: [50, "Nama warna maksimal 50 karakter"],
    },
    hexCode: {
      type: String,
      required: [true, "Kode hex warna harus diisi"],
      trim: true,
      match: [/^#[0-9A-Fa-f]{6}$/, "Format hex code tidak valid"],
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true },
)

// Sub-schema untuk ukuran produk
const sizeVariantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Nama ukuran harus diisi"],
      trim: true,
      maxlength: [10, "Nama ukuran maksimal 10 karakter"],
    },
    dimensions: {
      length: {
        type: Number,
        min: [0, "Panjang tidak boleh negatif"],
      },
      width: {
        type: Number,
        min: [0, "Lebar tidak boleh negatif"],
      },
      unit: {
        type: String,
        enum: ["cm", "inch"],
        default: "cm",
      },
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true },
)

// Sub-schema untuk stock per variant (kombinasi warna + ukuran)
const stockVariantSchema = new mongoose.Schema(
  {
    colorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Color ID harus diisi"],
    },
    sizeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Size ID harus diisi"],
    },
    stock: {
      type: Number,
      required: [true, "Stock harus diisi"],
      min: [0, "Stock tidak boleh negatif"],
      default: 0,
    },
    sku: {
      type: String,
      trim: true,
      maxlength: [50, "SKU maksimal 50 karakter"],
    },
  },
  { _id: true },
)

// Sub-schema untuk detail produk
const productDetailSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: [true, "Label detail harus diisi"],
      trim: true,
      maxlength: [100, "Label maksimal 100 karakter"],
    },
    value: {
      type: String,
      required: [true, "Value detail harus diisi"],
      trim: true,
      maxlength: [500, "Value maksimal 500 karakter"],
    },
  },
  { _id: false },
)

// Sub-schema untuk marketplace links
const marketplaceLinkSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      required: [true, "Platform marketplace harus diisi"],
      trim: true,
      maxlength: [50, "Nama platform maksimal 50 karakter"],
    },
    url: {
      type: String,
      required: [true, "URL marketplace harus diisi"],
      trim: true,
      maxlength: [500, "URL maksimal 500 karakter"],
    },
    iconUrl: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true },
)

// Main Product Schema
const productSchema = new mongoose.Schema(
  {
    // Informasi Dasar
    title: {
      type: String,
      required: [true, "Nama produk harus diisi"],
      trim: true,
      maxlength: [200, "Nama produk maksimal 200 karakter"],
    },
    storeName: {
      type: String,
      required: [true, "Nama toko harus diisi"],
      trim: true,
      maxlength: [100, "Nama toko maksimal 100 karakter"],
    },
    slug: {
      type: String,
      required: [true, "Slug harus diisi"],
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: [250, "Slug maksimal 250 karakter"],
    },
    sku: {
      type: String,
      required: [true, "SKU harus diisi"],
      trim: true,
      unique: true,
      maxlength: [50, "SKU maksimal 50 karakter"],
    },
    category: {
      type: String,
      required: [true, "Kategori harus diisi"],
      trim: true,
      maxlength: [100, "Kategori maksimal 100 karakter"],
    },
    badge: {
      type: String,
      enum: ["NEW", "BEST", "LIMITED", "SALE", ""],
      default: "",
      trim: true,
    },

    // Harga
    price: {
      type: Number,
      required: [true, "Harga harus diisi"],
      min: [0, "Harga tidak boleh negatif"],
    },
    currency: {
      type: String,
      default: "IDR",
      trim: true,
    },
    discountPrice: {
      type: Number,
      min: [0, "Harga diskon tidak boleh negatif"],
    },

    // Gambar Produk
    mainImage: {
      type: productImageSchema,
      required: [true, "Gambar utama harus diisi"],
    },
    thumbnails: {
      type: [productImageSchema],
      validate: {
        validator: (v) => v.length <= 10,
        message: "Maksimal 10 thumbnail images",
      },
    },

    // Konten
    description: {
      type: String,
      required: [true, "Deskripsi harus diisi"],
      trim: true,
      minlength: [10, "Deskripsi minimal 10 karakter"],
      maxlength: [5000, "Deskripsi maksimal 5000 karakter"],
    },
    details: {
      type: [productDetailSchema],
      validate: {
        validator: (v) => v.length <= 20,
        message: "Maksimal 20 detail items",
      },
    },
    limitedMessage: {
      type: String,
      trim: true,
      maxlength: [200, "Limited message maksimal 200 karakter"],
    },

    // Varian Produk
    colors: {
      type: [colorVariantSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: "Minimal 1 warna harus tersedia",
      },
    },
    sizes: {
      type: [sizeVariantSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: "Minimal 1 ukuran harus tersedia",
      },
    },
    stockVariants: {
      type: [stockVariantSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: "Minimal 1 stock variant harus tersedia",
      },
    },

    // Stock Management
    totalStock: {
      type: Number,
      required: [true, "Total stock harus diisi"],
      min: [0, "Total stock tidak boleh negatif"],
      default: 0,
    },
    minOrder: {
      type: Number,
      default: 1,
      min: [1, "Minimal order tidak boleh kurang dari 1"],
    },
    maxOrder: {
      type: Number,
      default: 10,
      min: [1, "Maksimal order tidak boleh kurang dari 1"],
    },

    // View Options
    has2DView: {
      type: Boolean,
      default: true,
    },
    has3DView: {
      type: Boolean,
      default: false,
    },

    // Marketplace Integration
    marketplaceLinks: {
      type: [marketplaceLinkSchema],
      validate: {
        validator: (v) => v.length <= 20,
        message: "Maksimal 20 marketplace links",
      },
    },

    // Status & Metadata
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: [0, "View count tidak boleh negatif"],
    },
    salesCount: {
      type: Number,
      default: 0,
      min: [0, "Sales count tidak boleh negatif"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Admin",
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Admin",
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: false,
  },
)

// Virtual untuk format harga
productSchema.virtual("formattedPrice").get(function () {
  if (this.currency === "IDR") {
    return `Rp. ${this.price.toLocaleString("id-ID")}`
  }
  return `${this.currency} ${this.price.toLocaleString()}`
})

// Virtual untuk format harga diskon
productSchema.virtual("formattedDiscountPrice").get(function () {
  if (this.discountPrice && this.currency === "IDR") {
    return `Rp. ${this.discountPrice.toLocaleString("id-ID")}`
  } else if (this.discountPrice) {
    return `${this.currency} ${this.discountPrice.toLocaleString()}`
  }
  return null
})

// Virtual untuk cek apakah produk sedang diskon
productSchema.virtual("isOnSale").get(function () {
  return this.discountPrice && this.discountPrice < this.price
})

// Virtual untuk persentase diskon
productSchema.virtual("discountPercentage").get(function () {
  if (this.isOnSale) {
    return Math.round(((this.price - this.discountPrice) / this.price) * 100)
  }
  return 0
})

// Virtual untuk cek stock availability
productSchema.virtual("isInStock").get(function () {
  return this.totalStock > 0
})

// Virtual untuk format tanggal dibuat
productSchema.virtual("formattedCreatedAt").get(function () {
  if (this.createdAt && this.createdAt instanceof Date && !isNaN(this.createdAt)) {
    return this.createdAt.toLocaleString("id-ID")
  }
  return "Tanggal tidak tersedia"
})

// Indexes untuk performa query
productSchema.index({ isActive: 1, createdAt: -1 })
productSchema.index({ isActive: 1, isFeatured: 1 })
productSchema.index({ category: 1, isActive: 1 })
productSchema.index({ slug: 1 })
productSchema.index({ sku: 1 })
productSchema.index({ title: "text", description: "text", category: "text" })
productSchema.index({ createdBy: 1 })
productSchema.index({ price: 1 })
productSchema.index({ salesCount: -1 })

// Middleware untuk update updatedAt
productSchema.pre("findOneAndUpdate", function () {
  this.set({ updatedAt: new Date() })
})

// Middleware untuk generate slug dari title jika belum ada
productSchema.pre("save", function (next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }
  next()
})

// Middleware untuk update totalStock berdasarkan stockVariants
productSchema.pre("save", function (next) {
  if (this.stockVariants && this.stockVariants.length > 0) {
    this.totalStock = this.stockVariants.reduce((total, variant) => {
      return total + (variant.stock || 0)
    }, 0)
  }
  next()
})

let Product
if (mongoose.models.Product) {
  Product = mongoose.models.Product
} else {
  Product = mongoose.model("Product", productSchema)
}

export default Product
