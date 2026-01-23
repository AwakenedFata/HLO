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
        
        console.log("Sign in attempt:", {
          userEmail: user.email,
          adminEmail,
          isMatch: user.email === adminEmail
        })

        if (user.email !== adminEmail) {
          console.error("Access denied: Email mismatch")
          return false
        }

        await connectDB()

        const adminData = {
          email: user.email,
          name: user.name,
          googleId: account.providerAccountId,
          image: user.image,
          lastLogin: new Date(),
        }

        const savedAdmin = await Admin.findOneAndUpdate(
          { email: user.email }, 
          adminData, 
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        )

        console.log("Admin saved successfully:", savedAdmin._id)
        return true
        
      } catch (error) {
        console.error("SignIn callback error:", error)
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
    async redirect({ url, baseUrl }) {
      // Pastikan redirect ke URL yang benar
      console.log("Redirect callback:", { url, baseUrl })
      
      // Jika url sudah lengkap dan dari domain yang sama, gunakan itu
      if (url.startsWith(baseUrl)) {
        return url
      }
      // Jika url adalah path relatif, gabungkan dengan baseUrl
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`
      }
      // Default redirect ke dashboard
      return `${baseUrl}/admin/dashboard`
    },
  },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
}

export const getAdminEmail = () => {
  const email = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL
  if (!email) {
    console.error("ADMIN_EMAIL not configured!")
  }
  return email
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 })
  }
  const adminEmail = getAdminEmail()
  if (session.user.email !== adminEmail) {
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