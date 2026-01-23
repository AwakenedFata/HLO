import { NextResponse } from "next/server"
import connectToDatabase from "@/lib/db"
import UserMail from "@/lib/models/userMail"
import logger from "@/lib/utils/logger-server"
import { validateRequest, userMailCreationSchema } from "@/lib/utils/validation"
import { rateLimit } from "@/lib/utils/rate-limit"

const limiter = rateLimit({
    interval: 60 * 60 * 1000, // 1 hour
    uniqueTokenPerInterval: 500,
    limit: 5,
})

export async function POST(request) {
    try {
        // Apply rate limiting per IP
        const ip = request.headers.get("x-forwarded-for") || "unknown"
        const limitResult = await limiter.check(ip)

        if (!limitResult.success) {
            return NextResponse.json({ error: "Terlalu banyak pesan dari IP ini, silakan coba lagi nanti" }, { status: 429 })
        }

        await connectToDatabase()

        const body = await request.json()

        // Validate input
        const validation = await validateRequest(userMailCreationSchema, body)
        if (!validation.success) {
            logger.warn(`Invalid contact form submission: ${JSON.stringify(validation.error)}`)
            return NextResponse.json(validation.error, { status: 400 })
        }

        const { name, email, subject, message } = validation.data

        // Create new mail document
        const userMail = new UserMail({
            name,
            email,
            subject,
            message,
        })

        await userMail.save()

        logger.info(`Contact form received from ${email} (${name}): ${subject}`)

        return NextResponse.json(
            {
                success: true,
                message: "Pesan Anda berhasil dikirim",
                data: {
                    id: userMail._id,
                    createdAt: userMail.createdAt,
                },
            },
            { status: 201 },
        )
    } catch (error) {
        logger.error(`Error submitting contact form: ${error.message}`)
        return NextResponse.json({ error: "Gagal mengirim pesan, silakan coba lagi" }, { status: 500 })
    }
}
