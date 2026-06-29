"use client";

const TV_SESSION_KEY = "baoflix_tv_mode";
const TV_LOCAL_KEY = "baoflix_tv_mode";

type TvModeOptions = {
  /**
   * Laptop/desktop chỉ được bật TV bằng sessionStorage khi option này true.
   * Dùng false cho player/watch để TV logic không rò sang laptop sau khi test.
   */
  allowSessionOnDesktop?: boolean;
};

export function getBaoflixUserAgent() {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent.toLowerCase();
}

export function isBaoflixTvShell() {
  return /baoflixtv|baoflix tv|baoflixwebview|baoflix-webview/.test(
    getBaoflixUserAgent()
  );
}

export function isTvUserAgent() {
  return /android tv|google tv|googletv|smart-tv|smarttv|hbbtv|tizen|webos|appletv|aft|bravia|crkey|shield|netcast|viera|hisense|vidaa|roku|tcl|mitv/.test(
    getBaoflixUserAgent()
  );
}

export function isMobileDevice() {
  const userAgent = getBaoflixUserAgent();

  if (!userAgent) return false;
  if (isBaoflixTvShell() || isTvUserAgent()) return false;

  return /iphone|ipad|ipod|android.+mobile|mobile/.test(userAgent);
}

export function isDesktopMouseDevice() {
  if (typeof window === "undefined") return false;

  return window.matchMedia(
    "(min-width: 1024px) and (hover: hover) and (pointer: fine)"
  ).matches;
}

function getTvParam() {
  try {
    return new URLSearchParams(window.location.search).get("tv");
  } catch {
    return null;
  }
}

function readStoredTvMode() {
  try {
    return (
      sessionStorage.getItem(TV_SESSION_KEY) ||
      localStorage.getItem(TV_LOCAL_KEY) ||
      ""
    );
  } catch {
    return "";
  }
}

export function isTvModeActive(options: TvModeOptions = {}) {
  if (typeof window === "undefined") return false;

  const { allowSessionOnDesktop = true } = options;
  const tvParam = getTvParam();

  if (tvParam === "0") return false;
  if (tvParam === "1") return true;
  if (isBaoflixTvShell() || isTvUserAgent()) return true;
  if (isMobileDevice()) return false;

  const storedMode = readStoredTvMode();
  if (storedMode !== "1") return false;

  if (!allowSessionOnDesktop && isDesktopMouseDevice()) return false;

  return true;
}

export function clearTvModeForNormalDevice() {
  if (typeof window === "undefined") return;

  try {
    if (isMobileDevice()) {
      sessionStorage.removeItem(TV_SESSION_KEY);
      localStorage.removeItem(TV_LOCAL_KEY);
      document.documentElement.dataset.baoflixTvMode = "0";
    }
  } catch {
    // Ignore storage restrictions.
  }
}
