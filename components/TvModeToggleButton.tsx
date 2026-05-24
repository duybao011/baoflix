"use client";

import { useEffect, useState } from "react";

const TV_SESSION_KEY = "baoflix_tv_mode";

function isDesktopMouseDevice() {
  if (typeof window === "undefined") return false;

  return window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches;
}

function readTvMode() {
  try {
    return sessionStorage.getItem(TV_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function notifyTvModeChanged() {
  window.dispatchEvent(new Event("baoflix-tv-mode-change"));
}

export default function TvModeToggleButton() {
  const [mounted, setMounted] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setMounted(true);
    setShowButton(isDesktopMouseDevice());
    setEnabled(readTvMode());

    function refresh() {
      setShowButton(isDesktopMouseDevice());
      setEnabled(readTvMode());
    }

    window.addEventListener("resize", refresh);
    window.addEventListener("baoflix-tv-mode-change", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("baoflix-tv-mode-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function toggleTvMode() {
    try {
      const next = !readTvMode();

      if (next) {
        sessionStorage.setItem(TV_SESSION_KEY, "1");
      } else {
        sessionStorage.removeItem(TV_SESSION_KEY);
        localStorage.removeItem(TV_SESSION_KEY);
      }

      setEnabled(next);
      notifyTvModeChanged();
    } catch {
      // bỏ qua nếu browser chặn storage
    }
  }

  if (!mounted || !showButton) return null;

  return (
    <button
      type="button"
      onClick={toggleTvMode}
      className={[
        "fixed bottom-5 right-5 z-[80] hidden rounded-full border px-4 py-3 text-sm font-black shadow-2xl backdrop-blur lg:inline-flex",
        enabled
          ? "border-yellow-300/60 bg-yellow-300 text-black hover:bg-yellow-200"
          : "border-white/10 bg-black/75 text-white hover:bg-white/10",
      ].join(" ")}
      title={enabled ? "Tắt TV Mode trong tab này" : "Bật TV Mode trong tab này"}
    >
      {enabled ? "TV Mode: Bật" : "TV Mode: Tắt"}
    </button>
  );
}