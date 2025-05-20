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
    minlength: [8, "Password minimal 8 karakter"],
    select: false, // Password tidak akan muncul di query
  },
  role: {
    type: String,
    enum: ["admin", "super-admin"],
    default: "admin",
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
  profileImage: {
    type: String,
    default: null,
  },
})

// Middleware untuk mengenkripsi password sebelum disimpan
adminSchema.pre("save", async function (next) {
  // Hanya jalankan fungsi ini jika password dimodifikasi
  if (!this.isModified("password")) return next()

  try {
    // Hash password dengan cost factor 12
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)

    // Jika password diubah dan bukan admin baru, update passwordChangedAt
    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000 // Kurangi 1 detik untuk mengatasi delay
    }
    next()
  } catch (error) {
    next(error)
  }
})

// Filter admin yang tidak aktif
adminSchema.pre(/^find/, function (next) {
  // this menunjuk ke query saat ini
  this.find({ active: { $ne: false } })
  next()
})

// Method untuk verifikasi password (kompatibel dengan kode yang sudah ada)
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

// Method untuk memeriksa apakah password diubah setelah token diterbitkan
adminSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = Number.parseInt(this.passwordChangedAt.getTime() / 1000, 10)
    return JWTTimestamp < changedTimestamp
  }
  // False berarti password tidak diubah
  return false
}

// Method untuk membuat token reset password
adminSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex")

  this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex")

  // Token berlaku selama 10 menit
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000

  return resetToken
}

// Prevent model recompilation during development
const Admin = mongoose.models.Admin || mongoose.model("Admin", adminSchema)

export default Admin
