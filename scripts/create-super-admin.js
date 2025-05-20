#!/usr/bin/env node

// Script to create a new super-admin user
require("dotenv").config()
const mongoose = require("mongoose")
const readline = require("readline")
const validator = require("validator")
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
    createSuperAdmin()
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err)
    process.exit(1)
  })

async function createSuperAdmin() {
  try {
    // Ask for username
    rl.question("Enter new super-admin username: ", async (username) => {
      // Check if username already exists
      const existingAdmin = await Admin.findOne({ username })
      if (existingAdmin) {
        console.log("❌ Username already in use. Please use a different username.")
        rl.close()
        process.exit(1)
      }

      if (!username || username.length < 4) {
        console.log("❌ Username must be at least 4 characters")
        rl.close()
        process.exit(1)
      }

      // Ask for email
      rl.question("Enter super-admin email: ", async (email) => {
        // Check if email already exists
        const existingEmail = await Admin.findOne({ email })
        if (existingEmail) {
          console.log("❌ Email already in use. Please use a different email.")
          rl.close()
          process.exit(1)
        }

        if (!validator.isEmail(email)) {
          console.log("❌ Invalid email format")
          rl.close()
          process.exit(1)
        }

        // Ask for password
        rl.question("Enter super-admin password (min. 8 characters): ", (password) => {
          if (!password || password.length < 8) {
            console.log("❌ Password must be at least 8 characters")
            rl.close()
            process.exit(1)
          }

          // Ask for password confirmation
          rl.question("Confirm password: ", async (confirmPassword) => {
            if (password !== confirmPassword) {
              console.log("❌ Passwords do not match")
              rl.close()
              process.exit(1)
            }

            try {
              // Create new super-admin
              const admin = new Admin({
                username,
                email,
                password,
                role: "super-admin",
              })

              await admin.save()
              console.log("✅ Super-admin created successfully!")
              console.log(`Username: ${username}`)
              console.log(`Email: ${email}`)
              console.log(`Role: super-admin`)

              rl.close()
              mongoose.disconnect()
            } catch (error) {
              console.error("❌ Failed to create super-admin:", error)
              rl.close()
              mongoose.disconnect()
            }
          })
        })
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
