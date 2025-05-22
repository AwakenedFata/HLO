// Pastikan model Admin memiliki metode createPasswordResetToken
// File: lib/models/admin.js

import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Username harus diisi"],
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Email harus diisi"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Format email tidak valid"],
  },
  password: {
    type: String,
    required: [true, "Password harus diisi"],
    minlength: 8,
    select: false,
  },
  role: {
    type: String,
    enum: ["admin", "superadmin"],
    default: "admin",
  },
  profileImage: {
    type: String,
    default: "/assets/default-profile.png",
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Hash password sebelum disimpan
adminSchema.pre("save", async function (next) {
  // Hanya hash password jika password dimodifikasi
  if (!this.isModified("password")) return next()

  // Hash password dengan cost factor 12
  this.password = await bcrypt.hash(this.password, 12)

  next()
})

// Update passwordChangedAt saat password diubah
adminSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next()

  this.passwordChangedAt = Date.now() - 1000 // Set slightly in the past to ensure token is created after password change
  next()
})

// Hanya tampilkan admin yang aktif
adminSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } })
  next()
})

// Method untuk membandingkan password
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

// Method untuk cek apakah password diubah setelah token diterbitkan
adminSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = Number.parseInt(this.passwordChangedAt.getTime() / 1000, 10)
    return JWTTimestamp < changedTimestamp
  }
  return false
}

// Method untuk membuat token reset password
adminSchema.methods.createPasswordResetToken = function () {
  // Generate random token
  const resetToken = crypto.randomBytes(32).toString("hex")

  // Hash token dan simpan di database
  this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex")

  // Set expiry time (10 minutes)
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000

  // Return unhashed token (will be sent to user's email)
  return resetToken
}

// Prevent model recompilation during development
const Admin = mongoose.models.Admin || mongoose.model("Admin", adminSchema)

export default Admin
