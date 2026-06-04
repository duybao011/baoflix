"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const TV_SESSION_KEY = "baoflix_tv_mode";
const HIDE_SESSION_KEY = "baoflix_hide_reload_button";

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

function isTvMode() {
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
    userAgent.includes("android tv")
  );
}

function shouldShowReloadButton() {
  try {
    if (sessionStorage.getItem(HIDE_SESSION_KEY) === "1") return false;
  } catch {
    // bỏ qua nếu browser chặn storage
  }

  return isStandalonePwa() || isTvMode() || isWebViewLike();
}

function getReloadHref() {
  const url = new URL(window.location.href);
  url.searchParams.set("_reload", String(Date.now()));
  return url.toString();
}

export default function ReloadAppButton() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const isWatchPage = pathname.startsWith("/xem") || pathname.includes("/xem");

  useEffect(() => {
    function refreshVisible() {
      setVisible(shouldShowReloadButton());
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
      // Nếu browser/WebView không cho update SW thì reload thường vẫn được.
    }

    window.location.href = getReloadHref();
  }

  function hideTemporarily() {
    try {
      sessionStorage.setItem(HIDE_SESSION_KEY, "1");
    } catch {
      // bỏ qua
    }

    setVisible(false);
  }

  if (!mounted || !visible) return null;

  return (
    <div
      className={[
        "fixed z-[80] flex items-center gap-1 rounded-full border border-white/10 bg-black/80 p-1 shadow-2xl backdrop-blur",
        isWatchPage
          ? "right-4 top-[calc(env(safe-area-inset-top)+1rem)] md:bottom-5 md:right-5 md:top-auto"
          : "right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-5 md:right-5",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={reloadApp}
        disabled={loading}
        className="rounded-full px-3 py-2 text-xs font-black text-white hover:bg-white/10 disabled:opacity-60 md:px-4"
        title="Tải lại BảoFlix để nhận bản mới nhất"
      >
        <span className="md:hidden">{loading ? "..." : "↻"}</span>
        <span className="hidden md:inline">
          {loading ? "Đang tải..." : "↻ Tải lại app"}
        </span>
      </button>

      <button
        type="button"
        onClick={hideTemporarily}
        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-slate-300 hover:bg-white/10 hover:text-white"
        aria-label="Ẩn nút tải lại app"
        title="Ẩn tạm nút tải lại app"
      >
        ×
      </button>
    </div>
  );
}
