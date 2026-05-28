"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const TV_SESSION_KEY = "baoflix_tv_mode";

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

export default function ReloadAppButton() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function refreshVisible() {
      setVisible(isStandalonePwa() || isTvMode() || isWebViewLike());
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

    window.location.reload();
  }

  if (!mounted || !visible) return null;

  return (
    <button
      type="button"
      onClick={reloadApp}
      disabled={loading}
      className="fixed bottom-24 left-4 z-[80] rounded-full border border-white/10 bg-black/80 px-4 py-3 text-xs font-black text-white shadow-2xl backdrop-blur hover:bg-white/10 disabled:opacity-60 md:bottom-5"
      title="Tải lại Baoflix để nhận bản mới nhất"
    >
      {loading ? "Đang tải..." : "↻ Tải lại app"}
    </button>
  );
}