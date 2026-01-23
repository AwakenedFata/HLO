import mongoose from "mongoose"

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Judul artikel harus diisi"],
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Isi artikel harus diisi"],
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    coverImage: {
      type: String,
      trim: true,
    },
    coverImageKey: {
      type: String,
      trim: true,
    },
    contentImages: [
      {
        url: String,
        key: String,
        originalName: String,
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    publishedAt: {
      type: Date,
    },
    relatedGallery: {
      type: mongoose.Schema.ObjectId,
      ref: "Gallery",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Admin",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }, // This automatically creates createdAt and updatedAt with indexes
)

articleSchema.pre("validate", async function (next) {
  if (!this.slug && this.title) {
    const baseSlug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")

    let slug = baseSlug
    let counter = 1

    // Check for existing slugs and append number if needed
    while (await mongoose.models.Article?.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    this.slug = slug
  }
  next()
})

const Article = mongoose.models.Article || mongoose.model("Article", articleSchema)
export default Article