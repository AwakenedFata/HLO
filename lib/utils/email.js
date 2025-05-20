import nodemailer from "nodemailer"
import logger from "@/lib/utils/logger"

const sendEmail = async (options) => {
  try {
    // 1) Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    })

    // 2) Define email options
    const mailOptions = {
      from: process.env.EMAIL_FROM || "Admin Redemption <admin@redemption.com>",
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html,
    }

    // 3) Send email
    await transporter.sendMail(mailOptions)
    logger.info(`Email sent successfully to ${options.email}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to send email: ${error.message}`)
    throw new Error("An error occurred while sending the email")
  }
}

export default sendEmail
