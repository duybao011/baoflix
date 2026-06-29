"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

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

type PlayerCommandAction = "seek" | "toggle-play" | "play" | "pause" | "focus-player";

type PlayerCommandDetail = {
  action: PlayerCommandAction;
  seconds?: number;
  handled?: boolean;
};

type FullscreenPlayerBoxProps = {
  children: ReactNode;
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

function emitNativeMissing() {
  window.dispatchEvent(new Event("baoflix-tv-native-missing"));
}

function emitHud(detail: PlayerHudDetail) {
  window.dispatchEvent(
    new CustomEvent("baoflix-tv-player-hud", {
      detail,
    })
  );
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

  const focusPlayerSurface = useCallback(() => {
    const box = boxRef.current;

    if (!box) return;

    window.setTimeout(() => {
      try {
        const active = document.activeElement;

        if (active instanceof HTMLElement && active !== box && box.contains(active)) {
          active.blur();
        }

        box.focus({ preventScroll: true });
      } catch {
        // Ignore focus errors in WebView.
      }
    }, 30);
  }, []);

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

    focusPlayerSurface();

    return () => {
      document.body.style.overflow = oldBodyOverflow;
      document.body.style.touchAction = oldBodyTouchAction;
      document.documentElement.style.overflow = oldHtmlOverflow;
      document.documentElement.style.overscrollBehavior = oldHtmlOverscroll;
    };
  }, [focusPlayerSurface, tvImmersive]);

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
      }, 620);
    }

    function handleFocusPlayer() {
      focusPlayerSurface();
    }

    function handlePlayerCommand(event: Event) {
      const detail = (event as CustomEvent<PlayerCommandDetail>).detail;

      if (!detail) return;

      window.setTimeout(() => {
        if (detail.handled) return;

        detail.handled = true;
        focusPlayerSurface();

        if (detail.action !== "focus-player") {
          emitNativeMissing();

          if (detail.action === "seek") {
            emitHud({
              type: "seek",
              delta: detail.seconds || 0,
            });
          }
        }
      }, 0);
    }

    window.addEventListener("baoflix-tv-player-hud", handlePlayerHud as EventListener);
    window.addEventListener("baoflix-focus-tv-player", handleFocusPlayer);
    window.addEventListener("baoflix-focus-tv-player-surface", handleFocusPlayer);
    window.addEventListener("baoflix-tv-player-command", handlePlayerCommand as EventListener);

    return () => {
      if (hudTimerRef.current) {
        window.clearTimeout(hudTimerRef.current);
      }

      window.removeEventListener("baoflix-tv-player-hud", handlePlayerHud as EventListener);
      window.removeEventListener("baoflix-focus-tv-player", handleFocusPlayer);
      window.removeEventListener("baoflix-focus-tv-player-surface", handleFocusPlayer);
      window.removeEventListener("baoflix-tv-player-command", handlePlayerCommand as EventListener);
    };
  }, [focusPlayerSurface]);

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
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black/60 px-4 py-2 text-center text-white shadow-xl backdrop-blur">
          <div className="text-xl font-black">
            {playerHud.type === "seek"
              ? `${playerHud.delta && playerHud.delta > 0 ? "+" : ""}${playerHud.delta || 0}s`
              : playerHud.type === "play"
                ? "▶"
                : "Ⅱ"}
          </div>

          {playerHud.type === "seek" && (
            <p className="mt-0.5 text-[11px] text-slate-300">
              {formatTime(playerHud.currentTime)}
              {playerHud.duration ? ` / ${formatTime(playerHud.duration)}` : ""}
            </p>
          )}
        </div>
      )}

      {!tvImmersive && (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute bottom-3 right-3 rounded-full border border-white/15 bg-black/70 px-3 py-2 text-xs font-bold text-white backdrop-blur hover:bg-white/15"
        >
          {expanded ? "Thoát rộng" : "Mở rộng"}
        </button>
      )}
    </div>
  );
}
