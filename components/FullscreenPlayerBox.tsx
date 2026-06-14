"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenDivElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenPlayerBoxProps = {
  children: ReactNode;
  /**
   * TV Mode dùng immersive CSS full viewport thay vì ép Fullscreen API.
   * Cách này ổn hơn trong Android TV WebView vì requestFullscreen sau navigation
   * thường bị browser chặn nếu không còn user gesture.
   */
  tvImmersive?: boolean;
};

export default function FullscreenPlayerBox({
  children,
  tvImmersive = false,
}: FullscreenPlayerBoxProps) {
  const boxRef = useRef<FullscreenDivElement | null>(null);

  const [cinemaMode, setCinemaMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const expanded = tvImmersive || cinemaMode || isFullscreen;

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
      // Bỏ qua lỗi fullscreen trên một số WebView TV.
    }

    setCinemaMode(false);
  }

  function toggleFullscreen() {
    if (tvImmersive) return;

    if (expanded) {
      void exitFullscreen();
    } else {
      void enterFullscreen();
    }
  }

  useEffect(() => {
    if (!tvImmersive) return;

    const oldBodyOverflow = document.body.style.overflow;
    const oldBodyTouchAction = document.body.style.touchAction;
    const oldHtmlOverflow = document.documentElement.style.overflow;
    const oldHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = oldBodyOverflow;
      document.body.style.touchAction = oldBodyTouchAction;
      document.documentElement.style.overflow = oldHtmlOverflow;
      document.documentElement.style.overscrollBehavior = oldHtmlOverscroll;
    };
  }, [tvImmersive]);

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

      if (key === "f" && !tvImmersive) {
        event.preventDefault();
        toggleFullscreen();
      }
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [cinemaMode, isFullscreen, tvImmersive]);

  return (
    <div
      ref={boxRef}
      data-tv-player-immersive={tvImmersive ? "true" : "false"}
      className={[
        "baoflix-fullscreen-player bg-black transition-all duration-300",
        tvImmersive
          ? "fixed inset-0 z-[90] overflow-hidden border-0"
          : "relative overflow-hidden border border-white/10",
        tvImmersive ? "rounded-none" : expanded ? "rounded-2xl" : "rounded-3xl",
      ].join(" ")}
    >
      <div
        className={[
          "baoflix-fullscreen-inner bg-black transition-all duration-300",
          tvImmersive
            ? "h-[100dvh] w-[100vw]"
            : expanded
              ? "h-[78vh] w-full"
              : "aspect-video w-full",
        ].join(" ")}
      >
        {children}
      </div>

      {!tvImmersive && (
        <div className="absolute right-4 top-4 z-50 flex gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className={[
              "rounded-xl px-3 py-2 text-xs font-black text-white backdrop-blur sm:px-4 sm:text-sm",
              expanded
                ? "bg-red-600 hover:bg-red-500"
                : "bg-black/75 hover:bg-yellow-300 hover:text-black",
            ].join(" ")}
          >
            {expanded ? "Thu nhỏ" : "Toàn màn hình"}
          </button>
        </div>
      )}
    </div>
  );
}
