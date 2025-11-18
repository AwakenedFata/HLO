import mongoose from "mongoose"

const frameSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: [true, "URL gambar frame harus diisi"],
      trim: true,
    },
    imageKey: {
      type: String,
      required: [true, "Key gambar S3 harus diisi"],
      trim: true,
    },
    relatedGallery: {
      type: mongoose.Schema.ObjectId,
      ref: "Gallery",
      required: [true, "Gallery terkait harus dipilih"],
    },
    originalName: {
      type: String,
      trim: true,
      maxlength: [200, "Nama file maksimal 200 karakter"],
    },
    fileSize: {
      type: Number,
      min: [0, "Ukuran file tidak valid"],
    },
    mimeType: {
      type: String,
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

// Virtual untuk format tanggal
frameSchema.virtual("formattedCreatedAt").get(function () {
  if (this.createdAt && this.createdAt instanceof Date && !isNaN(this.createdAt)) {
    return this.createdAt.toLocaleString("id-ID")
  }
  return "Tanggal tidak tersedia"
})

// Virtual untuk format ukuran file
frameSchema.virtual("formattedFileSize").get(function () {
  if (!this.fileSize) return "Unknown"

  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(this.fileSize) / Math.log(1024))
  return Math.round((this.fileSize / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
})

frameSchema.index({ isActive: 1, createdAt: -1 })
frameSchema.index({ relatedGallery: 1, isActive: 1 })
frameSchema.index({ createdBy: 1 })

// Middleware untuk update updatedAt
frameSchema.pre("findOneAndUpdate", function () {
  this.set({ updatedAt: new Date() })
})

let Frame
if (mongoose.models.Frame) {
  Frame = mongoose.models.Frame
} else {
  Frame = mongoose.model("Frame", frameSchema)
}

export default Frame