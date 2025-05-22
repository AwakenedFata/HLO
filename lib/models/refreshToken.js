// Buat model RefreshToken jika belum ada
// File: lib/models/refreshToken.js

import mongoose from "mongoose"

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "userType",
  },
  userType: {
    type: String,
    required: true,
    enum: ["admin", "user"],
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  used: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 30, // 30 days
  },
})

// Indeks untuk mempercepat pencarian
refreshTokenSchema.index({ token: 1 })
refreshTokenSchema.index({ user: 1, userType: 1 })
refreshTokenSchema.index({ expiresAt: 1 })

// Buat model hanya jika belum ada
const RefreshToken = mongoose.models.RefreshToken || mongoose.model("RefreshToken", refreshTokenSchema)

export default RefreshToken
