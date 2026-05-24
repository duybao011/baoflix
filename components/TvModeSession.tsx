"use client";

import { useEffect } from "react";

const TV_SESSION_KEY = "baoflix_tv_mode";

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent.toLowerCase();

  return /iphone|ipad|ipod|android.+mobile|mobile/.test(userAgent);
}

export default function TvModeSession() {
  useEffect(() => {
    try {
      // Học theo logic TV app:
      // mobile dù vào /tv cũng không bật TV overlay.
      if (isMobileDevice()) {
        sessionStorage.removeItem(TV_SESSION_KEY);
        localStorage.removeItem(TV_SESSION_KEY);
        window.dispatchEvent(new Event("baoflix-tv-mode-change"));
        return;
      }

      sessionStorage.setItem(TV_SESSION_KEY, "1");
      localStorage.removeItem(TV_SESSION_KEY);
      window.dispatchEvent(new Event("baoflix-tv-mode-change"));
    } catch {
      // bỏ qua nếu browser chặn storage
    }
  }, []);

  return null;
}