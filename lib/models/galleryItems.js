import mongoose from "mongoose"

const gallerySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Judul harus diisi"],
      trim: true,
      maxlength: [200, "Judul maksimal 200 karakter"],
    },
    label: {
      type: String,
      required: [true, "Label harus diisi"],
      trim: true,
      maxlength: [100, "Label maksimal 100 karakter"],
    },
    imageUrl: {
      type: String,
      required: [true, "URL gambar harus diisi"],
      trim: true,
    },
    imageKey: {
      type: String,
      required: [true, "Key gambar S3 harus diisi"],
      trim: true,
    },
    location: {
      type: String,
      required: [true, "Lokasi harus diisi"],
      trim: true,
      maxlength: [150, "Lokasi maksimal 150 karakter"],
    },
    mapLink: {
      type: String,
      trim: true,
      maxlength: [500, "Link Lokasi maksimal 500 karakter"],
    },
    uploadDate: {
      type: Date,
      required: [true, "Tanggal upload harus diisi"],
      default: Date.now,
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
gallerySchema.virtual("formattedUploadDate").get(function () {
  if (this.uploadDate && this.uploadDate instanceof Date && !isNaN(this.uploadDate)) {
    return this.uploadDate.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }
  return "Tanggal tidak tersedia"
})

// Virtual untuk format waktu dibuat
gallerySchema.virtual("formattedCreatedAt").get(function () {
  if (this.createdAt && this.createdAt instanceof Date && !isNaN(this.createdAt)) {
    return this.createdAt.toLocaleString("id-ID")
  }
  return "Tanggal tidak tersedia"
})

gallerySchema.index({ isActive: 1, uploadDate: -1 })
gallerySchema.index({ isActive: 1, createdAt: -1 }) // Compound index includes createdAt
gallerySchema.index({ title: "text", label: "text", location: "text" })
gallerySchema.index({ createdBy: 1 })

// Middleware untuk update updatedAt
gallerySchema.pre("findOneAndUpdate", function () {
  this.set({ updatedAt: new Date() })
})

let Gallery
if (mongoose.models.Gallery) {
  Gallery = mongoose.models.Gallery
} else {
  Gallery = mongoose.model("Gallery", gallerySchema)
}

export default Gallery