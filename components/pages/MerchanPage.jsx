"use client";

import { useState, useEffect } from "react";

function MerchanPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [!isClient]);

  const postermerchan = "/assets/Merchandise/comingsoon.png";
  const postermerchanmobile = "/assets/Merchandise/comingsoonvertikal.png";

  return (
    <div
      className="merchan-page w-100 min-vh-100"
      style={{
        backgroundImage: `url(${
          isMobile ? postermerchanmobile : postermerchan
        })`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        minHeight: "100vh",
      }}
    ></div>
  );
}

export default MerchanPage;