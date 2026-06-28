"use client";

import { useEffect } from "react";

const TV_SESSION_KEY = "baoflix_tv_mode";

function getUserAgent() {
  if (typeof navigator === "undefined") return "";

  return navigator.userAgent.toLowerCase();
}

function isBaoflixTvShell() {
  return /baoflixtv|baoflix tv|baoflixwebview|baoflix-webview/.test(
    getUserAgent()
  );
}

function isMobileDevice() {
  const userAgent = getUserAgent();

  if (!userAgent) return false;
  if (isBaoflixTvShell()) return false;
  if (/android tv|google tv|smart-tv|smarttv|tizen|webos|appletv|aft|bravia|crkey|shield/.test(userAgent)) {
    return false;
  }

  return /iphone|ipad|ipod|android.+mobile|mobile/.test(userAgent);
}

export default function TvModeSession() {
  useEffect(() => {
    try {
      if (isMobileDevice()) {
        sessionStorage.removeItem(TV_SESSION_KEY);
        localStorage.removeItem(TV_SESSION_KEY);
        document.documentElement.dataset.baoflixTvMode = "0";
        window.dispatchEvent(new Event("baoflix-tv-mode-change"));
        return;
      }

      sessionStorage.setItem(TV_SESSION_KEY, "1");
      localStorage.removeItem(TV_SESSION_KEY);
      document.documentElement.dataset.baoflixTvMode = "1";
      window.dispatchEvent(new Event("baoflix-tv-mode-change"));
    } catch {
      // bỏ qua nếu browser/WebView chặn storage
    }
  }, []);

  return null;
}
