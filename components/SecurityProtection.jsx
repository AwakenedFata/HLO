"use client";

import { useEffect } from "react";

export default function SecurityProtection() {
  useEffect(() => {
    // Block keyboard shortcuts (Ctrl+S, Ctrl+U, F12)
    const handleKeyDown = (e) => {
      // Block F12 (DevTools)
      if (e.key === "F12") {
        e.preventDefault();
        return false;
      }

      // Block Ctrl+S (Save page)
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        return false;
      }

      // Block Ctrl+U (View source)
      if (e.ctrlKey && e.key === "u") {
        e.preventDefault();
        return false;
      }

      // Block Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === "I") {
        e.preventDefault();
        return false;
      }

      // Block Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === "J") {
        e.preventDefault();
        return false;
      }

      // Block Ctrl+Shift+C (Inspect Element)
      if (e.ctrlKey && e.shiftKey && e.key === "C") {
        e.preventDefault();
        return false;
      }
    };

    // Block right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // Block image drag
    const handleDragStart = (e) => {
      if (e.target.tagName === "IMG") {
        e.preventDefault();
        return false;
      }
    };

    // Add event listeners
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);

    // Cleanup on unmount
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
    };
  }, []);

  return null;
}
