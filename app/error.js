"use client"

import { useState, useEffect } from "react"
import logger from "@/lib/utils/logger-client"

export default function Error({ error, reset }) {
  const [isClient, setIsClient] = useState(false)
  const [showDetailedError, setShowDetailedError] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setShowDetailedError(process.env.NODE_ENV === "development")

    logger.error("Unhandled error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <p className="mb-4 text-gray-600">
        {isClient && showDetailedError ? error.message : "An error occurred on the server"}
      </p>
      <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" onClick={() => reset()}>
        Try again
      </button>
    </div>
  )
}