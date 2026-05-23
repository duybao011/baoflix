"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenDivElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export default function FullscreenPlayerBox({
  children,
}: {
  children: ReactNode;
}) {
  const boxRef = useRef<FullscreenDivElement | null>(null);

  const [cinemaMode, setCinemaMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const expanded = cinemaMode || isFullscreen;

  async function enterFullscreen() {
    const box = boxRef.current;

    if (!box) return;

    try {
      if (box.requestFullscreen) {
        await box.requestFullscreen();
        return;
      }

      if (box.webkitRequestFullscreen) {
        await box.webkitRequestFullscreen();
        return;
      }

      setCinemaMode(true);
    } catch {
      setCinemaMode(true);
    }
  }

  async function exitFullscreen() {
    const doc = document as FullscreenDocument;

    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
    } catch {
      // bỏ qua lỗi fullscreen trên một số WebView TV
    }

    setCinemaMode(false);
  }

  function toggleFullscreen() {
    if (expanded) {
      void exitFullscreen();
    } else {
      void enterFullscreen();
    }
  }

  useEffect(() => {
    function syncFullscreenState() {
      const doc = document as FullscreenDocument;
      const currentFullscreenElement =
        document.fullscreenElement || doc.webkitFullscreenElement || null;

      const active = currentFullscreenElement === boxRef.current;

      setIsFullscreen(active);

      if (!active) {
        setCinemaMode(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (key === "escape" && cinemaMode && !isFullscreen) {
        setCinemaMode(false);
      }

      if (key === "f") {
        event.preventDefault();
        toggleFullscreen();
      }
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener(
        "webkitfullscreenchange",
        syncFullscreenState
      );
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [cinemaMode, isFullscreen]);

  return (
    <div
      ref={boxRef}
      className={[
        "baoflix-fullscreen-player relative overflow-hidden border border-white/10 bg-black transition-all duration-300",
        expanded ? "rounded-2xl" : "rounded-3xl",
      ].join(" ")}
    >
      <div
        className={[
          "baoflix-fullscreen-inner bg-black transition-all duration-300",
          expanded ? "h-[78vh] w-full" : "aspect-video w-full",
        ].join(" ")}
      >
        {children}
      </div>

      <div className="absolute right-4 top-4 z-50 flex gap-2">
        <button
          type="button"
          onClick={toggleFullscreen}
          className={[
            "rounded-xl px-4 py-2 text-sm font-black text-white backdrop-blur",
            expanded
              ? "bg-red-600 hover:bg-red-500"
              : "bg-black/75 hover:bg-yellow-300 hover:text-black",
          ].join(" ")}
        >
          {expanded ? "Thu nhỏ" : "Toàn màn hình TV"}
        </button>
      </div>
    </div>
  );
}