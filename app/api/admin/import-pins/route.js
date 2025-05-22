import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import { authorizeRequest } from "@/lib/utils/auth-server"
import logger from "@/lib/utils/logger-server"
import Papa from "papaparse"
import { rateLimit } from "@/lib/utils/rate-limit"

// Rate limiter for import pins endpoint
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100,
  limit: 5, // 5 requests per minute
})

export async function POST(request) {
  try {
    // Apply rate limiting
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rateLimitResult = await limiter.check(identifier, 5, "import-pins")

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          reset: rateLimitResult.reset,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.reset.toString(),
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          },
        },
      )
    }

    await connectToDatabase()

    // Authenticate and authorize user
    const authResult = await authorizeRequest(["admin", "super-admin"])(request)
    if (authResult.error) {
      return NextResponse.json({ status: "error", message: authResult.message }, { status: 401 })
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

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 })
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

    // Limit the number of pins that can be imported at once
    if (result.data.length > 1000) {
      return NextResponse.json({ error: "Maximum 1000 PINs can be imported at once" }, { status: 400 })
    }

    // Process pins
    const pins = []
    const errors = []
    const existingPins = new Set()

    // First, get all existing PIN codes
    const existingPinDocs = await PinCode.find({}, { code: 1 }).lean()
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
        processed: false,
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

    // Save to database in batches for better performance
    const batchSize = 100
    let importedCount = 0

    for (let i = 0; i < pins.length; i += batchSize) {
      const batch = pins.slice(i, i + batchSize)
      const result = await PinCode.insertMany(batch)
      importedCount += result.length
    }

    logger.info(`${importedCount} PIN imported by ${authResult.user.username}`)

    return NextResponse.json(
      {
        success: true,
        imported: importedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully imported ${importedCount} PINs${
          errors.length > 0 ? ` with ${errors.length} errors` : ""
        }`,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
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
