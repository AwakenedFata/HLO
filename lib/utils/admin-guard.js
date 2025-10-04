import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/utils/auth"
import Admin from "@/lib/models/admin"

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user?.email) {
    throw { statusCode: 401, message: "Unauthorized" }
  }
  const adminEmail = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL
  if (adminEmail && session.user.email !== adminEmail) {
    throw { statusCode: 403, message: "Forbidden: admin only" }
  }
  return session
}

export async function resolveAdminIdFromSession(session) {
  if (!session?.user?.email) {
    // Konsisten dengan requireAdmin: unauthorized jika tidak ada email
    throw { status: 401, message: "Unauthorized" }
  }
  // Penting: pastikan connectDB() sudah dipanggil di route sebelum memanggil resolver ini.
  const admin = await Admin.findOne({ email: session.user.email }).select("_id")
  if (!admin?._id) {
    // Jangan auto-create karena Admin schema mewajibkan googleId & name
    throw { status: 403, message: "Forbidden: admin record not found" }
  }
  return admin._id
}
