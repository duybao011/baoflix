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
  sameEpisodeServerLinks: SameEpisodeServerLink[];
  onOpenEpisodePanel: () => void;
};

const AUTO_HIDE_MS = 3500;

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

export default function TvWatchOverlay({
  movie,
  currentServer,
  safeServerIndex,
  safeEpisodeIndex,
  episodeName,
  previousHref,
  nextHref,
  sameEpisodeServerLinks,
  onOpenEpisodePanel,
}: TvWatchOverlayProps) {
  const [overlayVisible, setOverlayVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  const currentEpisodes = currentServer?.server_data ?? [];

  const hiddenFocusProps = useMemo(() => {
    return overlayVisible
      ? {}
      : {
          tabIndex: -1,
          "aria-hidden": true,
        };
  }, [overlayVisible]);

  function clearHideTimer() {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function scheduleHide() {
    clearHideTimer();

    hideTimerRef.current = window.setTimeout(() => {
      setOverlayVisible(false);
    }, AUTO_HIDE_MS);
  }

  function showOverlay() {
    setOverlayVisible(true);
    scheduleHide();
  }

  useEffect(() => {
    showOverlay();

    function handleActivity() {
      showOverlay();
    }

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    window.addEventListener("keydown", handleActivity);

    return () => {
      clearHideTimer();
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, []);

  useEffect(() => {
    showOverlay();
  }, [safeServerIndex, safeEpisodeIndex]);

  return (
    <div
      className={[
        "pointer-events-none absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-300",
        overlayVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <div className="pointer-events-none bg-gradient-to-b from-black/85 via-black/45 to-transparent px-4 pb-16 pt-4 md:px-6">
        <div
          data-tv-row
          className="pointer-events-auto flex flex-wrap items-center gap-3"
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
              {episodeName || "Đang xem"} •{" "}
              {normalizeServerName(currentServer?.server_name)}
            </p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none bg-gradient-to-t from-black/90 via-black/65 to-transparent px-4 pb-5 pt-20 md:px-6">
        {sameEpisodeServerLinks.length > 1 && (
          <section className="pointer-events-auto mb-4">
            <h2 className="mb-2 text-base font-black text-white">
              Âm thanh / Server
            </h2>

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

        {currentEpisodes.length > 0 && (
          <section className="pointer-events-auto">
            <h2 className="mb-2 text-base font-black text-white">
              Danh sách tập
            </h2>

            <div
              data-tv-row
              className="baoflix-tv-overlay-scroll flex gap-2 overflow-x-auto pb-1"
            >
              {currentEpisodes.map((episode, episodeIndex) => {
                const active = episodeIndex === safeEpisodeIndex;

                return (
                  <Link
                    key={`${episode.name}-${episodeIndex}`}
                    href={getEpisodeUrl(
                      movie.slug,
                      safeServerIndex,
                      episodeIndex
                    )}
                    {...hiddenFocusProps}
                    className={[
                      "flex min-w-[110px] shrink-0 items-center justify-center rounded-2xl border px-5 py-3 text-center text-sm font-black backdrop-blur",
                      active
                        ? "border-yellow-300 bg-yellow-300 text-black"
                        : "border-white/15 bg-black/45 text-white hover:bg-white/15",
                    ].join(" ")}
                  >
                    {episode.name}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <div
          data-tv-row
          className="pointer-events-auto mt-4 grid grid-cols-3 gap-3"
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
            Chọn tập
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
      </div>
    </div>
  );
}