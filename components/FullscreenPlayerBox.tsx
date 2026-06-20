"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenDivElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type PlayerHudDetail = {
  type: "seek" | "play" | "pause";
  delta?: number;
  currentTime?: number;
  duration?: number;
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

function formatTime(value?: number) {
  if (!value || !Number.isFinite(value) || value < 0) return "0:00";

  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function FullscreenPlayerBox({
  children,
  tvImmersive = false,
}: FullscreenPlayerBoxProps) {
  const boxRef = useRef<FullscreenDivElement | null>(null);
  const hudTimerRef = useRef<number | null>(null);

  const [cinemaMode, setCinemaMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerHud, setPlayerHud] = useState<PlayerHudDetail | null>(null);

  const expanded = tvImmersive || cinemaMode || isFullscreen;

  function focusPlayerSurface() {
    const box = boxRef.current;

    if (!box) return;

    const player = box.querySelector<HTMLElement>(
      "video[data-tv-player='video'], iframe[data-tv-player='iframe'], video, iframe"
    );

    window.setTimeout(() => {
      try {
        if (player) {
          player.focus({ preventScroll: true });
          return;
        }

        box.focus({ preventScroll: true });
      } catch {
        // Ignore focus errors in WebView.
      }
    }, 30);
  }

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

    // Khi vào TV watch mode, để focus nằm ở player surface.
    // Nếu là HLS thì focus video, nếu là embed thì focus iframe để remote được player nhận.
    focusPlayerSurface();

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

  useEffect(() => {
    function handlePlayerHud(event: Event) {
      const detail = (event as CustomEvent<PlayerHudDetail>).detail;

      if (!detail) return;

      if (hudTimerRef.current) {
        window.clearTimeout(hudTimerRef.current);
      }

      setPlayerHud(detail);

      hudTimerRef.current = window.setTimeout(() => {
        setPlayerHud(null);
        hudTimerRef.current = null;
      }, 850);
    }

    function handleFocusPlayer() {
      focusPlayerSurface();
    }

    window.addEventListener("baoflix-tv-player-hud", handlePlayerHud as EventListener);
    window.addEventListener("baoflix-focus-tv-player", handleFocusPlayer);

    return () => {
      if (hudTimerRef.current) {
        window.clearTimeout(hudTimerRef.current);
      }

      window.removeEventListener("baoflix-tv-player-hud", handlePlayerHud as EventListener);
      window.removeEventListener("baoflix-focus-tv-player", handleFocusPlayer);
    };
  }, []);

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      data-tv-player-surface="true"
      data-tv-skip
      data-tv-player-immersive={tvImmersive ? "true" : "false"}
      className={[
        "baoflix-fullscreen-player bg-black outline-none transition-all duration-300",
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

      {tvImmersive && playerHud && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-black/75 px-7 py-5 text-center text-white shadow-2xl backdrop-blur">
          <div className="text-3xl font-black">
            {playerHud.type === "seek"
              ? playerHud.delta && playerHud.delta > 0
                ? `⏩ +${playerHud.delta}s`
                : `⏪ ${playerHud.delta}s`
              : playerHud.type === "play"
                ? "▶ Phát"
                : "⏸ Tạm dừng"}
          </div>

          {playerHud.type === "seek" && (
            <div className="mt-2 text-sm font-bold text-slate-300">
              {formatTime(playerHud.currentTime)}
              {playerHud.duration ? ` / ${formatTime(playerHud.duration)}` : ""}
            </div>
          )}
        </div>
      )}

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
