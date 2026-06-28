"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MovieDetailActions from "@/components/MovieDetailActions";
import FavoriteButton from "@/components/FavoriteButton";
import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";
import { getImageUrl } from "@/lib/kkphim";

type TvMovieDetailShellProps = {
  movie: MovieDetail;
  servers: EpisodeServer[];
  content: string;
};

type ServerPreview = {
  server: EpisodeServer;
  serverIndex: number;
  episodes: NonNullable<EpisodeServer["server_data"]>;
};

const TV_SESSION_KEY = "baoflix_tv_mode";

function isTvModeEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);

    if (params.get("tv") === "1") return true;
    if (params.get("tv") === "0") return false;

    return sessionStorage.getItem(TV_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerPreviews(servers: EpisodeServer[]): ServerPreview[] {
  return servers
    .map((server, serverIndex) => ({
      server,
      serverIndex,
      episodes: server.server_data ?? [],
    }))
    .filter((item) => item.episodes.length > 0);
}

function getEpisodeHref(movieSlug: string, serverIndex: number, episodeIndex: number) {
  return `/xem/${movieSlug}?server=${serverIndex}&tap=${episodeIndex}`;
}

function getFirstWatchHref(movieSlug: string, servers: EpisodeServer[]) {
  const firstServer = getServerPreviews(servers)[0];

  if (!firstServer) return "";

  return getEpisodeHref(movieSlug, firstServer.serverIndex, 0);
}

function getLatestEpisodeHref(movieSlug: string, servers: EpisodeServer[]) {
  let bestServerIndex = -1;
  let bestEpisodeIndex = -1;
  let bestEpisodeCount = 0;

  servers.forEach((server, serverIndex) => {
    const episodes = server.server_data ?? [];

    if (episodes.length > bestEpisodeCount) {
      bestServerIndex = serverIndex;
      bestEpisodeIndex = episodes.length - 1;
      bestEpisodeCount = episodes.length;
    }
  });

  if (bestServerIndex < 0 || bestEpisodeIndex < 0) return "";

  return getEpisodeHref(movieSlug, bestServerIndex, bestEpisodeIndex);
}

function normalizeServerName(name?: string) {
  const text = String(name || "").toLowerCase();

  if (text.includes("lồng") || text.includes("long")) return "Lồng tiếng";
  if (text.includes("thuyết") || text.includes("thuyet")) return "Thuyết minh";
  if (text.includes("vietsub") || text.includes("sub")) return "Vietsub";

  return name || "Server";
}

export default function TvMovieDetailShell({
  movie,
  servers,
  content,
}: TvMovieDetailShellProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    function refresh() {
      setEnabled(isTvModeEnabled());
    }

    refresh();

    window.addEventListener("baoflix-tv-mode-change", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("baoflix-tv-mode-change", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const firstWatchHref = useMemo(
    () => getFirstWatchHref(movie.slug, servers),
    [movie.slug, servers]
  );

  const latestEpisodeHref = useMemo(
    () => getLatestEpisodeHref(movie.slug, servers),
    [movie.slug, servers]
  );

  const serverPreviews = useMemo(() => getServerPreviews(servers), [servers]);
  const visibleServerPreviews = serverPreviews.slice(0, 3);
  const totalEpisodeCount = serverPreviews.reduce(
    (total, item) => total + item.episodes.length,
    0
  );

  if (!enabled) return null;

  return (
    <>
      <style>{`
        [data-baoflix-normal-detail='true'] {
          display: none !important;
        }
      `}</style>

      <section
        data-tv-scope="movie-detail-tv"
        data-tv-lock="true"
        data-tv-autofocus="true"
        className="baoflix-tv-page space-y-8"
      >
        <div className="grid gap-6 rounded-[2rem] border border-white/10 bg-gradient-to-br from-red-600/20 via-white/[0.04] to-yellow-300/10 p-6 lg:grid-cols-[270px_1fr] lg:p-8">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/30">
            <img
              src={getImageUrl(movie.poster_url || movie.thumb_url)}
              alt={movie.name}
              className="aspect-[2/3] w-full object-cover"
            />
          </div>

          <div className="flex min-w-0 flex-col justify-center">
            <p className="mb-3 text-sm font-black uppercase tracking-[0.28em] text-red-300">
              BảoFlix TV Detail
            </p>

            <h1 className="text-4xl font-black leading-tight md:text-6xl">
              {movie.name}
            </h1>

            {movie.origin_name && (
              <p className="mt-3 line-clamp-1 text-xl font-bold text-yellow-300">
                {movie.origin_name}
              </p>
            )}

            <div data-tv-row className="mt-5 flex flex-wrap gap-3">
              {movie.year && (
                <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 font-black">
                  {movie.year}
                </span>
              )}

              {movie.quality && (
                <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 font-black">
                  {movie.quality}
                </span>
              )}

              {movie.lang && (
                <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 font-black">
                  {movie.lang}
                </span>
              )}

              {movie.episode_current && (
                <span className="rounded-full bg-red-600 px-4 py-2 font-black">
                  {movie.episode_current}
                </span>
              )}

              {visibleServerPreviews.length > 1 && (
                <span className="rounded-full bg-yellow-300 px-4 py-2 font-black text-black">
                  {visibleServerPreviews.length} phiên bản
                </span>
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
              <h2 className="text-xl font-black text-white">Nội dung phim</h2>

              <p className="mt-3 line-clamp-6 max-w-5xl text-lg leading-8 text-slate-300">
                {content || "Chưa có mô tả."}
              </p>
            </div>

            <div data-tv-row className="mt-6 flex flex-wrap gap-3">
              {firstWatchHref && (
                <Link
                  href={firstWatchHref}
                  data-tv-default
                  className="rounded-2xl bg-yellow-300 px-7 py-4 text-lg font-black text-black hover:bg-yellow-200 focus-visible:scale-[1.03]"
                >
                  ▶ Xem ngay
                </Link>
              )}

              {latestEpisodeHref && latestEpisodeHref !== firstWatchHref && (
                <Link
                  href={latestEpisodeHref}
                  className="rounded-2xl bg-red-600 px-7 py-4 text-lg font-black text-white hover:bg-red-500 focus-visible:scale-[1.03]"
                >
                  Tập mới nhất
                </Link>
              )}

              <FavoriteButton movie={movie} />

              <Link
                href="/tv"
                className="rounded-2xl border border-white/10 bg-white/5 px-7 py-4 text-lg font-black text-white hover:bg-white/10 focus-visible:scale-[1.03]"
              >
                Về TV Hub
              </Link>
            </div>
          </div>
        </div>

        <MovieDetailActions movie={movie} servers={servers} />

        {visibleServerPreviews.length > 0 && (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-3xl font-black">Phiên bản & tập</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Hiện tối đa 3 phiên bản đầu tiên có tập • Tổng {totalEpisodeCount} tập từ các nguồn.
                </p>
              </div>

              <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-slate-200">
                {serverPreviews.length} nguồn có tập
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {visibleServerPreviews.map((item) => {
                const episodePreview = item.episodes.slice(0, 12);
                const latestEpisodeIndex = item.episodes.length - 1;

                return (
                  <article
                    key={`${item.server.server_name}-${item.serverIndex}`}
                    className="rounded-3xl border border-white/10 bg-black/25 p-4"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 text-xl font-black text-white">
                          {normalizeServerName(item.server.server_name)}
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                          {item.episodes.length} tập
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-black">
                        Nguồn {item.serverIndex + 1}
                      </span>
                    </div>

                    <div data-tv-row className="mb-3 grid grid-cols-2 gap-2">
                      <Link
                        href={getEpisodeHref(movie.slug, item.serverIndex, 0)}
                        className="rounded-xl bg-yellow-300 px-3 py-3 text-center text-sm font-black text-black hover:bg-yellow-200 focus-visible:scale-[1.03]"
                      >
                        Tập đầu
                      </Link>

                      <Link
                        href={getEpisodeHref(movie.slug, item.serverIndex, latestEpisodeIndex)}
                        className="rounded-xl bg-red-600 px-3 py-3 text-center text-sm font-black text-white hover:bg-red-500 focus-visible:scale-[1.03]"
                      >
                        Tập mới
                      </Link>
                    </div>

                    <div data-tv-row className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
                      {episodePreview.map((episode, index) => (
                        <Link
                          key={`${item.serverIndex}-${episode.name}-${index}`}
                          href={getEpisodeHref(movie.slug, item.serverIndex, index)}
                          className="flex min-h-[52px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center text-xs font-black text-white hover:border-yellow-300 hover:bg-white/10 focus-visible:scale-[1.03] focus-visible:border-yellow-300 focus-visible:bg-yellow-300 focus-visible:text-black"
                        >
                          {episode.name}
                        </Link>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-3xl font-black">Thông tin nhanh</h2>

          <div className="mt-4 grid gap-3 text-base text-slate-300 md:grid-cols-2">
            {movie.time && (
              <p>
                <span className="font-black text-white">Thời lượng:</span>{" "}
                {movie.time}
              </p>
            )}

            {movie.status && (
              <p>
                <span className="font-black text-white">Trạng thái:</span>{" "}
                {movie.status}
              </p>
            )}

            {movie.country && movie.country.length > 0 && (
              <p>
                <span className="font-black text-white">Quốc gia:</span>{" "}
                {movie.country.map((item) => item.name).join(", ")}
              </p>
            )}

            {movie.category && movie.category.length > 0 && (
              <p>
                <span className="font-black text-white">Thể loại:</span>{" "}
                {movie.category.slice(0, 8).map((item) => item.name).join(", ")}
              </p>
            )}
          </div>
        </section>
      </section>
    </>
  );
}
