import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import PinCode from "@/lib/models/pinCode"
import logger from "@/lib/utils/logger-server"
import Papa from "papaparse"
import { rateLimit } from "@/lib/utils/rate-limit"
import { requireAdmin } from "@/lib/utils/auth"
import { resolveAdminIdFromSession } from "@/lib/utils/admin-guard"

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100, limit: 5 })

export async function POST(request) {
  try {
    const identifier = request.headers.get("x-forwarded-for") || "anonymous"
    const rate = await limiter.check(identifier, 5, "import-pins")
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", reset: rate.reset },
        {
          status: 429,
          headers: {
            "Retry-After": rate.reset.toString(),
            "X-RateLimit-Limit": rate.limit.toString(),
            "X-RateLimit-Remaining": rate.remaining.toString(),
            "X-RateLimit-Reset": rate.reset.toString(),
          },
        },
      )
    }

    const session = await requireAdmin()
    await connectToDatabase()
    const adminId = await resolveAdminIdFromSession(session)

    const formData = await request.formData()
    const file = formData.get("file")
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    if (!file.name.endsWith(".csv")) return NextResponse.json({ error: "Only CSV files are allowed" }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File size exceeds 5MB limit" }, { status: 400 })

    const fileContent = await file.text()
    
    const parsed = Papa.parse(fileContent, { 
      header: true, 
      skipEmptyLines: true,
      delimiter: ",",
    })
    
    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: `CSV parsing error: ${parsed.errors[0].message}` }, { status: 400 })
    }
    if (!parsed.meta.fields.includes("PIN Code")) {
      return NextResponse.json({ error: "CSV must contain a 'PIN Code' column" }, { status: 400 })
    }
    if (parsed.data.length > 1000) {
      return NextResponse.json({ error: "Maximum 1000 PINs can be imported at once" }, { status: 400 })
    }

    const pins = []
    const errors = []
    const existingPins = new Set()
    const existingPinDocs = await PinCode.find({}, { code: 1 }).lean()
    existingPinDocs.forEach((p) => existingPins.add(p.code))

    for (const [idx, row] of parsed.data.entries()) {
      const code = row["PIN Code"]?.trim().toUpperCase()
      
      if (!code) {
        errors.push(`Row ${idx + 1}: Empty PIN code`)
        continue
      }
      
      // Validasi format: harus 16 karakter atau lebih (jika ada prefix max 21)
      if (code.length < 16) {
        errors.push(`Row ${idx + 1}: PIN code "${code}" harus minimal 16 karakter`)
        continue
      }
      
      if (code.length > 21) {
        errors.push(`Row ${idx + 1}: PIN code "${code}" maksimal 21 karakter (16 digit + prefix 5 karakter)`)
        continue
      }
      
      // Validasi karakter: hanya huruf kapital, angka, dan tanda hubung
      if (!/^[A-Z0-9-]+$/.test(code)) {
        errors.push(`Row ${idx + 1}: PIN code "${code}" hanya boleh berisi huruf kapital, angka, dan tanda -`)
        continue
      }
      
      if (existingPins.has(code)) {
        errors.push(`PIN ${code} already exists in the database`)
        continue
      }
      
      existingPins.add(code)
      pins.push({
        code,
        used: false,
        processed: false,
        createdAt: new Date(),
        createdBy: adminId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
    }

    if (pins.length === 0) {
      return NextResponse.json({ error: "No valid PINs to import", details: errors }, { status: 400 })
    }

    const batchSize = 100
    let importedCount = 0
    for (let i = 0; i < pins.length; i += batchSize) {
      const batch = pins.slice(i, i + batchSize)
      const result = await PinCode.insertMany(batch)
      importedCount += result.length
    }

    logger.info(`${importedCount} PIN (16 digit) imported by ${session.user.email}`)

    return NextResponse.json(
      {
        success: true,
        imported: importedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully imported ${importedCount} PINs (16 digit)${errors.length > 0 ? ` with ${errors.length} errors` : ""}`,
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
  api: { bodyParser: false },
}