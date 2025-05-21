"use client"

import AdminLayout from "@/components/admin/AdminLayout"
import SocketInitializer from "@/components/admin/SocketInitializer"
import "@/styles/adminstyles.css"

export default function AdminWrappedLayout({ children }) {
  return (
    <AdminLayout>
      {/* Inisialisasi Socket.io di level layout */}
      <SocketInitializer />
      {children}
    </AdminLayout>
  )
}
