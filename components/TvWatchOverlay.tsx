"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";

type SameEpisodeServerLink = {
  server: EpisodeServer;
  serverIndex: number;
  href: string;
};

type TvWatchOverlayProps = {
  movie: MovieDetail;
  currentServer?: EpisodeServer;
  safeServerIndex: number;
  safeEpisodeIndex: number;
  episodeName?: string;
  previousHref: string;
  nextHref: string;
  watchedEpisodes: string[];
  sameEpisodeServerLinks: SameEpisodeServerLink[];
  onOpenEpisodePanel: () => void;
};

type ShowOverlayDetail = {
  pinned?: boolean;
  focus?: boolean;
};

const AUTO_HIDE_MS = 2600;
const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

function normalizeServerName(name?: string) {
  const text = String(name || "").toLowerCase();

  if (text.includes("lồng") || text.includes("long")) return "Lồng tiếng";
  if (text.includes("thuyết") || text.includes("thuyet")) return "Thuyết minh";
  if (text.includes("vietsub") || text.includes("sub")) return "Vietsub";

  return name || "Server";
}

function focusOverlayDefault() {
  window.setTimeout(() => {
    const overlay = document.querySelector<HTMLElement>(
      "[data-tv-overlay='watch']"
    );

    if (!overlay) return;

    const target =
      overlay.querySelector<HTMLElement>("[data-tv-overlay-default]") ||
      overlay.querySelector<HTMLElement>("a[href], button:not([disabled])");

    if (!target) return;

    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, 60);
}

function focusPlayerSurface() {
  window.dispatchEvent(new Event("baoflix-focus-tv-player"));
}

export default function TvWatchOverlay({
  movie,
  currentServer,
  safeEpisodeIndex,
  episodeName,
  previousHref,
  nextHref,
  sameEpisodeServerLinks,
  onOpenEpisodePanel,
}: TvWatchOverlayProps) {
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayPinned, setOverlayPinnedState] = useState(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const overlayPinnedRef = useRef(false);

  const currentEpisodes = currentServer?.server_data ?? [];
  const hasMultipleEpisodes = currentEpisodes.length > 1;
  const hasMultipleServers = sameEpisodeServerLinks.length > 1;
  const serverName = normalizeServerName(currentServer?.server_name);

  const compactMeta = useMemo(() => {
    const parts = [
      episodeName || `Tập ${safeEpisodeIndex + 1}`,
      serverName,
    ];

    if (hasMultipleEpisodes) {
      parts.push(`${currentEpisodes.length} tập`);
    }

    if (hasMultipleServers) {
      parts.push(`${sameEpisodeServerLinks.length} phiên bản`);
    }

    return parts.filter(Boolean).join(" • ");
  }, [
    currentEpisodes.length,
    episodeName,
    hasMultipleEpisodes,
    hasMultipleServers,
    safeEpisodeIndex,
    sameEpisodeServerLinks.length,
    serverName,
  ]);

  const hiddenFocusProps = useMemo(() => {
    return overlayVisible
      ? {}
      : {
          tabIndex: -1,
          "aria-hidden": true,
        };
  }, [overlayVisible]);

  function isFocusInsideOverlay() {
    const overlay = overlayRef.current;
    const activeElement = document.activeElement;

    if (!overlay || !(activeElement instanceof HTMLElement)) return false;

    return overlay.contains(activeElement);
  }

  function clearHideTimer() {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function setOverlayPinned(value: boolean) {
    overlayPinnedRef.current = value;
    setOverlayPinnedState(value);
  }

  function hideOverlay({ focusPlayer = true }: { focusPlayer?: boolean } = {}) {
    clearHideTimer();
    setOverlayPinned(false);
    setOverlayVisible(false);

    if (focusPlayer) {
      focusPlayerSurface();
    }
  }

  function scheduleHide() {
    clearHideTimer();

    if (overlayPinnedRef.current) return;

    hideTimerRef.current = window.setTimeout(() => {
      if (overlayPinnedRef.current) {
        hideTimerRef.current = null;
        return;
      }

      if (isFocusInsideOverlay()) {
        hideTimerRef.current = null;
        return;
      }

      hideOverlay({ focusPlayer: true });
      hideTimerRef.current = null;
    }, AUTO_HIDE_MS);
  }

  function showOverlay({
    pinned = false,
    focus = false,
    autoHide = true,
  }: {
    pinned?: boolean;
    focus?: boolean;
    autoHide?: boolean;
  } = {}) {
    setOverlayPinned(pinned);
    setOverlayVisible(true);

    if (focus) {
      focusOverlayDefault();
    }

    if (pinned || !autoHide) {
      clearHideTimer();
    } else {
      scheduleHide();
    }
  }

  function handleOverlayFocusIn() {
    setOverlayVisible(true);
    clearHideTimer();
  }

  function handleOverlayFocusOut() {
    window.setTimeout(() => {
      if (!isFocusInsideOverlay()) scheduleHide();
    }, 0);
  }

  useEffect(() => {
    showOverlay({ pinned: false, focus: false, autoHide: true });

    function handleActivity() {
      if (overlayPinnedRef.current) return;

      if (isFocusInsideOverlay()) {
        setOverlayVisible(true);
        clearHideTimer();
        return;
      }

      showOverlay({ pinned: false, focus: false, autoHide: true });
    }

    function handleWakeOverlay(event: Event) {
      const detail = (event as CustomEvent<ShowOverlayDetail>).detail || {};

      showOverlay({
        pinned: Boolean(detail.pinned),
        focus: detail.focus !== false,
        autoHide: !detail.pinned,
      });
    }

    function handleHideOverlay() {
      hideOverlay({ focusPlayer: true });
    }

    function handlePlayerPaused() {
      showOverlay({ pinned: true, focus: false, autoHide: false });
    }

    function handlePlayerPlaying() {
      hideOverlay({ focusPlayer: true });
    }

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    window.addEventListener("baoflix-show-tv-overlay", handleWakeOverlay as EventListener);
    window.addEventListener("baoflix-hide-tv-overlay", handleHideOverlay);
    window.addEventListener("baoflix-tv-player-paused", handlePlayerPaused);
    window.addEventListener("baoflix-tv-player-playing", handlePlayerPlaying);

    return () => {
      clearHideTimer();
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("baoflix-show-tv-overlay", handleWakeOverlay as EventListener);
      window.removeEventListener("baoflix-hide-tv-overlay", handleHideOverlay);
      window.removeEventListener("baoflix-tv-player-paused", handlePlayerPaused);
      window.removeEventListener("baoflix-tv-player-playing", handlePlayerPlaying);
    };
  }, []);

  useEffect(() => {
    showOverlay({ pinned: false, focus: false, autoHide: true });
  }, [safeEpisodeIndex, currentServer?.server_name]);

  return (
    <div
      ref={overlayRef}
      data-tv-overlay="watch"
      data-tv-overlay-visible={overlayVisible ? "true" : "false"}
      data-tv-overlay-pinned={overlayPinned ? "true" : "false"}
      onFocus={handleOverlayFocusIn}
      onBlur={handleOverlayFocusOut}
      className={[
        "pointer-events-none absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-200",
        overlayVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <div className="pointer-events-none bg-gradient-to-b from-black/55 via-black/20 to-transparent px-4 pb-10 pt-4 md:px-6 md:pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 shadow-xl backdrop-blur-md">
            <p className="mb-1 text-[11px] font-black uppercase tracking-[0.22em] text-yellow-300/90">
              BảoFlix TV
            </p>

            <h1 className="line-clamp-1 max-w-[62vw] text-lg font-black text-white drop-shadow md:text-xl">
              {movie.name}
            </h1>

            <p className="mt-1 line-clamp-1 max-w-[62vw] text-xs font-bold text-slate-200/90 md:text-sm">
              {compactMeta}
            </p>
          </div>

          <div className="hidden rounded-full border border-white/10 bg-black/35 px-3 py-2 text-xs font-bold text-slate-200/85 backdrop-blur-md md:block">
            OK: menu • Back: ẩn
          </div>
        </div>
      </div>

      <div className="pointer-events-none bg-gradient-to-t from-black/65 via-black/30 to-transparent px-4 pb-5 pt-12 md:px-6 md:pb-6">
        <div
          data-tv-row
          className={[
            "mx-auto grid max-w-3xl grid-cols-3 gap-3",
            overlayVisible ? "pointer-events-auto" : "pointer-events-none",
          ].join(" ")}
        >
          {previousHref ? (
            <Link
              href={previousHref}
              {...hiddenFocusProps}
              className={[
                "flex min-h-[46px] items-center justify-center rounded-xl border border-white/15 bg-black/45 px-3 py-2 text-center text-sm font-black text-white shadow-lg backdrop-blur-md transition hover:bg-white/15",
                TV_FOCUS_CLASS,
              ].join(" ")}
            >
              ← Trước
            </Link>
          ) : (
            <button
              disabled
              className="flex min-h-[46px] items-center justify-center rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-center text-sm font-black text-white opacity-35"
            >
              ← Trước
            </button>
          )}

          <button
            type="button"
            data-tv-overlay-default
            {...hiddenFocusProps}
            onClick={onOpenEpisodePanel}
            className={[
              "flex min-h-[46px] items-center justify-center rounded-xl bg-yellow-300 px-3 py-2 text-center text-sm font-black text-black shadow-lg transition hover:bg-yellow-200",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            Tập / nguồn
          </button>

          {nextHref ? (
            <Link
              href={nextHref}
              {...hiddenFocusProps}
              className={[
                "flex min-h-[46px] items-center justify-center rounded-xl bg-red-600 px-3 py-2 text-center text-sm font-black text-white shadow-lg transition hover:bg-red-500",
                TV_FOCUS_CLASS,
              ].join(" ")}
            >
              Sau →
            </Link>
          ) : (
            <button
              disabled
              className="flex min-h-[46px] items-center justify-center rounded-xl bg-red-600 px-3 py-2 text-center text-sm font-black text-white opacity-35"
            >
              Sau →
            </button>
          )}
        </div>

        <p className="mt-3 text-center text-xs font-semibold text-white/55">
          {overlayPinned ? "Đang tạm dừng • OK để chọn tập/nguồn • Back để ẩn" : "Lên/Xuống/OK hiện menu • Trái/Phải tua hoặc điều khiển player"}
        </p>
      </div>
    </div>
  );
}
