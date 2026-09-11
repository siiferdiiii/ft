"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("PWA ServiceWorker registered:", registration.scope);
          })
          .catch((err) => {
            console.warn("PWA ServiceWorker registration failed:", err);
          });
      });
    }
  }, []);

  return null;
}
