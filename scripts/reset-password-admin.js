#!/usr/bin/env node

// Script to reset admin password
require("dotenv").config()
const mongoose = require("mongoose")
const readline = require("readline")
const path = require("path")

// Import Admin model - we need to use require here since this is a Node.js script
const Admin = require(path.join(process.cwd(), "models", "admin"))

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected")
    listAdmins()
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err)
    process.exit(1)
  })

async function listAdmins() {
  try {
    // Get all admins
    const admins = await Admin.find().select("username email role")

    if (admins.length === 0) {
      console.log("❌ No admins found in the database.")
      rl.close()
      process.exit(1)
    }

    console.log("\n=== Admin List ===")
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. Username: ${admin.username}, Email: ${admin.email}, Role: ${admin.role}`)
    })

    // Ask for admin number
    rl.question("\nEnter the number of the admin whose password you want to reset: ", (adminNumber) => {
      const index = Number.parseInt(adminNumber) - 1
      if (isNaN(index) || index < 0 || index >= admins.length) {
        console.log("❌ Invalid admin number")
        rl.close()
        process.exit(1)
      }

      const selectedAdmin = admins[index]
      resetPassword(selectedAdmin._id)
    })
  } catch (error) {
    console.error("❌ Error:", error)
    rl.close()
    mongoose.disconnect()
  }
}

async function resetPassword(adminId) {
  try {
    // Ask for new password
    rl.question("Enter new password (min. 8 characters): ", (password) => {
      if (!password || password.length < 8) {
        console.log("❌ Password must be at least 8 characters")
        rl.close()
        process.exit(1)
      }

      // Ask for password confirmation
      rl.question("Confirm new password: ", async (confirmPassword) => {
        if (password !== confirmPassword) {
          console.log("❌ Passwords do not match")
          rl.close()
          process.exit(1)
        }

        try {
          // Update admin password
          const admin = await Admin.findById(adminId)
          admin.password = password
          await admin.save()

          console.log("✅ Password reset successfully!")
          console.log(`Username: ${admin.username}`)

          rl.close()
          mongoose.disconnect()
        } catch (error) {
          console.error("❌ Failed to reset password:", error)
          rl.close()
          mongoose.disconnect()
        }
      })
    })
  } catch (error) {
    console.error("❌ Error:", error)
    rl.close()
    mongoose.disconnect()
  }
}

rl.on("close", () => {
  process.exit(0)
})
