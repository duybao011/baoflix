"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EpisodePickerModal from "@/components/EpisodePickerModal";
import HlsPlayer from "@/components/HlsPlayer";
import FullscreenPlayerBox from "@/components/FullscreenPlayerBox";
import TvWatchOverlay from "@/components/TvWatchOverlay";
import type { Episode, EpisodeServer, MovieDetail } from "@/lib/kkphim";
import {
  getNormalWatchedKey,
  readWatchedEpisodes,
  saveNormalWatchHistory,
  saveWatchedEpisode,
} from "@/lib/watchStore";

type WatchClientProps = {
  movie: MovieDetail;
  servers: EpisodeServer[];
  currentServerIndex: number;
  currentEpisodeIndex: number;
};

type PlayerMode = "embed" | "hls" | "none";

type SameEpisodeServerLink = {
  server: EpisodeServer;
  serverIndex: number;
  episode: Episode;
  episodeIndex: number;
  href: string;
};

function getEpisodeUrl(
  movieSlug: string,
  serverIndex: number,
  episodeIndex: number
) {
  return `/xem/${movieSlug}?server=${serverIndex}&tap=${episodeIndex}`;
}

function normalizeServerName(name?: string) {
  const text = String(name || "").toLowerCase();

  if (text.includes("lồng") || text.includes("long")) return "Lồng tiếng";
  if (text.includes("thuyết") || text.includes("thuyet")) return "Thuyết minh";
  if (text.includes("vietsub") || text.includes("sub")) return "Vietsub";

  return name || "Server";
}

function getUserAgent() {
  if (typeof navigator === "undefined") return "";

  return navigator.userAgent.toLowerCase();
}

function isBaoflixTvShell() {
  return /baoflixtv|baoflix tv|baoflixwebview|baoflix-webview/.test(
    getUserAgent()
  );
}

function isMobileDevice() {
  const userAgent = getUserAgent();

  if (!userAgent) return false;
  if (isBaoflixTvShell()) return false;
  if (/android tv|google tv|smart-tv|smarttv|tizen|webos|appletv|aft|bravia|crkey|shield/.test(userAgent)) {
    return false;
  }

  return /iphone|ipad|ipod|android.+mobile|mobile/.test(userAgent);
}

function detectTvOverlayEnabled() {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const forceTv = searchParams.get("tv") === "1";
    const forceNormal = searchParams.get("tv") === "0";

    if (forceNormal) return false;
    if (forceTv || isBaoflixTvShell()) return true;

    if (isMobileDevice()) {
      sessionStorage.removeItem("baoflix_tv_mode");
      localStorage.removeItem("baoflix_tv_mode");
      return false;
    }

    return sessionStorage.getItem("baoflix_tv_mode") === "1";
  } catch {
    return false;
  }
}

function getFirstPlayableServerIndex(servers: EpisodeServer[]) {
  return servers.findIndex((server) => (server.server_data ?? []).length > 0);
}

function getInitialPlayerMode(episode?: Episode): PlayerMode {
  // Ưu tiên xem được trước: KKPhim thường xem ổn nhất qua link_embed/web player.
  // HLS chỉ dùng khi không có iframe hoặc khi user tự đổi sang HLS để tua bằng app.
  if (episode?.link_embed) return "embed";
  if (episode?.link_m3u8) return "hls";
  return "none";
}

function getPlayerModeLabel(playerMode: PlayerMode, canUseEmbed: boolean) {
  if (playerMode === "hls") return "HLS • tua bằng app";
  if (canUseEmbed) return "Web player • ổn định";
  return "Nguồn phát";
}

