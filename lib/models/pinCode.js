import mongoose from "mongoose"

// Define the schema
const pinCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Kode pin harus diisi"],
      unique: true, // Ini sudah membuat indeks secara otomatis
      trim: true,
      uppercase: true, // Ensure consistent case for better searching
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
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    redeemedBy: {
      idGame: String,
      nama: String,
      redeemedAt: Date,
      deviceInfo: String,
      ipAddress: String,
    },
    // Add these fields to track processing information
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    // Optional batch fields for grouping pins
    batch: Number,
    batchName: String,
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    // Add this to improve performance by skipping unnecessary middleware
    timestamps: false,
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

// Optimize indexes - remove redundant single indexes since we have compound indexes
// The compound index {used: 1, processed: 1} can serve the same purpose as individual indexes
pinCodeSchema.index({ used: 1, processed: 1 }) // Compound index for pending pins query
pinCodeSchema.index({ "redeemedBy.redeemedAt": -1 }) // Index for sorting by redemption time
pinCodeSchema.index({ createdAt: -1 }) // Index for sorting by creation time (descending for newest first)

// Add text index for better search performance
pinCodeSchema.index(
  {
    code: "text",
    "redeemedBy.nama": "text",
    "redeemedBy.idGame": "text",
  },
  {
    weights: {
      code: 10, // Higher weight for code searches
      "redeemedBy.nama": 5,
      "redeemedBy.idGame": 5,
    },
    name: "pin_text_search",
  },
)

// Create or get the model
const PinCode = mongoose.models.PinCode || mongoose.model("PinCode", pinCodeSchema)

export default PinCode
