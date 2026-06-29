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

type OverlayCommandDetail = {
  action: "peek" | "hide" | "open-episodes" | "open-sources" | "close-panel" | "activity";
  focus?: boolean;
};

type PlayerCommandAction = "seek" | "toggle-play" | "play" | "pause" | "focus-player";
type OverlayMode = "hidden" | "peek" | "panel";
type OverlayPanel = "episodes" | "sources" | null;

const AUTO_HIDE_MS = 3400;
const SEEK_SECONDS = 10;

const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:shadow-[0_0_18px_rgba(250,204,21,0.38)]";

const SURFACE_BUTTON_CLASS =
  "rounded-xl border border-white/[0.12] bg-black/[0.48] text-white shadow-xl shadow-black/30 backdrop-blur-md transition hover:bg-white/[0.14]";

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
        handled: false,
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
  }, 60);
}

function focusOverlayDefault() {
  focusElement(
    "[data-tv-overlay='watch'][data-tv-overlay-visible='true'] [data-tv-overlay-default], [data-tv-overlay='watch'][data-tv-overlay-visible='true'] a[href], [data-tv-overlay='watch'][data-tv-overlay-visible='true'] button:not([disabled])"
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
  const [overlayMode, setOverlayModeState] = useState<OverlayMode>("peek");
  const [overlayPanel, setOverlayPanelState] = useState<OverlayPanel>(null);
  const [nativeHintVisible, setNativeHintVisible] = useState(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const nativeHintTimerRef = useRef<number | null>(null);
  const overlayModeRef = useRef<OverlayMode>("peek");
  const overlayPanelRef = useRef<OverlayPanel>(null);

  const currentEpisodes = currentServer?.server_data ?? [];
  const hasMultipleServers = sameEpisodeServerLinks.length > 1;
  const serverName = normalizeServerName(currentServer?.server_name);
  const panelOpen = overlayMode === "panel";
  const overlayVisible = overlayMode !== "hidden";

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

  function setOverlayMode(value: OverlayMode) {
    overlayModeRef.current = value;
    setOverlayModeState(value);
  }

  function setOverlayPanel(value: OverlayPanel) {
    overlayPanelRef.current = value;
    setOverlayPanelState(value);
  }

  function clearHideTimer() {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function hideOverlay({ focusPlayer = true }: { focusPlayer?: boolean } = {}) {
    clearHideTimer();
    setOverlayPanel(null);
    setOverlayMode("hidden");

    if (focusPlayer) {
      focusPlayerSurface();
    }
  }

  function scheduleHide() {
    clearHideTimer();

    hideTimerRef.current = window.setTimeout(() => {
      if (overlayModeRef.current !== "peek" || overlayPanelRef.current) {
        hideTimerRef.current = null;
        return;
      }

      hideOverlay({ focusPlayer: true });
      hideTimerRef.current = null;
    }, AUTO_HIDE_MS);
  }

  function showPeek({ focus = false }: { focus?: boolean } = {}) {
    setOverlayPanel(null);
    setOverlayMode("peek");
    scheduleHide();

    if (focus) {
      focusOverlayDefault();
    }
  }

  function openPanel(panel: Exclude<OverlayPanel, null>) {
    clearHideTimer();
    setOverlayMode("panel");
    setOverlayPanel(panel);
    focusPanelDefault(panel);
  }

  function closePanel({ keepOverlay = true }: { keepOverlay?: boolean } = {}) {
    setOverlayPanel(null);

    if (keepOverlay) {
      showPeek({ focus: true });
    } else {
      hideOverlay({ focusPlayer: true });
    }
  }

  function resetPeekTimer() {
    if (overlayModeRef.current === "peek") {
      scheduleHide();
    }
  }

  function openEpisodePanelFromOverlay() {
    clearHideTimer();
    setOverlayMode("panel");
    window.setTimeout(onOpenEpisodePanel, 0);
  }

  function handleSeek(direction: "backward" | "forward") {
    showPeek({ focus: false });
    dispatchPlayerCommand(
      "seek",
      direction === "forward" ? SEEK_SECONDS : -SEEK_SECONDS
    );
  }

  function handleTogglePlay() {
    showPeek({ focus: false });
    dispatchPlayerCommand("toggle-play");
  }

  function handleFocusPlayer() {
    hideOverlay({ focusPlayer: true });
  }

  useEffect(() => {
    showPeek({ focus: false });

    function handlePointerActivity() {
      if (overlayModeRef.current === "panel") return;
      showPeek({ focus: false });
    }

    function handleWakeOverlay(event: Event) {
      const detail = (event as CustomEvent<ShowOverlayDetail>).detail || {};

      if (detail.pinned) {
        openPanel("episodes");
        return;
      }

      showPeek({ focus: detail.focus !== false });
    }

    function handleOverlayCommand(event: Event) {
      const detail = (event as CustomEvent<OverlayCommandDetail>).detail;

      if (!detail) return;

      if (detail.action === "hide") {
        hideOverlay({ focusPlayer: true });
        return;
      }

      if (detail.action === "peek") {
        showPeek({ focus: Boolean(detail.focus) });
        return;
      }

      if (detail.action === "open-episodes") {
        openPanel("episodes");
        return;
      }

      if (detail.action === "open-sources") {
        openPanel("sources");
        return;
      }

      if (detail.action === "close-panel") {
        closePanel({ keepOverlay: true });
        return;
      }

      if (detail.action === "activity") {
        resetPeekTimer();
      }
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
      }, 1800);
    }

    window.addEventListener("mousemove", handlePointerActivity);
    window.addEventListener("mousedown", handlePointerActivity);
    window.addEventListener("touchstart", handlePointerActivity);
    window.addEventListener("baoflix-show-tv-overlay", handleWakeOverlay as EventListener);
    window.addEventListener("baoflix-hide-tv-overlay", handleHideOverlay);
    window.addEventListener("baoflix-tv-overlay-command", handleOverlayCommand as EventListener);
    window.addEventListener("baoflix-tv-native-missing", handleNativeMissing);

    return () => {
      clearHideTimer();

      if (nativeHintTimerRef.current) {
        window.clearTimeout(nativeHintTimerRef.current);
      }

      window.removeEventListener("mousemove", handlePointerActivity);
      window.removeEventListener("mousedown", handlePointerActivity);
      window.removeEventListener("touchstart", handlePointerActivity);
      window.removeEventListener("baoflix-show-tv-overlay", handleWakeOverlay as EventListener);
      window.removeEventListener("baoflix-hide-tv-overlay", handleHideOverlay);
      window.removeEventListener("baoflix-tv-overlay-command", handleOverlayCommand as EventListener);
      window.removeEventListener("baoflix-tv-native-missing", handleNativeMissing);
    };
  }, []);

  useEffect(() => {
    setOverlayPanel(null);
    showPeek({ focus: false });
  }, [safeEpisodeIndex, currentServer?.server_name]);

  return (
    <div
      ref={overlayRef}
      data-tv-overlay="watch"
      data-tv-overlay-visible={overlayVisible ? "true" : "false"}
      data-tv-overlay-mode={overlayMode}
      data-tv-overlay-panel={overlayPanel || ""}
      className={[
        "pointer-events-none absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-200",
        overlayVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <div className="pointer-events-none bg-gradient-to-b from-black/58 via-black/18 to-transparent px-[4vw] pb-8 pt-[3vh]">
        <div className="max-w-[52vw]">
          <h1 className="line-clamp-1 text-[18px] font-black leading-tight text-white drop-shadow-xl min-[1280px]:text-[21px]">
            {movie.name}
          </h1>

          <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-white/[0.72] drop-shadow min-[1280px]:text-[12px]">
            {compactMeta}
          </p>
        </div>
      </div>

      <div className="pointer-events-none bg-gradient-to-t from-black/[0.74] via-black/[0.30] to-transparent px-[4vw] pb-[3.4vh] pt-12">
        {nativeHintVisible && (
          <div className="pointer-events-none mx-auto mb-2 w-fit rounded-xl border border-yellow-300/[0.30] bg-black/[0.68] px-3 py-2 text-center text-[11px] font-bold text-yellow-100 shadow-xl backdrop-blur">
            Nguồn này là iframe, remote đã chuyển focus vào player.
          </div>
        )}

        {!panelOpen && (
          <div className="mx-auto max-w-[440px] min-[1280px]:max-w-[500px]">
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
                  "flex min-h-[34px] items-center justify-center px-3 text-[12px] font-black min-[1280px]:min-h-[38px] min-[1280px]:text-[13px]",
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
                onClick={handleTogglePlay}
                className={[
                  "flex min-h-[34px] items-center justify-center px-3 text-[12px] font-black min-[1280px]:min-h-[38px] min-[1280px]:text-[13px]",
                  PRIMARY_BUTTON_CLASS,
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                ▶ / Ⅱ
              </button>

              <button
                type="button"
                data-tv-seek="forward"
                {...hiddenFocusProps}
                onClick={() => handleSeek("forward")}
                className={[
                  "flex min-h-[34px] items-center justify-center px-3 text-[12px] font-black min-[1280px]:min-h-[38px] min-[1280px]:text-[13px]",
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
                "mt-2 grid grid-cols-3 gap-2",
                overlayVisible ? "pointer-events-auto" : "pointer-events-none",
              ].join(" ")}
            >
              <button
                type="button"
                {...hiddenFocusProps}
                onClick={() => openPanel("episodes")}
                disabled={!currentEpisodes.length}
                className={[
                  "flex min-h-[32px] items-center justify-center px-3 text-[11px] font-black min-[1280px]:min-h-[36px] min-[1280px]:text-[12px]",
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
                  "flex min-h-[32px] items-center justify-center px-3 text-[11px] font-black min-[1280px]:min-h-[36px] min-[1280px]:text-[12px]",
                  SURFACE_BUTTON_CLASS,
                  !hasMultipleServers ? "opacity-40" : "",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Nguồn
              </button>

              <button
                type="button"
                {...hiddenFocusProps}
                onClick={handleFocusPlayer}
                className={[
                  "flex min-h-[32px] items-center justify-center px-3 text-[11px] font-black min-[1280px]:min-h-[36px] min-[1280px]:text-[12px]",
                  SURFACE_BUTTON_CLASS,
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Player
              </button>
            </div>
          </div>
        )}

        {panelOpen && (
          <div
            data-tv-panel={overlayPanel || undefined}
            className="pointer-events-auto mx-auto max-h-[48vh] w-full max-w-[760px] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#070b12]/[0.92] p-3 shadow-[0_18px_56px_rgba(0,0,0,0.62)] backdrop-blur-xl min-[1280px]:max-w-[840px]"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-yellow-300/90">
                  {overlayPanel === "episodes" ? "Chọn tập" : "Đổi nguồn"}
                </p>

                <h2 className="mt-0.5 line-clamp-1 text-[13px] font-black text-white min-[1280px]:text-[15px]">
                  {episodeName || `Tập ${safeEpisodeIndex + 1}`} • {serverName}
                </h2>
              </div>

              <div data-tv-row className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => openPanel("episodes")}
                  className={[
                    "rounded-xl px-3 py-2 text-[10px] font-black transition min-[1280px]:text-[11px]",
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
                    "rounded-xl px-3 py-2 text-[10px] font-black transition min-[1280px]:text-[11px]",
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
                    "rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black text-white transition hover:bg-white/[0.16] min-[1280px]:text-[11px]",
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
                        ← Tập trước
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="flex min-h-[34px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-center text-[11px] font-black text-white opacity-35"
                      >
                        ← Tập trước
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
                        Tập sau →
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="flex min-h-[34px] items-center justify-center rounded-xl bg-red-600 px-3 text-center text-[11px] font-black text-white opacity-35"
                      >
                        Tập sau →
                      </button>
                    )}
                  </div>
                )}

                <div data-tv-row className="max-h-[33vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-6 gap-2 min-[1280px]:grid-cols-8">
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
                            "relative flex min-h-[32px] items-center justify-center rounded-xl border px-1.5 text-center text-[10px] font-black transition min-[1280px]:min-h-[36px] min-[1280px]:text-[11px]",
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
                  <div data-tv-row className="grid grid-cols-2 gap-2 min-[1280px]:grid-cols-3">
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
                            "flex min-h-[44px] flex-col justify-center rounded-xl border px-3 transition",
                            active
                              ? "border-yellow-300 bg-yellow-300 text-black"
                              : "border-white/10 bg-white/[0.055] text-white hover:bg-white/15",
                            TV_FOCUS_CLASS,
                          ].join(" ")}
                        >
                          <span className="text-[12px] font-black min-[1280px]:text-[13px]">{label}</span>
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
