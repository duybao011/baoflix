"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

function isTvUserAgent() {
  if (typeof navigator === "undefined") return false;

  return /baoflixtv|baoflix tv|baoflixwebview|baoflix-webview|android tv|google tv|smart-tv|smarttv|tizen|webos|appletv|aft|bravia|crkey|shield|netcast|viera|hisense|vidaa|roku/.test(
    navigator.userAgent.toLowerCase()
  );
}

function isTvModeEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);

    if (params.get("tv") === "1") return true;
    if (params.get("tv") === "0") return false;
    if (isTvUserAgent()) return true;

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

function InfoPill({ children, hot }: { children: React.ReactNode; hot?: boolean }) {
  return (
    <span
      className={[
        "rounded-full px-3 py-1 text-[11px] font-black",
        hot
          ? "bg-yellow-300 text-black"
          : "border border-white/10 bg-black/30 text-slate-200",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function ActionLink({
  href,
  children,
  tone = "soft",
  tvDefault,
}: {
  href: string;
  children: React.ReactNode;
  tone?: "primary" | "red" | "soft";
  tvDefault?: boolean;
}) {
  return (
    <Link
      href={href}
      data-tv-default={tvDefault ? true : undefined}
      className={[
        "rounded-xl px-4 py-2.5 text-sm font-black transition",
        tone === "primary" ? "bg-yellow-300 text-black hover:bg-yellow-200" : "",
        tone === "red" ? "bg-red-600 text-white hover:bg-red-500" : "",
        tone === "soft" ? "border border-white/10 bg-white/5 text-white hover:bg-white/10" : "",
        TV_FOCUS_CLASS,
      ].join(" ")}
    >
      {children}
    </Link>
  );
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
        className="baoflix-tv-page space-y-5"
      >
        <div className="grid gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-red-600/18 via-white/[0.035] to-yellow-300/10 p-4 lg:grid-cols-[170px_1fr] min-[1280px]:grid-cols-[190px_1fr] min-[1280px]:p-5">
          <div className="mx-auto w-[150px] overflow-hidden rounded-2xl border border-white/10 bg-black/30 lg:w-full">
            <img
              src={getImageUrl(movie.poster_url || movie.thumb_url)}
              alt={movie.name}
              className="aspect-[2/3] w-full object-cover"
            />
          </div>

          <div className="flex min-w-0 flex-col justify-center">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-red-300">
              BảoFlix TV Detail
            </p>

            <h1 className="line-clamp-2 text-3xl font-black leading-tight min-[1280px]:text-4xl">
              {movie.name}
            </h1>

            {movie.origin_name && (
              <p className="mt-1.5 line-clamp-1 text-sm font-bold text-yellow-300 min-[1280px]:text-base">
                {movie.origin_name}
              </p>
            )}

            <div data-tv-row className="mt-3 flex flex-wrap gap-1.5">
              {movie.year && <InfoPill>{movie.year}</InfoPill>}
              {movie.quality && <InfoPill>{movie.quality}</InfoPill>}
              {movie.lang && <InfoPill>{movie.lang}</InfoPill>}
              {movie.episode_current && <InfoPill hot>{movie.episode_current}</InfoPill>}
              {visibleServerPreviews.length > 1 && (
                <InfoPill hot>{visibleServerPreviews.length} nguồn</InfoPill>
              )}
            </div>

            <p className="mt-3 line-clamp-3 max-w-5xl text-sm leading-6 text-slate-300">
              {content || "Chưa có mô tả."}
            </p>

            <div data-tv-row className="mt-4 flex flex-wrap gap-2">
              {firstWatchHref && (
                <ActionLink href={firstWatchHref} tone="primary" tvDefault>
                  ▶ Xem ngay
                </ActionLink>
              )}

              {latestEpisodeHref && latestEpisodeHref !== firstWatchHref && (
                <ActionLink href={latestEpisodeHref} tone="red">
                  Tập mới nhất
                </ActionLink>
              )}

              <FavoriteButton movie={movie} />

              <ActionLink href="/tv">Về TV Hub</ActionLink>
            </div>
          </div>
        </div>

        {visibleServerPreviews.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-black min-[1280px]:text-2xl">Phiên bản & tập</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {serverPreviews.length} nguồn có tập • tổng {totalEpisodeCount} tập.
                </p>
              </div>

              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">
                D-pad chọn nhanh
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {visibleServerPreviews.map((item) => {
                const episodePreview = item.episodes.slice(0, 16);
                const latestEpisodeIndex = item.episodes.length - 1;

                return (
                  <article
                    key={`${item.server.server_name}-${item.serverIndex}`}
                    className="rounded-2xl border border-white/10 bg-black/22 p-3"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="line-clamp-1 text-base font-black text-white">
                          {normalizeServerName(item.server.server_name)}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-400">{item.episodes.length} tập</p>
                      </div>

                      <span className="shrink-0 rounded-full bg-yellow-300 px-2.5 py-0.5 text-[10px] font-black text-black">
                        Nguồn {item.serverIndex + 1}
                      </span>
                    </div>

                    <div data-tv-row className="mb-2 grid grid-cols-2 gap-2">
                      <ActionLink href={getEpisodeHref(movie.slug, item.serverIndex, 0)} tone="primary">
                        Tập đầu
                      </ActionLink>
                      <ActionLink href={getEpisodeHref(movie.slug, item.serverIndex, latestEpisodeIndex)} tone="red">
                        Tập mới
                      </ActionLink>
                    </div>

                    <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-4 gap-1.5 min-[1280px]:grid-cols-5">
                      {episodePreview.map((episode, index) => (
                        <Link
                          key={`${item.serverIndex}-${episode.name}-${index}`}
                          href={getEpisodeHref(movie.slug, item.serverIndex, index)}
                          className={[
                            "flex min-h-[32px] items-center justify-center rounded-lg border border-white/10 bg-white/5 px-1.5 text-center text-[10px] font-black text-white hover:border-yellow-300 hover:bg-white/10 min-[1280px]:min-h-[34px] min-[1280px]:text-[11px]",
                            TV_FOCUS_CLASS,
                          ].join(" ")}
                        >
                          <span className="line-clamp-1">{episode.name}</span>
                        </Link>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <h2 className="text-xl font-black">Thông tin nhanh</h2>

          <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
            {movie.time && (
              <p>
                <span className="font-black text-white">Thời lượng:</span> {movie.time}
              </p>
            )}
            {movie.status && (
              <p>
                <span className="font-black text-white">Trạng thái:</span> {movie.status}
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
