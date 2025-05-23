// File: lib/models/tokenBlacklist.js
// Model untuk menyimpan token yang telah diinvalidasi

import mongoose from "mongoose"

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: [true, "Token harus ada"],
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: "7d", // Token akan otomatis dihapus setelah 7 hari
  },
})

// Indeks untuk mempercepat pencarian
tokenBlacklistSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 }) // TTL index

// Prevent model recompilation during development
const TokenBlacklist = mongoose.models.TokenBlacklist || mongoose.model("TokenBlacklist", tokenBlacklistSchema)

export default TokenBlacklist
