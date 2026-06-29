"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";

type SameEpisodeServerLink = {
  server: EpisodeServer;
  serverIndex: number;
  href: string;
  episodeIndex?: number;
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

type PlayerCommandAction = "seek" | "toggle-play" | "play" | "pause" | "focus-player";
type OverlayPanel = "episodes" | "sources" | null;

const AUTO_HIDE_MS = 3200;
const SEEK_SECONDS = 10;

const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.055] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 focus-visible:ring-offset-4 focus-visible:ring-offset-black focus-visible:shadow-[0_0_34px_rgba(250,204,21,0.42)]";

const SURFACE_BUTTON_CLASS =
  "rounded-2xl border border-white/[0.12] bg-white/[0.09] text-white shadow-2xl shadow-black/30 backdrop-blur-xl transition hover:bg-white/[0.16]";

const PRIMARY_BUTTON_CLASS =
  "rounded-2xl bg-yellow-300 text-black shadow-2xl shadow-yellow-950/20 transition hover:bg-yellow-200";

function normalizeServerName(name?: string) {
  const text = String(name || "").toLowerCase();

  if (text.includes("lồng") || text.includes("long")) return "Lồng tiếng";
  if (text.includes("thuyết") || text.includes("thuyet")) return "Thuyết minh";
  if (text.includes("vietsub") || text.includes("sub")) return "Vietsub";

  return name || "Server";
}

function getEpisodeUrl(movieSlug: string, serverIndex: number, episodeIndex: number) {
  return `/xem/${movieSlug}?server=${serverIndex}&tap=${episodeIndex}`;
}

function getWatchedKey(movieSlug: string, serverIndex: number, episodeIndex: number) {
  return `${movieSlug}|server:${serverIndex}|episode:${episodeIndex}`;
}

function dispatchPlayerCommand(action: PlayerCommandAction, seconds?: number) {
  window.dispatchEvent(
    new CustomEvent("baoflix-tv-player-command", {
      detail: {
        action,
        seconds,
      },
    })
  );
}

