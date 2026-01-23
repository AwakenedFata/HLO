"use client";

import { useState, useEffect } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { usePathname } from "next/navigation";

export default function TurnstileGate({ children }) {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    // Bypass verification for PDF page and admin routes
    if (pathname === "/pdfpage" || pathname.startsWith("/admin")) {
      setIsVerified(true);
      setIsLoading(false);
      return;
    }

    // Check if user has already been verified in this session
    const verified = sessionStorage.getItem("turnstile_verified");
    if (verified === "true") {
      setIsVerified(true);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [pathname]);

  const handleVerify = async (token) => {
    try {
      const response = await fetch("/api/verify-turnstile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success) {
        sessionStorage.setItem("turnstile_verified", "true");
        setIsVerified(true);
      } else {
        console.error("Turnstile verification failed");
      }
    } catch (error) {
      console.error("Error verifying turnstile:", error);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          backgroundColor: "#f5f5f5",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          backgroundColor: "#f5f5f5",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <Turnstile
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          onSuccess={handleVerify}
        />
      </div>
    );
  }

  return <>{children}</>;
}
