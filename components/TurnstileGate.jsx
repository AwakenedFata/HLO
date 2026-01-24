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
          minHeight: "100vh",
          backgroundColor: "#1a1a1a",
          color: "#ffffff",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Main Content */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div style={{ maxWidth: "480px", width: "100%" }}>
            {/* Title - Domain/Site Name */}
            <h1 style={{ 
              fontSize: "28px", 
              fontWeight: "400", 
              marginBottom: "8px",
              letterSpacing: "-0.5px"
            }}>
              hoklampung.com
            </h1>
            
            {/* Subtitle */}
            <p style={{ 
              fontSize: "16px", 
              fontWeight: "500",
              marginBottom: "24px", 
              color: "#ffffff" 
            }}>
              Verify you are human by completing the action below.
            </p>
            
            {/* Turnstile Widget */}
            <div style={{ marginBottom: "40px" }}>
              <Turnstile
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                onSuccess={handleVerify}
                options={{ theme: 'light' }}
              />
            </div>
            
            {/* Description */}
            <p style={{ 
              fontSize: "16px", 
              color: "#a0a0a0", 
              lineHeight: "1.6",
              marginTop: "60px"
            }}>
              hoklampung.com needs to review the security of your connection before proceeding.
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div style={{ 
          borderTop: "1px solid #333", 
          padding: "20px", 
          textAlign: "center",
          fontSize: "12px", 
          color: "#666"
        }}>
          <div style={{ marginBottom: "4px" }}>
            Ray ID: {typeof window !== 'undefined' ? Math.random().toString(36).substring(2, 14) : 'loading...'}
          </div>
          <div>
            Performance & security by <span style={{ color: "#888", fontWeight: "500" }}>Cloudflare</span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