export default function WatchClient({
  movie,
  servers,
  currentServerIndex,
  currentEpisodeIndex,
}: WatchClientProps) {
  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState<string[]>([]);
  const [tvOverlayEnabled, setTvOverlayEnabled] = useState(false);

  const firstPlayableServerIndex = useMemo(
    () => getFirstPlayableServerIndex(servers),
    [servers]
  );

  const requestedServerIndex =
    Number.isNaN(currentServerIndex) ||
    currentServerIndex < 0 ||
    currentServerIndex >= servers.length
      ? firstPlayableServerIndex
      : currentServerIndex;

  const requestedEpisodes = servers[requestedServerIndex]?.server_data ?? [];

  const safeServerIndex =
    requestedEpisodes.length > 0
      ? requestedServerIndex
      : firstPlayableServerIndex >= 0
        ? firstPlayableServerIndex
        : 0;

  const currentServer = servers[safeServerIndex];
  const episodes = currentServer?.server_data ?? [];

  const safeEpisodeIndex =
    Number.isNaN(currentEpisodeIndex) ||
    currentEpisodeIndex < 0 ||
    currentEpisodeIndex >= episodes.length
      ? 0
      : currentEpisodeIndex;

  const episode = episodes[safeEpisodeIndex];
  const canUseEmbed = Boolean(episode?.link_embed);
  const canUseHls = Boolean(episode?.link_m3u8);

  const [playerMode, setPlayerMode] = useState<PlayerMode>(() =>
    getInitialPlayerMode(episode)
  );

  useEffect(() => {
    setPlayerMode(getInitialPlayerMode(episode));
  }, [episode?.link_embed, episode?.link_m3u8]);

  useEffect(() => {
    function refreshTvOverlay() {
      setTvOverlayEnabled(detectTvOverlayEnabled());
    }

    refreshTvOverlay();

    window.addEventListener("baoflix-tv-mode-change", refreshTvOverlay);
    window.addEventListener("storage", refreshTvOverlay);
    window.addEventListener("focus", refreshTvOverlay);
    window.addEventListener("resize", refreshTvOverlay);
    window.addEventListener("orientationchange", refreshTvOverlay);

    return () => {
      window.removeEventListener("baoflix-tv-mode-change", refreshTvOverlay);
      window.removeEventListener("storage", refreshTvOverlay);
      window.removeEventListener("focus", refreshTvOverlay);
      window.removeEventListener("resize", refreshTvOverlay);
      window.removeEventListener("orientationchange", refreshTvOverlay);
    };
  }, []);

  useEffect(() => {
    function refreshWatchedEpisodes() {
      setWatchedEpisodes(readWatchedEpisodes());
    }

    refreshWatchedEpisodes();

    window.addEventListener("storage", refreshWatchedEpisodes);
    window.addEventListener("focus", refreshWatchedEpisodes);

    return () => {
      window.removeEventListener("storage", refreshWatchedEpisodes);
      window.removeEventListener("focus", refreshWatchedEpisodes);
    };
  }, []);

  const currentWatchedKey = getNormalWatchedKey(
    movie.slug,
    safeServerIndex,
    safeEpisodeIndex
  );

  useEffect(() => {
    if (!episode) return;

    const next = saveWatchedEpisode(currentWatchedKey);
    setWatchedEpisodes(next);

    saveNormalWatchHistory({
      movie,
      serverIndex: safeServerIndex,
      episodeIndex: safeEpisodeIndex,
      serverName: currentServer?.server_name,
      episodeName: episode.name,
    });
  }, [
    currentWatchedKey,
    movie,
    safeServerIndex,
    safeEpisodeIndex,
    currentServer?.server_name,
    episode,
  ]);

  useEffect(() => {
    if (!episodePanelOpen) return;

    const oldOverflow = document.body.style.overflow;
    const oldTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = oldOverflow;
      document.body.style.touchAction = oldTouchAction;
    };
  }, [episodePanelOpen]);

  useEffect(() => {
    if (!tvOverlayEnabled) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [tvOverlayEnabled, safeServerIndex, safeEpisodeIndex]);

  const previousHref =
    safeEpisodeIndex > 0
      ? getEpisodeUrl(movie.slug, safeServerIndex, safeEpisodeIndex - 1)
      : "";

  const nextHref =
    safeEpisodeIndex < episodes.length - 1
      ? getEpisodeUrl(movie.slug, safeServerIndex, safeEpisodeIndex + 1)
      : "";

  const watchTimeKey = `baoflix_watch_time_${movie.slug}_server_${safeServerIndex}_episode_${safeEpisodeIndex}`;

  const sameEpisodeServerLinks = useMemo(() => {
    return servers
      .map((server, index) => {
        const serverEpisodes = server.server_data ?? [];

        if (!serverEpisodes.length) return null;

        const targetEpisodeIndex = Math.min(
          safeEpisodeIndex,
          Math.max(serverEpisodes.length - 1, 0)
        );
        const serverEpisode = serverEpisodes[targetEpisodeIndex];

        if (!serverEpisode) return null;

        return {
          server,
          serverIndex: index,
          episode: serverEpisode,
          episodeIndex: targetEpisodeIndex,
          href: getEpisodeUrl(movie.slug, index, targetEpisodeIndex),
        };
      })
      .filter(Boolean) as SameEpisodeServerLink[];
  }, [servers, safeEpisodeIndex, movie.slug]);

  function switchPlayerMode(nextMode: "embed" | "hls") {
    if (nextMode === "embed" && !canUseEmbed) return;
    if (nextMode === "hls" && !canUseHls) return;

    setPlayerMode(nextMode);

    window.dispatchEvent(
      new CustomEvent("baoflix-show-tv-overlay", {
        detail: {
          pinned: true,
          focus: false,
        },
      })
    );
  }

  function renderPlayer() {
    if (playerMode === "hls" && episode?.link_m3u8) {
      return (
        <HlsPlayer
          src={episode.link_m3u8}
          storageKey={watchTimeKey}
          autoResume
        />
      );
    }

    if ((playerMode === "embed" || playerMode === "none") && episode?.link_embed) {
      return (
        <iframe
          src={episode.link_embed}
          tabIndex={0}
          data-tv-player="iframe"
          data-tv-skip
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          className="h-full w-full bg-black outline-none"
          title={`${movie.name} - ${episode.name}`}
        />
      );
    }

    if (episode?.link_m3u8) {
      return (
        <HlsPlayer
          src={episode.link_m3u8}
          storageKey={watchTimeKey}
          autoResume
        />
      );
    }

    return (
      <div className="flex h-full w-full items-center justify-center text-slate-400">
        Tập này chưa có link phát. Bấm “Tập / nguồn” để đổi server.
      </div>
    );
  }

  return (
    <div
      data-tv-scope="watch-page"
      data-tv-lock="true"
      data-tv-autofocus="true"
      data-tv-watch-immersive={tvOverlayEnabled ? "true" : "false"}
    >
      <Link
        href={`/phim/${movie.slug}`}
        data-tv-skip
        tabIndex={-1}
        className="text-sm text-red-300"
      >
        ← Quay lại chi tiết phim
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{movie.name}</h1>

          <p className="mt-1 text-slate-400">
            {movie.origin_name || "Đang cập nhật"}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-red-600 px-3 py-1">
              {episode?.name || "Chưa có tập"}
            </span>

            <span className="rounded-full bg-white/10 px-3 py-1">
              {normalizeServerName(currentServer?.server_name)}
            </span>

            <span className="rounded-full bg-white/10 px-3 py-1">
              {getPlayerModeLabel(playerMode, canUseEmbed)}
            </span>

            {sameEpisodeServerLinks.length > 1 && (
              <span className="rounded-full bg-yellow-300 px-3 py-1 font-black text-black">
                {sameEpisodeServerLinks.length} phiên bản
              </span>
            )}

            {movie.quality && (
              <span className="rounded-full bg-white/10 px-3 py-1">
                {movie.quality}
              </span>
            )}

            {movie.lang && (
              <span className="rounded-full bg-white/10 px-3 py-1">
                {movie.lang}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          data-tv-default
          onClick={() => setEpisodePanelOpen(true)}
          className="rounded-2xl bg-red-600 px-5 py-3 font-black hover:bg-red-500 focus-visible:border-yellow-300 focus-visible:bg-yellow-300 focus-visible:text-black"
        >
          Tập / nguồn
        </button>
      </div>

      {canUseEmbed && canUseHls && (
        <div data-tv-row className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => switchPlayerMode("embed")}
            className={[
              "rounded-xl border px-4 py-2 text-sm font-black",
              playerMode === "embed"
                ? "border-yellow-300 bg-yellow-300 text-black"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
            ].join(" ")}
          >
            Web player ổn định
          </button>

          <button
            type="button"
            onClick={() => switchPlayerMode("hls")}
            className={[
              "rounded-xl border px-4 py-2 text-sm font-black",
              playerMode === "hls"
                ? "border-yellow-300 bg-yellow-300 text-black"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
            ].join(" ")}
          >
            HLS tua bằng app
          </button>
        </div>
      )}

      {sameEpisodeServerLinks.length > 1 && (
        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 text-lg font-black">Phiên bản</h2>

          <p className="mb-3 text-sm text-slate-400">
            Hiện tất cả server có tập phù hợp. Server thiếu đúng tập sẽ mở tập gần nhất.
          </p>

          <div data-tv-row className="flex flex-wrap gap-2">
            {sameEpisodeServerLinks.map((item) => (
              <Link
                key={`${item.serverIndex}-${item.episode.name}-${item.episodeIndex}`}
                href={item.href}
                className={[
                  "rounded-xl border px-4 py-2 text-sm font-bold",
                  item.serverIndex === safeServerIndex
                    ? "border-yellow-300 bg-yellow-300 text-black"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 focus-visible:border-yellow-300 focus-visible:bg-yellow-300 focus-visible:text-black",
                ].join(" ")}
              >
                {normalizeServerName(item.server.server_name)}
                <span className="ml-1 opacity-70">• {item.episode.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="baoflix-player-fill mt-5">
        <FullscreenPlayerBox tvImmersive={tvOverlayEnabled}>
          <div className="relative h-full w-full overflow-hidden bg-black">
            {renderPlayer()}

            {tvOverlayEnabled && (
              <TvWatchOverlay
                movie={movie}
                currentServer={currentServer}
                safeServerIndex={safeServerIndex}
                safeEpisodeIndex={safeEpisodeIndex}
                episodeName={episode?.name}
                previousHref={previousHref}
                nextHref={nextHref}
                watchedEpisodes={watchedEpisodes}
                sameEpisodeServerLinks={sameEpisodeServerLinks.map((item) => ({
                  server: item.server,
                  serverIndex: item.serverIndex,
                  href: item.href,
                }))}
                playerMode={playerMode}
                canUseEmbed={canUseEmbed}
                canUseHls={canUseHls}
                onSwitchPlayerMode={switchPlayerMode}
                onOpenEpisodePanel={() => setEpisodePanelOpen(true)}
              />
            )}
          </div>
        </FullscreenPlayerBox>
      </div>

      <section
        className={[
          "mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-3 md:p-4",
          tvOverlayEnabled ? "lg:hidden" : "",
        ].join(" ")}
      >
        <div
          data-tv-row
          className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:items-center md:justify-between md:gap-3"
        >
          {previousHref ? (
            <Link
              href={previousHref}
              className="flex min-h-[56px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-black hover:bg-white/10 md:min-h-[52px] md:px-5"
            >
              ← Tập trước
            </Link>
          ) : (
            <button
              disabled
              className="flex min-h-[56px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-black opacity-40 md:min-h-[52px] md:px-5"
            >
              ← Tập trước
            </button>
          )}

          <button
            type="button"
            onClick={() => setEpisodePanelOpen(true)}
            className="flex min-h-[56px] items-center justify-center rounded-2xl bg-yellow-300 px-3 py-3 text-center text-sm font-black text-black hover:bg-yellow-200 md:min-h-[52px] md:px-5"
          >
            Tập / nguồn
          </button>

          {nextHref ? (
            <Link
              href={nextHref}
              className="flex min-h-[56px] items-center justify-center rounded-2xl bg-red-600 px-3 py-3 text-center text-sm font-black hover:bg-red-500 md:min-h-[52px] md:px-5"
            >
              Tập sau →
            </Link>
          ) : (
            <button
              disabled
              className="flex min-h-[56px] items-center justify-center rounded-2xl bg-red-600 px-3 py-3 text-center text-sm font-black opacity-40 md:min-h-[52px] md:px-5"
            >
              Tập sau →
            </button>
          )}
        </div>

        <p className="mt-3 text-center text-xs text-slate-500 md:hidden">
          Không xem được? Bấm “Tập / nguồn” để đổi tập hoặc server ngay trong trang xem.
        </p>
      </section>

      {episodePanelOpen && (
        <EpisodePickerModal
          movie={movie}
          servers={servers}
          safeServerIndex={safeServerIndex}
          safeEpisodeIndex={safeEpisodeIndex}
          watchedEpisodes={watchedEpisodes}
          onClose={() => setEpisodePanelOpen(false)}
        />
      )}
    </div>
  );
}
