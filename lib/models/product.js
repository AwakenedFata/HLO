import mongoose from "mongoose"

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      enum: ["clothing", "accessories", "collectibles", "digital"],
    },
    images: [
      {
        type: String,
        required: true,
      },
    ],
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    tags: [String],
    specifications: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  },
)

// Index untuk pencarian
productSchema.index({ name: "text", description: "text", tags: "text" })
productSchema.index({ category: 1, isActive: 1 })
productSchema.index({ price: 1 })

export default mongoose.models.Product || mongoose.model("Product", productSchema)
