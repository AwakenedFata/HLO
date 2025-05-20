#!/usr/bin/env node

// Script to change admin role
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
    rl.question("\nEnter the number of the admin whose role you want to change: ", (adminNumber) => {
      const index = Number.parseInt(adminNumber) - 1
      if (isNaN(index) || index < 0 || index >= admins.length) {
        console.log("❌ Invalid admin number")
        rl.close()
        process.exit(1)
      }

      const selectedAdmin = admins[index]
      changeRole(selectedAdmin._id, selectedAdmin.role)
    })
  } catch (error) {
    console.error("❌ Error:", error)
    rl.close()
    mongoose.disconnect()
  }
}

async function changeRole(adminId, currentRole) {
  try {
    const newRole = currentRole === "admin" ? "super-admin" : "admin"

    // Confirm role change
    rl.question(`Change role from "${currentRole}" to "${newRole}"? (y/n): `, async (answer) => {
      if (answer.toLowerCase() !== "y") {
        console.log("❌ Role change cancelled")
        rl.close()
        process.exit(0)
      }

      try {
        // Update admin role
        const admin = await Admin.findById(adminId)
        admin.role = newRole
        await admin.save()

        console.log("✅ Role changed successfully!")
        console.log(`Username: ${admin.username}`)
        console.log(`New role: ${newRole}`)

        rl.close()
        mongoose.disconnect()
      } catch (error) {
        console.error("❌ Failed to change role:", error)
        rl.close()
        mongoose.disconnect()
      }
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
