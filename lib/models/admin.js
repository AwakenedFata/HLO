import mongoose from "mongoose"

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email harus diisi"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, "Format email tidak valid"],
  },
  name: {
    type: String,
    required: [true, "Name harus diisi"],
    trim: true,
  },
  googleId: {
    type: String,
    required: [true, "Google ID harus diisi"],
    unique: true,
  },
  image: {
    type: String,
    default: "/assets/default-profile.png",
  },
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
  lastLogin: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Hanya tampilkan admin yang aktif
adminSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } })
  next()
})

// Prevent model recompilation during development
const Admin = mongoose.models.Admin || mongoose.model("Admin", adminSchema)

export default Admin