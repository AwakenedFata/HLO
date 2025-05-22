import { NextResponse } from "next/server"
import { redirect } from "next/navigation"

// Redirect to the consolidated stats endpoint
export async function GET(request) {
  return NextResponse.redirect(new URL('/api/admin/stats', request.url))
}