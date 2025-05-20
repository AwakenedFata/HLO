import { writeFile, mkdir } from "fs/promises"
import path from "path"
import fs from "fs"
import { v4 as uuidv4 } from "uuid"

// Ensure uploads directory exists
const ensureUploadDir = async (subdir = "") => {
  const uploadDir = path.join(process.cwd(), "public", "uploads", subdir)
  if (!fs.existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true })
  }
  return uploadDir
}

// File type validation
const validateFileType = (file, allowedTypes) => {
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Format file tidak didukung. Gunakan ${allowedTypes.join(", ")}.`)
  }
  return true
}

// Process uploaded file from FormData
export const processUploadedFile = async (file, options = {}) => {
  const {
    subdir = "",
    prefix = "file",
    username = "user",
    maxSize = 5 * 1024 * 1024, // 5MB
    allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  } = options

  if (!file) {
    throw new Error("No file provided")
  }

  // Validate file size
  if (file.size > maxSize) {
    throw new Error(`File terlalu besar. Maksimal ${maxSize / (1024 * 1024)}MB.`)
  }

  // Validate file type
  validateFileType(file, allowedTypes)

  // Ensure upload directory exists
  const uploadDir = await ensureUploadDir(subdir)

  // Create unique filename
  const uniqueSuffix = Date.now() + "-" + uuidv4().substring(0, 8)
  const fileExt = path.extname(file.name || "")
  const filename = `${prefix}-${username}-${uniqueSuffix}${fileExt}`
  const filepath = path.join(uploadDir, filename)

  // Write file to disk
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  await writeFile(filepath, buffer)

  // Return file info
  const relativePath = `/uploads/${subdir ? subdir + "/" : ""}${filename}`
  return {
    filename,
    filepath,
    relativePath,
    mimetype: file.type,
    size: file.size,
  }
}

// Process profile image upload
export const processProfileImage = async (file, username) => {
  return processUploadedFile(file, {
    subdir: "profiles",
    prefix: "profile",
    username,
    allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    maxSize: 5 * 1024 * 1024, // 5MB
  })
}
