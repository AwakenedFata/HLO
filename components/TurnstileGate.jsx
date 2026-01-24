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
          backgroundColor: "#222222",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
          flexDirection: "column",
          padding: "20px",
        }}
      >
        <div style={{ maxWidth: "600px", width: "100%" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "1rem", fontWeight: "600" }}>
            HOK Lampung Official
          </h1>
          <p style={{ fontSize: "1.1rem", marginBottom: "2rem", color: "#d1d1d1" }}>
            Verify you are human by completing the action below.
          </p>
          
          <div style={{ marginBottom: "2rem", display: "flex" }}>
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              onSuccess={handleVerify}
              options={{ theme: 'dark' }}
            />
          </div>

          <p style={{ fontSize: "0.9rem", color: "#a0a0a0", marginTop: "2rem" }}>
            HOK Lampung Official needs to review the security of your connection before proceeding.
          </p>
          
          <div style={{ marginTop: "4rem", paddingTop: "1rem", borderTop: "1px solid #444", fontSize: "0.75rem", color: "#666", display: "flex", justifyContent: "center" }}>
             Ray ID: {Math.random().toString(36).substring(2, 12)} &nbsp;&bull;&nbsp; Performance & security by HOK Lampung Security
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
