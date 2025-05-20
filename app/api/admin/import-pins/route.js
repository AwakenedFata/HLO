import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authenticate } from "@/lib/middleware/authMiddleware"
import logger from "@/lib/utils/logger-server"
import Papa from "papaparse"

export async function POST(request) {
  try {
    await connectToDatabase()

    // Authenticate and authorize user
    const authResult = await authenticate(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: authResult.status })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // Check file type
    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ error: "Only CSV files are allowed" }, { status: 400 })
    }

    // Read file content
    const fileContent = await file.text()

    // Parse CSV
    const result = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    })

    if (result.errors.length > 0) {
      return NextResponse.json({ error: `CSV parsing error: ${result.errors[0].message}` }, { status: 400 })
    }

    // Validate CSV structure
    if (!result.meta.fields.includes("PIN Code")) {
      return NextResponse.json({ error: "CSV must contain a 'PIN Code' column" }, { status: 400 })
    }

    // Process pins
    const pins = []
    const errors = []
    const existingPins = new Set()

    // First, get all existing PIN codes
    const existingPinDocs = await PinCode.find({}, { code: 1 })
    existingPinDocs.forEach((pin) => existingPins.add(pin.code))

    // Process each row
    for (const row of result.data) {
      const code = row["PIN Code"]?.trim()

      if (!code) {
        errors.push(`Row ${result.data.indexOf(row) + 1}: Empty PIN code`)
        continue
      }

      if (existingPins.has(code)) {
        errors.push(`PIN ${code} already exists in the database`)
        continue
      }

      existingPins.add(code) // Add to set to prevent duplicates in the import file

      pins.push({
        code,
        used: false,
        createdAt: new Date(),
        createdBy: authResult.user._id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      })
    }

    if (pins.length === 0) {
      return NextResponse.json(
        {
          error: "No valid PINs to import",
          details: errors,
        },
        { status: 400 },
      )
    }

    // Save to database
    await PinCode.insertMany(pins)

    logger.info(`${pins.length} PIN imported by ${authResult.user.username}`)

    return NextResponse.json({
      success: true,
      imported: pins.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${pins.length} PINs${errors.length > 0 ? ` with ${errors.length} errors` : ""}`,
    })
  } catch (error) {
    logger.error("Error importing pins:", error)
    return NextResponse.json({ error: "Server error: " + error.message }, { status: 500 })
  }
}

export const config = {
  api: {
    bodyParser: false, // Disable the built-in parser to handle form data
  },
}
