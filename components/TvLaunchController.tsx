"use client";

import { useEffect } from "react";

const TV_SESSION_KEY = "baoflix_tv_mode";
const TV_LAUNCH_MODE_KEY = "baoflix_tv_launch_mode";

type TvLaunchMode = "manual" | "always_tv" | "auto_detect";

function getUserAgent() {
  if (typeof navigator === "undefined") return "";

  return navigator.userAgent.toLowerCase();
}

function isBaoflixTvShell() {
  const userAgent = getUserAgent();

  return /baoflixtv|baoflix tv|baoflixwebview|baoflix-webview/.test(userAgent);
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

function isProbablyTvDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  if (isBaoflixTvShell()) return true;

  const userAgent = getUserAgent();
  const hasTvAgent = /smart-tv|smarttv|tizen|webos|appletv|google tv|android tv|aft|bravia|crkey|shield/i.test(
    userAgent
  );
  const largeScreenNoTouch =
    window.matchMedia("(min-width: 960px)").matches &&
    window.matchMedia("(hover: none), (pointer: coarse)").matches;

  return hasTvAgent || (largeScreenNoTouch && !isMobileDevice());
}

function readLaunchMode(): TvLaunchMode {
  if (typeof window === "undefined") return "manual";

  try {
    const value = localStorage.getItem(TV_LAUNCH_MODE_KEY);

    if (
      value === "manual" ||
      value === "always_tv" ||
      value === "auto_detect"
    ) {
      return value;
    }
  } catch {
    // Storage có thể bị WebView chặn.
  }

  return "manual";
}

function enableTvMode() {
  sessionStorage.setItem(TV_SESSION_KEY, "1");
  document.documentElement.dataset.baoflixTvMode = "1";
  window.dispatchEvent(new Event("baoflix-tv-mode-change"));
}

function disableTvMode() {
  sessionStorage.removeItem(TV_SESSION_KEY);
  document.documentElement.dataset.baoflixTvMode = "0";
  window.dispatchEvent(new Event("baoflix-tv-mode-change"));
}

function getTvParam() {
  try {
    return new URLSearchParams(window.location.search).get("tv");
  } catch {
    return null;
  }
}

function applyTvLaunchMode() {
  try {
    const tvParam = getTvParam();

    if (tvParam === "0") {
      disableTvMode();
      return;
    }

    if (tvParam === "1" || isBaoflixTvShell()) {
      enableTvMode();

      if (window.location.pathname === "/") {
        window.location.replace("/tv");
      }

      return;
    }

    if (isMobileDevice()) {
      disableTvMode();
      return;
    }

    const launchMode = readLaunchMode();
    const shouldAutoTv =
      launchMode === "always_tv" ||
      (launchMode === "auto_detect" && isProbablyTvDevice());

    if (shouldAutoTv) {
      enableTvMode();

      if (window.location.pathname === "/") {
        window.location.replace("/tv");
      }

      return;
    }

    document.documentElement.dataset.baoflixTvMode =
      sessionStorage.getItem(TV_SESSION_KEY) === "1" ? "1" : "0";
  } catch {
    // bỏ qua nếu browser/WebView chặn storage.
  }
}

export default function TvLaunchController() {
  useEffect(() => {
    applyTvLaunchMode();

    window.addEventListener("focus", applyTvLaunchMode);
    window.addEventListener("storage", applyTvLaunchMode);
    window.addEventListener("baoflix-tv-launch-mode-change", applyTvLaunchMode);

    return () => {
      window.removeEventListener("focus", applyTvLaunchMode);
      window.removeEventListener("storage", applyTvLaunchMode);
      window.removeEventListener("baoflix-tv-launch-mode-change", applyTvLaunchMode);
    };
  }, []);

  return null;
}
