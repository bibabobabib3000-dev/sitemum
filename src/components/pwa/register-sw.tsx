"use client";

import { useEffect } from "react";

// next-pwa@5.6.0 injects its register script through the legacy
// `pages/_document` flow, which the App Router does not have. The SW file
// (`/sw.js`) is still generated, but nothing registers it in the browser.
// This client component closes that gap.
export function RegisterSW() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[pwa] failed to register service worker", err);
    });
  }, []);

  return null;
}
