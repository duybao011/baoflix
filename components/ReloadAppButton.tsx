"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const TV_SESSION_KEY = "baoflix_tv_mode";
const HIDE_SESSION_KEY = "baoflix_hide_reload_button";
const PHONE_BREAKPOINT = 768;

function isStandalonePwa() {
  if (typeof window === "undefined") return false;

  const standaloneDisplay = window.matchMedia(
    "(display-mode: standalone)"
  ).matches;

  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return standaloneDisplay || iosStandalone;
}

function isTvModePath(pathname: string) {
  return pathname === "/tv" || pathname.startsWith("/tv/");
}

function isTvModeSession() {
  try {
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("tv") === "1") return true;
    if (searchParams.get("tv") === "0") return false;

    return sessionStorage.getItem(TV_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function isWebViewLike() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent.toLowerCase();

  return (
    userAgent.includes("; wv") ||
    userAgent.includes("version/4.0 chrome") ||
    userAgent.includes("baoflixwebview")
  );
}

function isPhoneViewport() {
  if (typeof window === "undefined") return false;

  return window.innerWidth < PHONE_BREAKPOINT;
}

export default function ReloadAppButton() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function refreshVisible() {
      const tvContext = isTvModePath(pathname) || isTvModeSession();
      const phoneContext = isPhoneViewport();
      const hidden = sessionStorage.getItem(HIDE_SESSION_KEY) === "1";

      // Phone/mobile already has /cai-dat in bottom nav, so do not show
      // the floating reload button there. TV mode also uses /cai-dat.
      setVisible(
        !tvContext &&
          !phoneContext &&
          !hidden &&
          (isStandalonePwa() || isWebViewLike())
      );
    }

    setMounted(true);
    refreshVisible();

    window.addEventListener("focus", refreshVisible);
    window.addEventListener("resize", refreshVisible);
    window.addEventListener("orientationchange", refreshVisible);
    window.addEventListener("baoflix-tv-mode-change", refreshVisible);

    return () => {
      window.removeEventListener("focus", refreshVisible);
      window.removeEventListener("resize", refreshVisible);
      window.removeEventListener("orientationchange", refreshVisible);
      window.removeEventListener("baoflix-tv-mode-change", refreshVisible);
    };
  }, [pathname]);

  async function reloadApp() {
    setLoading(true);

    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();

        await Promise.allSettled(
          registrations.map((registration) => registration.update())
        );
      }
    } catch {
      // Reload normally if the browser/WebView blocks service worker update.
    }

    const url = new URL(window.location.href);
    url.searchParams.set("_reload", String(Date.now()));
    window.location.href = url.toString();
  }

  function hideForSession() {
    sessionStorage.setItem(HIDE_SESSION_KEY, "1");
    setVisible(false);
  }

  if (!mounted || !visible) return null;

  return (
    <div className="fixed bottom-5 right-4 z-[80] hidden items-center gap-2 md:flex">
      <button
        type="button"
        onClick={reloadApp}
        disabled={loading}
        className="rounded-full border border-white/10 bg-black/80 px-4 py-3 text-xs font-black text-white shadow-2xl backdrop-blur hover:bg-white/10 disabled:opacity-60"
        title="Tải lại BảoFlix để nhận bản mới nhất"
      >
        {loading ? "Đang tải..." : "↻ Tải lại app"}
      </button>

      <button
        type="button"
        onClick={hideForSession}
        className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/70 text-sm font-black text-white backdrop-blur hover:bg-white/10"
        aria-label="Ẩn nút tải lại app"
      >
        ×
      </button>
    </div>
  );
}
