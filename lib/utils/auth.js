import GoogleProvider from "next-auth/providers/google"
import connectDB from "@/lib/db"
import Admin from "@/lib/models/admin"
import { getServerSession } from "next-auth"

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      try {
        const adminEmail = getAdminEmail()
        if (user.email !== adminEmail) return false

        await connectDB()

        const adminData = {
          email: user.email,
          name: user.name,
          googleId: account.providerAccountId,
          image: user.image,
          lastLogin: new Date(),
        }

        await Admin.findOneAndUpdate({ email: user.email }, adminData, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        })

        return true
      } catch {
        return false
      }
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.email = user.email
        token.name = user.name
        token.image = user.image
        token.googleId = account.providerAccountId
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.email = token.email
        session.user.name = token.name
        session.user.image = token.image
        session.user.googleId = token.googleId
      }
      return session
    },
  },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export const getAdminEmail = () => process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    // Unauthorized
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 })
  }
  const adminEmail = getAdminEmail()
  if (session.user.email !== adminEmail) {
    // Forbidden
    throw Object.assign(new Error("Insufficient permissions"), { statusCode: 403 })
  }
  return session
}

export async function requireAdminSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { ok: false, status: 401, message: "Unauthorized" }
  }
  const adminEmail = getAdminEmail()
  if (adminEmail && session.user.email !== adminEmail) {
    return { ok: false, status: 403, message: "Forbidden: admin only" }
  }
  return { ok: true, session }
}
