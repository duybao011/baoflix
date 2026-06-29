"use client";

import { useEffect } from "react";

const TV_SESSION_KEY = "baoflix_tv_mode";

function getUserAgent() {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent.toLowerCase();
}

function isTvLikeRuntime() {
  if (typeof window === "undefined") return false;

  try {
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("tv") === "1") return true;
    if (document.documentElement.dataset.baoflixTvMode === "1") return true;
    if (sessionStorage.getItem(TV_SESSION_KEY) === "1") return true;
  } catch {
    // Ignore blocked storage / URL access in strict WebViews.
  }

  return /baoflixtv|baoflix tv|baoflixwebview|baoflix-webview|android tv|google tv|smart-tv|smarttv|tizen|webos|appletv|aft|bravia|crkey|shield|netcast|viera|hisense|vidaa|roku/.test(
    getUserAgent()
  );
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
