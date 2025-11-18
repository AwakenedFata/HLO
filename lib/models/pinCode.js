import mongoose from "mongoose"

const pinCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Kode pin harus diisi"],
      unique: true,
      trim: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    processed: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Admin",
    },
    redeemedBy: {
      idGame: String,
      nama: String,
      redeemedAt: Date,
      deviceInfo: String,
      ipAddress: String,
    },
    // Tambahkan field untuk tracking proses
    processedAt: {
      type: Date,
      default: null,
    },
    processedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual untuk menentukan apakah pin masih valid
pinCodeSchema.virtual("isValid").get(function () {
  return !this.used
})

// Virtual untuk menentukan apakah pin pending
pinCodeSchema.virtual("isPending").get(function () {
  return this.used && !this.processed
})

pinCodeSchema.index({ used: 1 })
pinCodeSchema.index({ processed: 1 })
pinCodeSchema.index({ used: 1, processed: 1 }) // Compound index for pending pins query
pinCodeSchema.index({ "redeemedBy.redeemedAt": -1 }) // Index for sorting by redemption time
pinCodeSchema.index({ processedAt: -1 }) // Index for sorting by process time
pinCodeSchema.index({ processedBy: 1 }) // Index for querying by processor
pinCodeSchema.index({ createdAt: 1 }) // Single createdAt index

// Prevent model recompilation during development
const PinCode = mongoose.models.PinCode || mongoose.model("PinCode", pinCodeSchema)

export default PinCode