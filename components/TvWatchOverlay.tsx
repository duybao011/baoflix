"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";
import { getNormalWatchedKey } from "@/lib/watchStore";

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

const AUTO_HIDE_MS = 2000;
const EPISODE_WINDOW_SIZE = 12;

function normalizeServerName(name?: string) {
  const text = String(name || "").toLowerCase();

  if (text.includes("lồng") || text.includes("long")) return "Lồng tiếng";
  if (text.includes("thuyết") || text.includes("thuyet")) return "Thuyết minh";
  if (text.includes("vietsub") || text.includes("sub")) return "Vietsub";

  return name || "Server";
}

function getEpisodeUrl(
  movieSlug: string,
  serverIndex: number,
  episodeIndex: number
) {
  return `/xem/${movieSlug}?server=${serverIndex}&tap=${episodeIndex}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
  safeServerIndex,
  safeEpisodeIndex,
  episodeName,
  previousHref,
  nextHref,
  watchedEpisodes,
  sameEpisodeServerLinks,
  onOpenEpisodePanel,
}: TvWatchOverlayProps) {
  const [overlayVisible, setOverlayVisible] = useState(true);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const overlayPinnedRef = useRef(false);

  const currentEpisodes = currentServer?.server_data ?? [];
  const hasMultipleEpisodes = currentEpisodes.length > 1;
  const hasMultipleServers = sameEpisodeServerLinks.length > 1;

  const shouldShowEpisodeStrip = hasMultipleEpisodes;
  const shouldShowFullBottomControls = hasMultipleEpisodes;
  const shouldShowBottomArea =
    hasMultipleServers || shouldShowEpisodeStrip || shouldShowFullBottomControls;

  const episodeWindow = useMemo(() => {
    if (currentEpisodes.length <= EPISODE_WINDOW_SIZE) {
      return {
        start: 0,
        end: currentEpisodes.length,
        items: currentEpisodes.map((episode, index) => ({
          episode,
          episodeIndex: index,
        })),
      };
    }

    const half = Math.floor(EPISODE_WINDOW_SIZE / 2);
    const start = clamp(
      safeEpisodeIndex - half,
      0,
      Math.max(0, currentEpisodes.length - EPISODE_WINDOW_SIZE)
    );
    const end = Math.min(currentEpisodes.length, start + EPISODE_WINDOW_SIZE);

    return {
      start,
      end,
      items: currentEpisodes.slice(start, end).map((episode, offset) => ({
        episode,
        episodeIndex: start + offset,
      })),
    };
  }, [currentEpisodes, safeEpisodeIndex]);

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

  function showOverlayAndFocus() {
    showOverlay({ pinned: false, focus: true, autoHide: false });
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
      // Pause = overlay hiện và giữ nguyên cho tới khi play lại hoặc Back.
      showOverlay({ pinned: true, focus: false, autoHide: false });
    }

    function handlePlayerPlaying() {
      // Play lại = ẩn overlay ngay, không chờ vài giây.
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
  }, [safeServerIndex, safeEpisodeIndex]);

  return (
    <div
      ref={overlayRef}
      data-tv-overlay="watch"
      data-tv-overlay-visible={overlayVisible ? "true" : "false"}
      data-tv-overlay-pinned={overlayPinnedRef.current ? "true" : "false"}
      onFocus={handleOverlayFocusIn}
      onBlur={handleOverlayFocusOut}
      className={[
        "pointer-events-none absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-300",
        overlayVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <div className="pointer-events-none bg-gradient-to-b from-black/85 via-black/45 to-transparent px-4 pb-16 pt-4 md:px-6">
        <div
          data-tv-row
          className={[
            "flex flex-wrap items-center gap-3",
            overlayVisible ? "pointer-events-auto" : "pointer-events-none",
          ].join(" ")}
        >
          <Link
            href={`/phim/${movie.slug}`}
            {...hiddenFocusProps}
            className="rounded-full bg-yellow-300 px-5 py-3 text-sm font-black text-black shadow-xl hover:bg-yellow-200"
          >
            ← Quay lại
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-1 text-2xl font-black text-white md:text-3xl">
              {movie.name}
            </h1>

            <p className="mt-1 line-clamp-1 text-sm font-bold text-slate-300 md:text-base">
              {episodeName || "Đang xem"} • {normalizeServerName(currentServer?.server_name)}
            </p>
          </div>
        </div>
      </div>

      {shouldShowBottomArea && (
        <div className="pointer-events-none bg-gradient-to-t from-black/90 via-black/65 to-transparent px-4 pb-5 pt-20 md:px-6">
          {hasMultipleServers && (
            <section
              className={[
                "mb-4",
                overlayVisible ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
            >
              <h2 className="mb-2 text-base font-black text-white">Phiên bản</h2>

              <div
                data-tv-row
                className="baoflix-tv-overlay-scroll flex gap-2 overflow-x-auto pb-1"
              >
                {sameEpisodeServerLinks.map((item) => {
                  const active = item.serverIndex === safeServerIndex;

                  return (
                    <Link
                      key={`${item.serverIndex}-${item.server.server_name}`}
                      href={item.href}
                      {...hiddenFocusProps}
                      className={[
                        "shrink-0 rounded-full border px-5 py-3 text-sm font-black backdrop-blur",
                        active
                          ? "border-yellow-300 bg-yellow-300 text-black"
                          : "border-white/15 bg-black/45 text-white hover:bg-white/15",
                      ].join(" ")}
                    >
                      {normalizeServerName(item.server.server_name)}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {shouldShowEpisodeStrip && episodeWindow.items.length > 0 && (
            <section
              className={[
                overlayVisible ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-base font-black text-white">Danh sách tập</h2>

                {currentEpisodes.length > EPISODE_WINDOW_SIZE && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-300">
                    {episodeWindow.start + 1}-{episodeWindow.end}/{currentEpisodes.length}
                  </span>
                )}
              </div>

              <div
                data-tv-row
                className="baoflix-tv-overlay-scroll flex gap-2 overflow-x-auto pb-1"
              >
                {episodeWindow.items.map(({ episode, episodeIndex }) => {
                  const active = episodeIndex === safeEpisodeIndex;
                  const watchedKey = getNormalWatchedKey(
                    movie.slug,
                    safeServerIndex,
                    episodeIndex
                  );
                  const watched = watchedEpisodes.includes(watchedKey);

                  return (
                    <Link
                      key={`${episode.name}-${episodeIndex}`}
                      href={getEpisodeUrl(movie.slug, safeServerIndex, episodeIndex)}
                      data-tv-overlay-default={active ? true : undefined}
                      {...hiddenFocusProps}
                      className={[
                        "flex min-w-[110px] shrink-0 items-center justify-center rounded-2xl border px-5 py-3 text-center text-sm font-black backdrop-blur",
                        active
                          ? "border-yellow-300 bg-yellow-300 text-black"
                          : "border-white/15 bg-black/45 text-white hover:bg-white/15",
                      ].join(" ")}
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        {watched && !active && <span className="text-yellow-300">✓</span>}
                        {watched && active && <span>✓</span>}
                        <span>{episode.name}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {shouldShowFullBottomControls && (
            <div
              data-tv-row
              className={[
                "mt-4 grid grid-cols-3 gap-3",
                overlayVisible ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
            >
              {previousHref ? (
                <Link
                  href={previousHref}
                  {...hiddenFocusProps}
                  className="flex min-h-[54px] items-center justify-center rounded-2xl border border-white/15 bg-black/45 px-4 py-3 text-center text-sm font-black text-white backdrop-blur hover:bg-white/15"
                >
                  ← Tập trước
                </Link>
              ) : (
                <button
                  disabled
                  className="flex min-h-[54px] items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center text-sm font-black text-white opacity-35"
                >
                  ← Tập trước
                </button>
              )}

              <button
                type="button"
                {...hiddenFocusProps}
                onClick={onOpenEpisodePanel}
                className="flex min-h-[54px] items-center justify-center rounded-2xl bg-yellow-300 px-4 py-3 text-center text-sm font-black text-black hover:bg-yellow-200"
              >
                Tập / nguồn
              </button>

              {nextHref ? (
                <Link
                  href={nextHref}
                  {...hiddenFocusProps}
                  className="flex min-h-[54px] items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-red-500"
                >
                  Tập sau →
                </Link>
              ) : (
                <button
                  disabled
                  className="flex min-h-[54px] items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-center text-sm font-black text-white opacity-35"
                >
                  Tập sau →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
