"use client"

import AdminLayout from "@/components/admin/AdminLayout"
import SSEInitializer from "@/components/admin/SSEInitializer"
import "@/styles/adminstyles.css"

export default function AdminWrappedLayout({ children }) {
  return (
    <AdminLayout>
      {/* Inisialisasi SSE di level layout */}
      <SSEInitializer />
      {children}
    </AdminLayout>
  )
}
