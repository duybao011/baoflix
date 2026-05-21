"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import HlsPlayer from "@/components/HlsPlayer";
import FullscreenPlayerBox from "@/components/FullscreenPlayerBox";
import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";
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

export default function WatchClient({
  movie,
  servers,
  currentServerIndex,
  currentEpisodeIndex,
}: WatchClientProps) {
  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState<string[]>([]);

  const safeServerIndex =
    Number.isNaN(currentServerIndex) ||
    currentServerIndex < 0 ||
    currentServerIndex >= servers.length
      ? 0
      : currentServerIndex;

  const currentServer = servers[safeServerIndex];
  const episodes = currentServer?.server_data ?? [];

  const safeEpisodeIndex =
    Number.isNaN(currentEpisodeIndex) ||
    currentEpisodeIndex < 0 ||
    currentEpisodeIndex >= episodes.length
      ? 0
      : currentEpisodeIndex;

  const episode = episodes[safeEpisodeIndex];

  const currentWatchedKey = getNormalWatchedKey(
    movie.slug,
    safeServerIndex,
    safeEpisodeIndex
  );

  useEffect(() => {
    const next = saveWatchedEpisode(currentWatchedKey);
    setWatchedEpisodes(next);

    saveNormalWatchHistory({
      movie,
      serverIndex: safeServerIndex,
      episodeIndex: safeEpisodeIndex,
      serverName: currentServer?.server_name,
      episodeName: episode?.name,
    });
  }, [
    currentWatchedKey,
    movie,
    safeServerIndex,
    safeEpisodeIndex,
    currentServer?.server_name,
    episode?.name,
  ]);

  const previousHref =
    safeEpisodeIndex > 0
      ? getEpisodeUrl(movie.slug, safeServerIndex, safeEpisodeIndex - 1)
      : "";

  const nextHref =
    safeEpisodeIndex < episodes.length - 1
      ? getEpisodeUrl(movie.slug, safeServerIndex, safeEpisodeIndex + 1)
      : "";

  const watchTimeKey = `baoflix_watch_time_${movie.slug}_episode_${safeEpisodeIndex}`;

  const sameEpisodeServerLinks = useMemo(() => {
    return servers
      .map((server, index) => {
        const serverEpisode = server.server_data?.[safeEpisodeIndex];

        if (!serverEpisode) return null;

        return {
          server,
          serverIndex: index,
          episode: serverEpisode,
          href: getEpisodeUrl(movie.slug, index, safeEpisodeIndex),
        };
      })
      .filter(Boolean) as {
      server: EpisodeServer;
      serverIndex: number;
      episode: NonNullable<typeof episode>;
      href: string;
    }[];
  }, [servers, safeEpisodeIndex, movie.slug]);

  return (
    <div>
      <Link href={`/phim/${movie.slug}`} className="text-sm text-red-300">
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
          onClick={() => setEpisodePanelOpen(true)}
          className="rounded-2xl bg-red-600 px-5 py-3 font-black hover:bg-red-500"
        >
          Chọn tập
        </button>
      </div>

      {sameEpisodeServerLinks.length > 1 && (
        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 text-lg font-black">Đổi phiên bản</h2>

          <p className="mb-3 text-sm text-slate-400">
            Với iframe/player ngoài, thời gian xem có thể không đồng bộ hoàn
            toàn. Nếu nguồn có m3u8 trực tiếp thì app có thể tự resume.
          </p>

          <div className="flex flex-wrap gap-2">
            {sameEpisodeServerLinks.map((item) => (
              <Link
                key={`${item.serverIndex}-${item.episode.name}`}
                href={item.href}
                className={[
                  "rounded-xl border px-4 py-2 text-sm font-bold",
                  item.serverIndex === safeServerIndex
                    ? "border-yellow-300 bg-yellow-300 text-black"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                ].join(" ")}
              >
                {normalizeServerName(item.server.server_name)}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="baoflix-player-fill mt-5">
        <FullscreenPlayerBox>
          {episode?.link_embed ? (
            <iframe
              src={episode.link_embed}
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              className="h-full w-full"
              title={`${movie.name} - ${episode.name}`}
            />
          ) : episode?.link_m3u8 ? (
            <HlsPlayer
              src={episode.link_m3u8}
              storageKey={watchTimeKey}
              autoResume
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              Tập này chưa có link phát.
            </div>
          )}
        </FullscreenPlayerBox>
      </div>

      <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        {previousHref ? (
          <Link
            href={previousHref}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10"
          >
            ← Tập trước
          </Link>
        ) : (
          <button
            disabled
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold opacity-40"
          >
            ← Tập trước
          </button>
        )}

        <button
          type="button"
          onClick={() => setEpisodePanelOpen(true)}
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10"
        >
          Danh sách tập
        </button>

        {nextHref ? (
          <Link
            href={nextHref}
            className="rounded-2xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500"
          >
            Tập sau →
          </Link>
        ) : (
          <button
            disabled
            className="rounded-2xl bg-red-600 px-5 py-3 font-bold opacity-40"
          >
            Tập sau →
          </button>
        )}
      </section>

      {episodePanelOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6">
          <section className="max-h-[85vh] w-full max-w-6xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b0f19] p-5 shadow-2xl md:rounded-3xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Chọn tập</h2>

                <p className="mt-1 text-sm text-slate-400">
                  Đổi server hoặc chọn tập khác mà không cần quay lại trang chi
                  tiết.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEpisodePanelOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10"
              >
                Đóng
              </button>
            </div>

            <div className="mb-6">
              <h3 className="mb-3 text-lg font-black">Phiên bản</h3>

              <div className="flex flex-wrap gap-2">
                {servers.map((server, serverIndex) => {
                  const hasCurrentEpisode = Boolean(
                    server.server_data?.[safeEpisodeIndex]
                  );

                  return (
                    <Link
                      key={`${server.server_name}-${serverIndex}`}
                      href={getEpisodeUrl(
                        movie.slug,
                        serverIndex,
                        hasCurrentEpisode ? safeEpisodeIndex : 0
                      )}
                      onClick={() => setEpisodePanelOpen(false)}
                      className={[
                        "rounded-xl border px-4 py-2 text-sm font-bold",
                        serverIndex === safeServerIndex
                          ? "border-yellow-300 bg-yellow-300 text-black"
                          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                      ].join(" ")}
                    >
                      {normalizeServerName(server.server_name)}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              {servers.map((server, serverIndex) => {
                const serverEpisodes = server.server_data ?? [];

                return (
                  <div
                    key={`${server.server_name}-${serverIndex}`}
                    className={[
                      "rounded-3xl border p-4",
                      serverIndex === safeServerIndex
                        ? "border-yellow-300/40 bg-yellow-300/5"
                        : "border-white/10 bg-white/[0.03]",
                    ].join(" ")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black">
                          {normalizeServerName(server.server_name)}
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                          {serverEpisodes.length} tập
                        </p>
                      </div>

                      {serverEpisodes.length > 0 && (
                        <Link
                          href={getEpisodeUrl(movie.slug, serverIndex, 0)}
                          onClick={() => setEpisodePanelOpen(false)}
                          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-500"
                        >
                          Xem server này
                        </Link>
                      )}
                    </div>

                    {serverEpisodes.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                        Server này chưa có tập.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                        {serverEpisodes.map((episodeItem, episodeIndex) => {
                          const active =
                            serverIndex === safeServerIndex &&
                            episodeIndex === safeEpisodeIndex;

                          const watchedKey = getNormalWatchedKey(
                            movie.slug,
                            serverIndex,
                            episodeIndex
                          );

                          const watched =
                            watchedEpisodes.includes(watchedKey);

                          return (
                            <Link
                              key={`${serverIndex}-${episodeItem.name}-${episodeIndex}`}
                              href={getEpisodeUrl(
                                movie.slug,
                                serverIndex,
                                episodeIndex
                              )}
                              onClick={() => setEpisodePanelOpen(false)}
                              className={[
                                "rounded-xl border px-3 py-3 text-center text-sm font-bold",
                                active
                                  ? "border-red-500 bg-red-600 text-white"
                                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                              ].join(" ")}
                            >
                              <span className="inline-flex items-center justify-center gap-1">
                                {watched && (
                                  <span className="text-yellow-300">✓</span>
                                )}
                                <span>{episodeItem.name}</span>
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/phim/${movie.slug}`}
                onClick={() => setEpisodePanelOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold hover:bg-white/10"
              >
                Về trang chi tiết
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}