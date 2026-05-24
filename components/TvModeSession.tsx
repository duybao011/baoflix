"use client";

import { useEffect } from "react";

const TV_SESSION_KEY = "baoflix_tv_mode";

export default function TvModeSession() {
  useEffect(() => {
    try {
      sessionStorage.setItem(TV_SESSION_KEY, "1");

      // Xóa flag cũ nếu trước đó đã từng lưu bằng localStorage.
      localStorage.removeItem(TV_SESSION_KEY);
    } catch {
      // bỏ qua nếu browser chặn storage
    }
  }, []);

  return null;
}