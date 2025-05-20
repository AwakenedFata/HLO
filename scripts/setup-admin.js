#!/usr/bin/env node

// Script to set up the first admin user
require("dotenv").config()
const mongoose = require("mongoose")
const readline = require("readline")
const validator = require("validator")
const crypto = require("crypto")
const path = require("path")
const fs = require("fs")

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
    createAdmin()
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err)
    process.exit(1)
  })

async function createAdmin() {
  try {
    // Check if admin already exists
    const adminCount = await Admin.countDocuments()
    if (adminCount > 0) {
      console.log(
        "⚠️ Admin already exists in the database. If you want to reset password, use the reset password feature.",
      )
      rl.close()
      process.exit(0)
    }

    // Ask for username
    rl.question("Enter admin username: ", (username) => {
      if (!username || username.length < 4) {
        console.log("❌ Username must be at least 4 characters")
        rl.close()
        process.exit(1)
      }

      // Ask for email
      rl.question("Enter admin email: ", (email) => {
        if (!validator.isEmail(email)) {
          console.log("❌ Invalid email format")
          rl.close()
          process.exit(1)
        }

        // Ask for password
        rl.question("Enter admin password (min. 8 characters): ", (password) => {
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
              // Create new admin with super-admin role
              const admin = new Admin({
                username,
                email,
                password,
                role: "super-admin",
              })

              await admin.save()
              console.log("✅ Admin created successfully!")
              console.log(`Username: ${username}`)
              console.log(`Email: ${email}`)
              console.log(`Role: super-admin`)

              // Generate JWT secret key
              console.log("\n⚠️ IMPORTANT: Use the following secret key for JWT_SECRET in your .env file:")
              const jwtSecret = crypto.randomBytes(32).toString("hex")
              console.log(jwtSecret)

              // Generate refresh token secret key
              console.log("\n⚠️ IMPORTANT: Use the following secret key for REFRESH_TOKEN_SECRET in your .env file:")
              const refreshSecret = crypto.randomBytes(32).toString("hex")
              console.log(refreshSecret)

              // Update .env file if it exists
              const envPath = path.join(process.cwd(), ".env")
              if (fs.existsSync(envPath)) {
                rl.question("\nDo you want to update your .env file with these secrets? (y/n): ", (answer) => {
                  if (answer.toLowerCase() === "y") {
                    try {
                      let envContent = fs.readFileSync(envPath, "utf8")

                      // Replace or add JWT_SECRET
                      if (envContent.includes("JWT_SECRET=")) {
                        envContent = envContent.replace(/JWT_SECRET=.*/, `JWT_SECRET=${jwtSecret}`)
                      } else {
                        envContent += `\nJWT_SECRET=${jwtSecret}`
                      }

                      // Replace or add REFRESH_TOKEN_SECRET
                      if (envContent.includes("REFRESH_TOKEN_SECRET=")) {
                        envContent = envContent.replace(
                          /REFRESH_TOKEN_SECRET=.*/,
                          `REFRESH_TOKEN_SECRET=${refreshSecret}`,
                        )
                      } else {
                        envContent += `\nREFRESH_TOKEN_SECRET=${refreshSecret}`
                      }

                      fs.writeFileSync(envPath, envContent)
                      console.log("✅ .env file updated successfully!")
                    } catch (error) {
                      console.error("❌ Failed to update .env file:", error)
                    }
                    rl.close()
                    mongoose.disconnect()
                  } else {
                    rl.close()
                    mongoose.disconnect()
                  }
                })
              } else {
                rl.close()
                mongoose.disconnect()
              }
            } catch (error) {
              console.error("❌ Failed to create admin:", error)
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
