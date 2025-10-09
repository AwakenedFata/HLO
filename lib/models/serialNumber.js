import mongoose from "mongoose"

const serialNumberSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Serial number harus diisi"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    product: {
      name: { type: String, default: "" },
      batch: { type: String, default: "" },
      productionDate: { type: String, default: "" },
      warrantyUntil: { type: String, default: "" },
    },
    isActive: { type: Boolean, default: true },

    // verifikasi publik (tracking)
    verificationCount: { type: Number, default: 0 },
    firstVerifiedAt: { type: Date, default: null },
    lastVerifiedAt: { type: Date, default: null },
    lastVerifiedIP: { type: String, default: null },

    // NEW: One-time verification tracking
    isVerified: { type: Boolean, default: false },
    verifiedByIP: { type: String, default: null },
    verifiedByDevice: { type: String, default: null }, // fingerprint/user-agent hash
    verifiedAt: { type: Date, default: null },

    // audit
    createdAt: { type: Date, default: Date.now },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Admin",
    },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

serialNumberSchema.index({ code: 1 }, { unique: true })
serialNumberSchema.index({ isActive: 1 })
serialNumberSchema.index({ createdAt: -1 })
serialNumberSchema.index({ "product.name": 1 })
serialNumberSchema.index({ "product.batch": 1 })
serialNumberSchema.index({ isVerified: 1 })
serialNumberSchema.index({ verifiedByIP: 1 })

const SerialNumber = mongoose.models.SerialNumber || mongoose.model("SerialNumber", serialNumberSchema)
export default SerialNumber
