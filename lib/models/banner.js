import mongoose from "mongoose"

const bannerSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: [true, "URL gambar banner harus diisi"],
      trim: true,
    },
    imageKey: {
      type: String,
      required: [true, "Key gambar S3 harus diisi"],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Virtual untuk format waktu dibuat
bannerSchema.virtual("formattedCreatedAt").get(function () {
  return this.createdAt.toLocaleString("id-ID")
})

// Virtual untuk format waktu diupdate
bannerSchema.virtual("formattedUpdatedAt").get(function () {
  return this.updatedAt.toLocaleString("id-ID")
})

bannerSchema.index({ isActive: 1, createdAt: -1 })
bannerSchema.index({ createdBy: 1 })

// Middleware untuk update updatedAt
bannerSchema.pre("findOneAndUpdate", function () {
  this.set({ updatedAt: new Date() })
})

let Banner
if (mongoose.models.Banner) {
  Banner = mongoose.models.Banner
} else {
  Banner = mongoose.model("Banner", bannerSchema)
}

export default Banner