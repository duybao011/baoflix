"use client";

import { useEffect } from "react";
import { isMobileDevice, setTvModeSession } from "@/lib/tvMode";

export default function TvModeSession() {
  useEffect(() => {
    try {
      if (isMobileDevice()) {
        localStorage.removeItem("baoflix_tv_mode");
        setTvModeSession(false);
        return;
      }

      localStorage.removeItem("baoflix_tv_mode");
      setTvModeSession(true);
    } catch {
      // bỏ qua nếu browser/WebView chặn storage
    }
  }, []);

  return null;
}