function focusElement(selector: string) {
  window.setTimeout(() => {
    const target = document.querySelector<HTMLElement>(selector);

    if (!target) return;

    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, 70);
}

function focusOverlayDefault() {
  focusElement(
    "[data-tv-overlay='watch'] [data-tv-overlay-default], [data-tv-overlay='watch'] a[href], [data-tv-overlay='watch'] button:not([disabled])"
  );
}

function focusPanelDefault(panel: Exclude<OverlayPanel, null>) {
  focusElement(
    `[data-tv-panel-default='${panel}'], [data-tv-panel='${panel}'] a[href], [data-tv-panel='${panel}'] button:not([disabled])`
  );
}

function focusPlayerSurface() {
  dispatchPlayerCommand("focus-player");
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
  const [overlayPinned, setOverlayPinnedState] = useState(false);
  const [overlayPanel, setOverlayPanel] = useState<OverlayPanel>(null);
  const [nativeHintVisible, setNativeHintVisible] = useState(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const nativeHintTimerRef = useRef<number | null>(null);
  const overlayPinnedRef = useRef(false);

  const currentEpisodes = currentServer?.server_data ?? [];
  const hasMultipleEpisodes = currentEpisodes.length > 1;
  const hasMultipleServers = sameEpisodeServerLinks.length > 1;
  const serverName = normalizeServerName(currentServer?.server_name);
  const panelOpen = overlayPanel !== null;

  const episodeItems = useMemo(() => {
    return currentEpisodes.map((episode, episodeIndex) => ({
      episode,
      episodeIndex,
      href: getEpisodeUrl(movie.slug, safeServerIndex, episodeIndex),
    }));
  }, [currentEpisodes, movie.slug, safeServerIndex]);

  const compactMeta = useMemo(() => {
    const parts = [
      episodeName || `Tập ${safeEpisodeIndex + 1}`,
      serverName,
      movie.quality,
      movie.lang,
    ];

    return parts.filter(Boolean).join(" • ");
  }, [episodeName, movie.lang, movie.quality, safeEpisodeIndex, serverName]);

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
    setOverlayPanel(null);
    setOverlayVisible(false);

    if (focusPlayer) {
      focusPlayerSurface();
    }
  }

  function scheduleHide() {
    clearHideTimer();

    if (overlayPinnedRef.current || panelOpen) return;

    hideTimerRef.current = window.setTimeout(() => {
      if (overlayPinnedRef.current || panelOpen) {
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

    if (pinned || !autoHide || panelOpen) {
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

  function openPanel(panel: Exclude<OverlayPanel, null>) {
    setOverlayVisible(true);
    setOverlayPinned(true);
    setOverlayPanel(panel);
    clearHideTimer();
    focusPanelDefault(panel);
  }

  function closePanel({ keepOverlay = true }: { keepOverlay?: boolean } = {}) {
    setOverlayPanel(null);
    setOverlayPinned(false);

    if (keepOverlay) {
      showOverlay({ pinned: false, focus: true, autoHide: true });
    } else {
      hideOverlay({ focusPlayer: true });
    }
  }

  function openEpisodePanelFromOverlay() {
    showOverlay({ pinned: true, focus: false, autoHide: false });
    window.setTimeout(onOpenEpisodePanel, 0);
  }

  function handleSeek(direction: "backward" | "forward") {
    showOverlay({ pinned: false, focus: false, autoHide: true });
    dispatchPlayerCommand(
      "seek",
      direction === "forward" ? SEEK_SECONDS : -SEEK_SECONDS
    );
  }

  function handleFocusPlayer() {
    hideOverlay({ focusPlayer: true });
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

    function handleNativeMissing() {
      setNativeHintVisible(true);

      if (nativeHintTimerRef.current) {
        window.clearTimeout(nativeHintTimerRef.current);
      }

      nativeHintTimerRef.current = window.setTimeout(() => {
        setNativeHintVisible(false);
        nativeHintTimerRef.current = null;
      }, 2200);
    }

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    window.addEventListener("baoflix-show-tv-overlay", handleWakeOverlay as EventListener);
    window.addEventListener("baoflix-hide-tv-overlay", handleHideOverlay);
    window.addEventListener("baoflix-tv-native-missing", handleNativeMissing);

    return () => {
      clearHideTimer();

      if (nativeHintTimerRef.current) {
        window.clearTimeout(nativeHintTimerRef.current);
      }

      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("baoflix-show-tv-overlay", handleWakeOverlay as EventListener);
      window.removeEventListener("baoflix-hide-tv-overlay", handleHideOverlay);
      window.removeEventListener("baoflix-tv-native-missing", handleNativeMissing);
    };
  }, []);

  useEffect(() => {
    setOverlayPanel(null);
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
      <div className="pointer-events-none bg-gradient-to-b from-black/70 via-black/30 to-transparent px-[5vw] pb-12 pt-[4vh]">
        <div className="max-w-[68vw]">
          <h1 className="line-clamp-1 text-[28px] font-black leading-tight text-white drop-shadow-2xl">
            {movie.name}
          </h1>

          <p className="mt-2 line-clamp-1 text-[15px] font-semibold text-white/[0.78] drop-shadow">
            {compactMeta}
          </p>
        </div>
      </div>

      <div className="pointer-events-none bg-gradient-to-t from-black/[0.88] via-black/[0.54] to-transparent px-[5vw] pb-[5vh] pt-20">
        {nativeHintVisible && (
          <div className="pointer-events-none mx-auto mb-4 w-fit rounded-2xl border border-yellow-300/[0.35] bg-black/[0.72] px-5 py-3 text-center text-sm font-bold text-yellow-100 shadow-2xl backdrop-blur-xl">
            Chưa có bridge tua trong APK, đã thử chuyển quyền điều khiển vào player.
          </div>
        )}

        {!panelOpen && (
          <div className="mx-auto max-w-[880px]">
            <div
              data-tv-row
              className={[
                "grid grid-cols-3 gap-4",
                overlayVisible ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
            >
              <button
                type="button"
                data-tv-seek="backward"
                {...hiddenFocusProps}
                onClick={() => handleSeek("backward")}
                className={[
                  "flex min-h-[64px] items-center justify-center px-5 text-[19px] font-black",
                  SURFACE_BUTTON_CLASS,
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                ‹ {SEEK_SECONDS}s
              </button>

              <button
                type="button"
                data-tv-overlay-default
                {...hiddenFocusProps}
                onClick={handleFocusPlayer}
                className={[
                  "flex min-h-[64px] items-center justify-center px-6 text-[19px] font-black",
                  PRIMARY_BUTTON_CLASS,
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                ▶ Player
              </button>

              <button
                type="button"
                data-tv-seek="forward"
                {...hiddenFocusProps}
                onClick={() => handleSeek("forward")}
                className={[
                  "flex min-h-[64px] items-center justify-center px-5 text-[19px] font-black",
                  SURFACE_BUTTON_CLASS,
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                {SEEK_SECONDS}s ›
              </button>
            </div>

            <div
              data-tv-row
              className={[
                "mt-4 grid grid-cols-2 gap-4",
                overlayVisible ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
            >
              <button
                type="button"
                {...hiddenFocusProps}
                onClick={() => openPanel("episodes")}
                disabled={!currentEpisodes.length}
                className={[
                  "flex min-h-[58px] items-center justify-center px-5 text-[17px] font-black",
                  SURFACE_BUTTON_CLASS,
                  !currentEpisodes.length ? "opacity-40" : "",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Chọn tập
              </button>

              <button
                type="button"
                {...hiddenFocusProps}
                onClick={() => openPanel("sources")}
                disabled={!hasMultipleServers}
                className={[
                  "flex min-h-[58px] items-center justify-center px-5 text-[17px] font-black",
                  SURFACE_BUTTON_CLASS,
                  !hasMultipleServers ? "opacity-40" : "",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Đổi nguồn
              </button>
            </div>
          </div>
        )}

        {panelOpen && (
          <div
            data-tv-panel={overlayPanel || undefined}
            className="pointer-events-auto mx-auto max-h-[62vh] w-full max-w-[1160px] overflow-hidden rounded-[30px] border border-white/[0.12] bg-[#090d16]/[0.92] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.68)] backdrop-blur-2xl"
          >
            <div className="mb-5 flex items-center justify-between gap-5">
              <div className="min-w-0">
                <p className="text-[12px] font-black uppercase tracking-[0.22em] text-yellow-300/90">
                  {overlayPanel === "episodes" ? "Chọn tập" : "Đổi nguồn phát"}
                </p>

                <h2 className="mt-1 line-clamp-1 text-[22px] font-black text-white">
                  {episodeName || `Tập ${safeEpisodeIndex + 1}`} • {serverName}
                </h2>
              </div>

              <div data-tv-row className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => openPanel("episodes")}
                  className={[
                    "rounded-2xl px-5 py-3 text-sm font-black transition",
                    overlayPanel === "episodes"
                      ? "bg-yellow-300 text-black"
                      : "bg-white/10 text-white hover:bg-white/[0.16]",
                    TV_FOCUS_CLASS,
                  ].join(" ")}
                >
                  Tập
                </button>

                <button
                  type="button"
                  onClick={() => openPanel("sources")}
                  disabled={!hasMultipleServers}
                  className={[
                    "rounded-2xl px-5 py-3 text-sm font-black transition",
                    overlayPanel === "sources"
                      ? "bg-yellow-300 text-black"
                      : "bg-white/10 text-white hover:bg-white/[0.16]",
                    !hasMultipleServers ? "opacity-40" : "",
                    TV_FOCUS_CLASS,
                  ].join(" ")}
                >
                  Nguồn
                </button>

                <button
                  type="button"
                  onClick={() => closePanel({ keepOverlay: true })}
                  className={[
                    "rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.16]",
                    TV_FOCUS_CLASS,
                  ].join(" ")}
                >
                  Đóng
                </button>
              </div>
            </div>

            {overlayPanel === "episodes" && (
              <div data-tv-panel="episodes">
                {(previousHref || nextHref) && (
                  <div data-tv-row className="mb-4 grid grid-cols-2 gap-3">
                    {previousHref ? (
                      <Link
                        href={previousHref}
                        className={[
                          "flex min-h-[52px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-center text-sm font-black text-white transition hover:bg-white/15",
                          TV_FOCUS_CLASS,
                        ].join(" ")}
                      >
                        ← Tập trước
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="flex min-h-[52px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-sm font-black text-white opacity-35"
                      >
                        ← Tập trước
                      </button>
                    )}

                    {nextHref ? (
                      <Link
                        href={nextHref}
                        className={[
                          "flex min-h-[52px] items-center justify-center rounded-2xl bg-red-600 px-4 text-center text-sm font-black text-white transition hover:bg-red-500",
                          TV_FOCUS_CLASS,
                        ].join(" ")}
                      >
                        Tập sau →
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="flex min-h-[52px] items-center justify-center rounded-2xl bg-red-600 px-4 text-center text-sm font-black text-white opacity-35"
                      >
                        Tập sau →
                      </button>
                    )}
                  </div>
                )}

                <div data-tv-row className="max-h-[38vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-8 gap-3">
                    {episodeItems.map((item) => {
                      const active = item.episodeIndex === safeEpisodeIndex;
                      const watched = watchedEpisodes.includes(
                        getWatchedKey(movie.slug, safeServerIndex, item.episodeIndex)
                      );

                      return (
                        <Link
                          key={`${safeServerIndex}-${item.episode.name}-${item.episodeIndex}`}
                          href={item.href}
                          data-tv-panel-default={active ? "episodes" : undefined}
                          className={[
                            "relative flex min-h-[54px] items-center justify-center rounded-2xl border px-2 text-center text-[13px] font-black transition",
                            active
                              ? "border-yellow-300 bg-yellow-300 text-black"
                              : watched
                                ? "border-white/[0.12] bg-white/[0.14] text-white hover:bg-white/20"
                                : "border-white/10 bg-white/[0.055] text-white hover:bg-white/15",
                            TV_FOCUS_CLASS,
                          ].join(" ")}
                        >
                          <span className="line-clamp-1">
                            {item.episode.name || `Tập ${item.episodeIndex + 1}`}
                          </span>

                          {watched && !active && (
                            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-yellow-300" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {currentEpisodes.length > 64 && (
                  <p className="mt-4 text-center text-xs font-semibold text-white/[0.48]">
                    Dùng phím xuống để xem thêm tập trong danh sách.
                  </p>
                )}
              </div>
            )}

            {overlayPanel === "sources" && (
              <div data-tv-panel="sources">
                {hasMultipleServers ? (
                  <div data-tv-row className="grid grid-cols-3 gap-3">
                    {sameEpisodeServerLinks.map((item) => {
                      const active = item.serverIndex === safeServerIndex;
                      const label = normalizeServerName(item.server.server_name);
                      const targetEpisode =
                        item.episodeIndex !== undefined ? `Tập ${item.episodeIndex + 1}` : "";

                      return (
                        <Link
                          key={`${item.serverIndex}-${item.href}`}
                          href={item.href}
                          data-tv-panel-default={active ? "sources" : undefined}
                          className={[
                            "flex min-h-[76px] flex-col justify-center rounded-2xl border px-5 transition",
                            active
                              ? "border-yellow-300 bg-yellow-300 text-black"
                              : "border-white/10 bg-white/[0.055] text-white hover:bg-white/15",
                            TV_FOCUS_CLASS,
                          ].join(" ")}
                        >
                          <span className="text-[17px] font-black">{label}</span>
                          <span className={["mt-1 text-sm", active ? "text-black/70" : "text-white/[0.52]"].join(" ")}>
                            {targetEpisode || "Nguồn phát"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-6 text-center">
                    <p className="text-lg font-black text-white">Chỉ có một nguồn phát</p>
                    <p className="mt-2 text-sm text-white/[0.55]">
                      Bấm Back hoặc Đóng để quay lại player.
                    </p>
                  </div>
                )}

                <div data-tv-row className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={openEpisodePanelFromOverlay}
                    className={[
                      "flex min-h-[52px] items-center justify-center rounded-2xl bg-white/10 px-5 text-sm font-black text-white transition hover:bg-white/[0.16]",
                      TV_FOCUS_CLASS,
                    ].join(" ")}
                  >
                    Mở bảng đầy đủ
                  </button>

                  <button
                    type="button"
                    onClick={handleFocusPlayer}
                    className={[
                      "flex min-h-[52px] items-center justify-center rounded-2xl bg-yellow-300 px-5 text-sm font-black text-black transition hover:bg-yellow-200",
                      TV_FOCUS_CLASS,
                    ].join(" ")}
                  >
                    Vào player
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!panelOpen && (
          <p className="mt-4 text-center text-[12px] font-semibold text-white/[0.42]">
            ↑/↓ hiện overlay • ←/→ tua • Back ẩn
          </p>
        )}
      </div>
    </div>
  );
}
