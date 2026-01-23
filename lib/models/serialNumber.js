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
      productionDate: { type: String, default: "" },
    },
    isActive: { type: Boolean, default: true },
    issuedDate: { type: Date, default: Date.now },
    verificationCount: { type: Number, default: 0 },
    firstVerifiedAt: { type: Date, default: null },
    lastVerifiedAt: { type: Date, default: null },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    verificationLocation: {
      province: { type: String, default: "" },
      country: { type: String, default: "" },
      fullLocation: { type: String, default: "" },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

serialNumberSchema.index({ isActive: 1 })
serialNumberSchema.index({ createdAt: -1 })
serialNumberSchema.index({ "product.name": 1 })
serialNumberSchema.index({ isVerified: 1 })
serialNumberSchema.index({ issuedDate: -1 })

const SerialNumber = mongoose.models.SerialNumber || mongoose.model("SerialNumber", serialNumberSchema)

export default SerialNumber
