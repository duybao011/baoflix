"use client";

import { useEffect } from "react";

const TV_SESSION_KEY = "baoflix_tv_mode";
const TV_LAUNCH_MODE_KEY = "baoflix_tv_launch_mode";

type TvLaunchMode = "manual" | "always_tv" | "auto_detect";

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent.toLowerCase();

  return /iphone|ipad|ipod|android.+mobile|mobile/.test(userAgent);
}

function isProbablyTvDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
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
    const isMobile = isMobileDevice();

    if (tvParam === "0" || isMobile) {
      disableTvMode();
      return;
    }

    if (tvParam === "1") {
      enableTvMode();
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
