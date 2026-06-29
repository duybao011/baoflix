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

const AUTO_HIDE_MS = 3400;
const SEEK_SECONDS = 10;

// Nhỏ hơn bản trước khoảng 45–55%, nhưng vẫn giữ focus đủ rõ cho TV.
const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:shadow-[0_0_22px_rgba(250,204,21,0.36)]";

const SURFACE_BUTTON_CLASS =
  "rounded-xl border border-white/[0.12] bg-black/[0.46] text-white shadow-xl shadow-black/25 backdrop-blur-md transition hover:bg-white/[0.13]";

const PRIMARY_BUTTON_CLASS =
  "rounded-xl bg-yellow-300 text-black shadow-xl shadow-yellow-950/20 transition hover:bg-yellow-200";

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

function isBackKeyEvent(event: KeyboardEvent) {
  const backKeys = new Set([
    "Escape",
    "Backspace",
    "BrowserBack",
    "GoBack",
    "Back",
    "Cancel",
    "XF86Back",
  ]);
  const backCodes = new Set([4, 8, 27, 461, 10009]);

  return backKeys.has(event.key) || backCodes.has(event.keyCode || event.which || 0);
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
  }, 50);
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
  const [overlayPanel, setOverlayPanelState] = useState<OverlayPanel>(null);
  const [nativeHintVisible, setNativeHintVisible] = useState(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const nativeHintTimerRef = useRef<number | null>(null);
  const overlayVisibleRef = useRef(true);
  const overlayPinnedRef = useRef(false);
  const overlayPanelRef = useRef<OverlayPanel>(null);

  const currentEpisodes = currentServer?.server_data ?? [];
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

  function setOverlayVisibleValue(value: boolean) {
    overlayVisibleRef.current = value;
    setOverlayVisible(value);
  }

  function setOverlayPanelValue(value: OverlayPanel) {
    overlayPanelRef.current = value;
    setOverlayPanelState(value);
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
    setOverlayPanelValue(null);
    setOverlayVisibleValue(false);

    if (focusPlayer) {
      focusPlayerSurface();
    }
  }

  function scheduleHide(delay = AUTO_HIDE_MS) {
    clearHideTimer();

    if (overlayPinnedRef.current || overlayPanelRef.current) return;

    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;

      if (overlayPinnedRef.current || overlayPanelRef.current) return;

      hideOverlay({ focusPlayer: true });
    }, delay);
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
    setOverlayVisibleValue(true);

    if (focus) {
      focusOverlayDefault();
    }

    if (pinned || !autoHide || overlayPanelRef.current) {
      clearHideTimer();
    } else {
      scheduleHide();
    }
  }

  function handleOverlayFocusIn() {
    setOverlayVisibleValue(true);

    // Không giữ overlay mãi chỉ vì focus đang nằm trên button.
    // Đây là lỗi khiến overlay cũ không tự biến mất sau 3–4 giây.
    if (!overlayPinnedRef.current && !overlayPanelRef.current) {
      scheduleHide();
    }
  }

  function handleOverlayFocusOut() {
    if (!overlayPinnedRef.current && !overlayPanelRef.current) {
      scheduleHide();
    }
  }

  function handleOverlayKeyDown() {
    if (!overlayPinnedRef.current && !overlayPanelRef.current) {
      scheduleHide();
    }
  }

  function openPanel(panel: Exclude<OverlayPanel, null>) {
    setOverlayVisibleValue(true);
    setOverlayPinned(true);
    setOverlayPanelValue(panel);
    clearHideTimer();
    focusPanelDefault(panel);
  }

  function closePanel({ keepOverlay = true }: { keepOverlay?: boolean } = {}) {
    setOverlayPanelValue(null);
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
      if (overlayPinnedRef.current || overlayPanelRef.current) return;
      showOverlay({ pinned: false, focus: false, autoHide: true });
    }

    function handleWakeOverlay(event: Event) {
      const detail = (event as CustomEvent<ShowOverlayDetail>).detail || {};

      showOverlay({
        pinned: Boolean(detail.pinned),
        focus: detail.focus === true,
        autoHide: !detail.pinned,
      });
    }

    function handleHideOverlay() {
      hideOverlay({ focusPlayer: true });
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (!overlayVisibleRef.current && !overlayPanelRef.current) return;
      if (!isBackKeyEvent(event)) return;

      event.preventDefault();
      event.stopPropagation();
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
      }, 1700);
    }

    document.addEventListener("keydown", handleDocumentKeyDown, true);
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    window.addEventListener("baoflix-show-tv-overlay", handleWakeOverlay as EventListener);
    window.addEventListener("baoflix-hide-tv-overlay", handleHideOverlay);
    window.addEventListener("baoflix-tv-native-missing", handleNativeMissing);

    return () => {
      clearHideTimer();
      document.removeEventListener("keydown", handleDocumentKeyDown, true);

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
    setOverlayPanelValue(null);
    showOverlay({ pinned: false, focus: false, autoHide: true });
  }, [safeEpisodeIndex, currentServer?.server_name]);

  return (
    <div
      ref={overlayRef}
      data-tv-overlay="watch"
      data-tv-overlay-visible={overlayVisible ? "true" : "false"}
      data-tv-overlay-pinned={overlayPinned ? "true" : "false"}
      data-tv-overlay-panel={overlayPanel || ""}
      onFocus={handleOverlayFocusIn}
      onBlur={handleOverlayFocusOut}
      onKeyDown={handleOverlayKeyDown}
      className={[
        "pointer-events-none absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-200",
        overlayVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <div className="pointer-events-none bg-gradient-to-b from-black/58 via-black/20 to-transparent px-[3vw] pb-7 pt-[2.4vh]">
        <div className="max-w-[52vw]">
          <h1 className="line-clamp-1 text-[18px] font-black leading-tight text-white drop-shadow-xl">
            {movie.name}
          </h1>

          <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-white/[0.74] drop-shadow">
            {compactMeta}
          </p>
        </div>
      </div>

      <div className="pointer-events-none bg-gradient-to-t from-black/[0.76] via-black/[0.36] to-transparent px-[3vw] pb-[3vh] pt-12">
        {nativeHintVisible && (
          <div className="pointer-events-none mx-auto mb-2 w-fit rounded-xl border border-yellow-300/[0.3] bg-black/[0.72] px-3 py-2 text-center text-[11px] font-bold text-yellow-100 shadow-xl backdrop-blur-md">
            Chưa có native bridge tua, đã thử chuyển quyền vào player.
          </div>
        )}

        {!panelOpen && (
          <div className="mx-auto max-w-[460px]">
            <div
              data-tv-row
              className={[
                "grid grid-cols-3 gap-2",
                overlayVisible ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
            >
              <button
                type="button"
                data-tv-seek="backward"
                {...hiddenFocusProps}
                onClick={() => handleSeek("backward")}
                className={[
                  "flex min-h-[38px] items-center justify-center px-3 text-[13px] font-black",
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
                  "flex min-h-[38px] items-center justify-center px-3 text-[13px] font-black",
                  PRIMARY_BUTTON_CLASS,
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Player
              </button>

              <button
                type="button"
                data-tv-seek="forward"
                {...hiddenFocusProps}
                onClick={() => handleSeek("forward")}
                className={[
                  "flex min-h-[38px] items-center justify-center px-3 text-[13px] font-black",
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
                "mt-2 grid grid-cols-2 gap-2",
                overlayVisible ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
            >
              <button
                type="button"
                {...hiddenFocusProps}
                onClick={() => openPanel("episodes")}
                disabled={!currentEpisodes.length}
                className={[
                  "flex min-h-[34px] items-center justify-center px-3 text-[12px] font-black",
                  SURFACE_BUTTON_CLASS,
                  !currentEpisodes.length ? "opacity-40" : "",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Tập
              </button>

              <button
                type="button"
                {...hiddenFocusProps}
                onClick={() => openPanel("sources")}
                disabled={!hasMultipleServers}
                className={[
                  "flex min-h-[34px] items-center justify-center px-3 text-[12px] font-black",
                  SURFACE_BUTTON_CLASS,
                  !hasMultipleServers ? "opacity-40" : "",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Nguồn
              </button>
            </div>
          </div>
        )}

        {panelOpen && (
          <div
            data-tv-panel={overlayPanel || undefined}
            className="pointer-events-auto mx-auto max-h-[48vh] w-full max-w-[760px] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#090d16]/[0.93] p-3 shadow-[0_24px_70px_rgba(0,0,0,0.64)] backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-yellow-300/90">
                  {overlayPanel === "episodes" ? "Chọn tập" : "Đổi nguồn"}
                </p>

                <h2 className="mt-0.5 line-clamp-1 text-[14px] font-black text-white">
                  {episodeName || `Tập ${safeEpisodeIndex + 1}`} • {serverName}
                </h2>
              </div>

              <div data-tv-row className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPanel("episodes")}
                  className={[
                    "rounded-xl px-3 py-2 text-[11px] font-black transition",
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
                    "rounded-xl px-3 py-2 text-[11px] font-black transition",
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
                    "rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black text-white transition hover:bg-white/[0.16]",
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
                  <div data-tv-row className="mb-2 grid grid-cols-2 gap-2">
                    {previousHref ? (
                      <Link
                        href={previousHref}
                        className={[
                          "flex min-h-[34px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] px-3 text-center text-[11px] font-black text-white transition hover:bg-white/15",
                          TV_FOCUS_CLASS,
                        ].join(" ")}
                      >
                        ← Trước
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="flex min-h-[34px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-center text-[11px] font-black text-white opacity-35"
                      >
                        ← Trước
                      </button>
                    )}

                    {nextHref ? (
                      <Link
                        href={nextHref}
                        className={[
                          "flex min-h-[34px] items-center justify-center rounded-xl bg-red-600 px-3 text-center text-[11px] font-black text-white transition hover:bg-red-500",
                          TV_FOCUS_CLASS,
                        ].join(" ")}
                      >
                        Sau →
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="flex min-h-[34px] items-center justify-center rounded-xl bg-red-600 px-3 text-center text-[11px] font-black text-white opacity-35"
                      >
                        Sau →
                      </button>
                    )}
                  </div>
                )}

                <div data-tv-row className="max-h-[32vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-8 gap-2">
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
                            "relative flex min-h-[34px] items-center justify-center rounded-xl border px-1.5 text-center text-[10px] font-black transition",
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
                            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-yellow-300" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {overlayPanel === "sources" && (
              <div data-tv-panel="sources">
                {hasMultipleServers ? (
                  <div data-tv-row className="grid grid-cols-3 gap-2">
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
                            "flex min-h-[48px] flex-col justify-center rounded-xl border px-3 transition",
                            active
                              ? "border-yellow-300 bg-yellow-300 text-black"
                              : "border-white/10 bg-white/[0.055] text-white hover:bg-white/15",
                            TV_FOCUS_CLASS,
                          ].join(" ")}
                        >
                          <span className="text-[12px] font-black">{label}</span>
                          <span className={["mt-0.5 text-[10px]", active ? "text-black/70" : "text-white/[0.52]"].join(" ")}>
                            {targetEpisode || "Nguồn phát"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.055] p-4 text-center">
                    <p className="text-sm font-black text-white">Chỉ có một nguồn phát</p>
                    <p className="mt-1 text-[11px] text-white/[0.55]">
                      Bấm Back hoặc Đóng để quay lại player.
                    </p>
                  </div>
                )}

                <div data-tv-row className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={openEpisodePanelFromOverlay}
                    className={[
                      "flex min-h-[34px] items-center justify-center rounded-xl bg-white/10 px-3 text-[11px] font-black text-white transition hover:bg-white/[0.16]",
                      TV_FOCUS_CLASS,
                    ].join(" ")}
                  >
                    Bảng đầy đủ
                  </button>

                  <button
                    type="button"
                    onClick={handleFocusPlayer}
                    className={[
                      "flex min-h-[34px] items-center justify-center rounded-xl bg-yellow-300 px-3 text-[11px] font-black text-black transition hover:bg-yellow-200",
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
      </div>
    </div>
  );
}
