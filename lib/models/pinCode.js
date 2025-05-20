import mongoose from "mongoose"

const pinCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Kode pin harus diisi"],
      unique: true, // Ini sudah membuat indeks secara otomatis
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
    // Hapus field expiresAt
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
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual untuk menentukan apakah pin masih valid - hanya cek apakah sudah digunakan
pinCodeSchema.virtual("isValid").get(function () {
  return !this.used
})

// Virtual untuk menentukan apakah pin pending (digunakan tapi belum diproses)
pinCodeSchema.virtual("isPending").get(function () {
  return this.used && !this.processed
})

// Indeks untuk meningkatkan performa query
// Hapus indeks ganda untuk code karena sudah didefinisikan dengan unique: true
pinCodeSchema.index({ used: 1 })
pinCodeSchema.index({ processed: 1 })
pinCodeSchema.index({ createdAt: 1 })
// Hapus indeks untuk expiresAt

// Add additional indexes to improve query performance
pinCodeSchema.index({ used: 1, processed: 1 }) // Compound index for pending pins query
pinCodeSchema.index({ "redeemedBy.redeemedAt": -1 }) // Index for sorting by redemption time

// Prevent model recompilation during development
const PinCode = mongoose.models.PinCode || mongoose.model("PinCode", pinCodeSchema)

export default PinCode
