"use client";

import { useEffect } from "react";
import { isTvModeActive } from "@/lib/tvMode";

function isTvLikeRuntime() {
  return isTvModeActive();
}

export default function PwaRegister() {
  useEffect(() => {
    if (isTvLikeRuntime()) return;
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  return null;
}
