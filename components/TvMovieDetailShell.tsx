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

function getFirstWatchHref(movieSlug: string, servers: EpisodeServer[]) {
  const firstServerIndex = servers.findIndex(
    (server) => (server.server_data ?? []).length > 0
  );

  if (firstServerIndex < 0) return "";

  return `/xem/${movieSlug}?server=${firstServerIndex}&tap=0`;
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

  return `/xem/${movieSlug}?server=${bestServerIndex}&tap=${bestEpisodeIndex}`;
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

  const firstServer = servers.find((server) => (server.server_data ?? []).length > 0);
  const firstEpisodes = firstServer?.server_data ?? [];
  const episodePreview = firstEpisodes.slice(0, 14);

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
        <div className="grid gap-6 rounded-[2rem] border border-white/10 bg-gradient-to-br from-red-600/20 via-white/[0.04] to-yellow-300/10 p-6 lg:grid-cols-[300px_1fr] lg:p-8">
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
            </div>

            <p className="mt-5 line-clamp-4 max-w-4xl text-lg leading-8 text-slate-300">
              {content || "Chưa có mô tả."}
            </p>

            <div data-tv-row className="mt-6 flex flex-wrap gap-3">
              {firstWatchHref && (
                <Link
                  href={firstWatchHref}
                  data-tv-default
                  className="rounded-2xl bg-yellow-300 px-7 py-4 text-lg font-black text-black hover:bg-yellow-200"
                >
                  ▶ Xem ngay
                </Link>
              )}

              {latestEpisodeHref && latestEpisodeHref !== firstWatchHref && (
                <Link
                  href={latestEpisodeHref}
                  className="rounded-2xl bg-red-600 px-7 py-4 text-lg font-black text-white hover:bg-red-500"
                >
                  Tập mới nhất
                </Link>
              )}

              <FavoriteButton movie={movie} />

              <Link
                href="/tv"
                className="rounded-2xl border border-white/10 bg-white/5 px-7 py-4 text-lg font-black text-white hover:bg-white/10"
              >
                Về TV Hub
              </Link>
            </div>
          </div>
        </div>

        <MovieDetailActions movie={movie} servers={servers} />

        {episodePreview.length > 0 && (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-3xl font-black">Tập phim</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {normalizeServerName(firstServer?.server_name)} • Chọn nhanh bằng remote.
                </p>
              </div>

              <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-slate-200">
                {firstEpisodes.length} tập
              </span>
            </div>

            <div data-tv-row className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {episodePreview.map((episode, index) => (
                <Link
                  key={`${episode.name}-${index}`}
                  href={`/xem/${movie.slug}?server=${servers.indexOf(firstServer!)}&tap=${index}`}
                  className="flex min-h-[72px] items-center justify-center rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-center font-black text-white hover:border-yellow-300 hover:bg-white/10"
                >
                  {episode.name}
                </Link>
              ))}
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
