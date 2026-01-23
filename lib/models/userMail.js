import mongoose from "mongoose"

const userMailSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Nama harus diisi"],
      trim: true,
      maxlength: [100, "Nama maksimal 100 karakter"],
    },
    email: {
      type: String,
      required: [true, "Email harus diisi"],
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Format email tidak valid"],
    },
    subject: {
      type: String,
      required: [true, "Subjek harus diisi"],
      trim: true,
      maxlength: [200, "Subjek maksimal 200 karakter"],
    },
    message: {
      type: String,
      required: [true, "Pesan harus diisi"],
      trim: true,
      minlength: [10, "Pesan minimal 10 karakter"],
      maxlength: [5000, "Pesan maksimal 5000 karakter"],
    },
    read: {
      type: Boolean,
      default: false,
    },
    archived: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

userMailSchema.index({ email: 1 })
userMailSchema.index({ read: 1 })
userMailSchema.index({ archived: 1 })
userMailSchema.index({ createdAt: -1 })

const UserMail = mongoose.models.UserMail || mongoose.model("UserMail", userMailSchema)

export default UserMail
