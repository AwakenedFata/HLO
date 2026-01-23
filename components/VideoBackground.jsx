"use client"

import { useState, useEffect } from "react"

export default function VideoBackground() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    // Tampilkan placeholder saat server-side rendering
    return <div className="video-background-placeholder" />
  }

  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      className="video-background"
      src="/assets/Home/herobackground_compressedsmall.mp4"
    ></video>
  )
}
