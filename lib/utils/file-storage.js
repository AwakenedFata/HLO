import fs from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import logger from "@/lib/utils/logger"

// Ensure uploads directory exists
const ensureUploadsDir = () => {
  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }

  // Create subdirectories
  const profilesDir = path.join(uploadsDir, "profiles")
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true })
  }

  return uploadsDir
}

// Initialize uploads directory
ensureUploadsDir()

// Save file from FormData
export const saveFile = async (file, subdir = "") => {
  try {
    const uploadsDir = path.join(process.cwd(), "public", "uploads", subdir)

    // Ensure subdirectory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const filename = `${Date.now()}-${uuidv4().substring(0, 8)}${path.extname(file.name)}`
    const filepath = path.join(uploadsDir, filename)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await fs.promises.writeFile(filepath, buffer)

    // Return file info
    return {
      filename,
      filepath,
      url: `/uploads/${subdir ? subdir + "/" : ""}${filename}`,
      mimetype: file.type,
      size: file.size,
    }
  } catch (error) {
    logger.error("Error saving file:", error)
    throw new Error("Failed to save file")
  }
}

// Delete file
export const deleteFile = async (filepath) => {
  try {
    const fullPath = path.join(process.cwd(), "public", filepath)

    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath)
      return true
    }

    return false
  } catch (error) {
    logger.error("Error deleting file:", error)
    throw new Error("Failed to delete file")
  }
}
