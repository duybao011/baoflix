"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import HlsPlayer from "@/components/HlsPlayer";
import FullscreenPlayerBox from "@/components/FullscreenPlayerBox";
import {
  getCustomMovieBySlugClient,
  StoredCustomMovie,
} from "@/lib/customMoviesClient";
import {
  getCustomWatchedKey,
  saveCustomWatchHistory,
  saveWatchedEpisode,
} from "@/lib/watchStore";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default function CustomMovieWatchPage({ params }: PageProps) {
  const { slug } = use(params);
  const searchParams = useSearchParams();

  const season = Number(searchParams.get("season") || 0);
  const tap = Number(searchParams.get("tap") || 0);

  const [movieData, setMovieData] = useState<StoredCustomMovie | null>(null);
  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState<string[]>([]);

  useEffect(() => {
    setMovieData(getCustomMovieBySlugClient(slug) || null);
  }, [slug]);

  if (!movieData) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        Không tìm thấy phim riêng.
      </div>
    );
  }

  const movie = movieData.movie;
  const seasons = movieData.episodes ?? [];

  const safeSeasonIndex =
    Number.isNaN(season) || season < 0 || season >= seasons.length ? 0 : season;

  const currentSeason = seasons[safeSeasonIndex];
  const episodes = currentSeason?.server_data ?? [];

  const safeIndex =
    Number.isNaN(tap) || tap < 0 || tap >= episodes.length ? 0 : tap;

  const episode = episodes[safeIndex];

  const currentWatchedKey = getCustomWatchedKey(
    movie.slug,
    safeSeasonIndex,
    safeIndex
  );

  useEffect(() => {
    const next = saveWatchedEpisode(currentWatchedKey);
    setWatchedEpisodes(next);

    saveCustomWatchHistory({
      movie,
      seasonIndex: safeSeasonIndex,
      episodeIndex: safeIndex,
      seasonName: currentSeason?.server_name,
      episodeName: episode?.name,
    });
  }, [
    currentWatchedKey,
    movie,
    safeSeasonIndex,
    safeIndex,
    currentSeason?.server_name,
    episode?.name,
  ]);

  const previousHref =
    safeIndex > 0
      ? `/ca-nhan/${movie.slug}/xem?season=${safeSeasonIndex}&tap=${
          safeIndex - 1
        }`
      : "";

  const nextHref =
    safeIndex < episodes.length - 1
      ? `/ca-nhan/${movie.slug}/xem?season=${safeSeasonIndex}&tap=${
          safeIndex + 1
        }`
      : "";

  const watchTimeKey = `baoflix_custom_watch_time_${movie.slug}_season_${safeSeasonIndex}_episode_${safeIndex}`;

  return (
    <div>
      <Link href={`/ca-nhan/${movie.slug}`} className="text-sm text-red-300">
        ← Quay lại chi tiết phim
      </Link>

      <h1 className="mt-4 text-3xl font-black">{movie.name}</h1>

      <p className="mt-1 text-slate-400">
        Đang xem: {episode?.name || "Chưa có tập"}
      </p>

      <span className="mt-1 block text-sm text-yellow-300">
        {currentSeason?.server_name || `Mùa ${safeSeasonIndex + 1}`}
      </span>

      <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-3 text-lg font-black">Chọn mùa</h2>

        <div className="flex flex-wrap gap-2">
          {seasons.map((seasonItem, index) => (
            <Link
              key={`${seasonItem.server_name}-${index}`}
              href={`/ca-nhan/${movie.slug}/xem?season=${index}&tap=0`}
              className={[
                "rounded-xl border px-4 py-2 text-sm font-bold",
                index === safeSeasonIndex
                  ? "border-yellow-300 bg-yellow-300 text-black"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
              ].join(" ")}
            >
              {seasonItem.server_name || `Mùa ${index + 1}`}
            </Link>
          ))}
        </div>
      </section>

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
          <section className="max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b0f19] p-5 shadow-2xl md:rounded-3xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Chọn tập</h2>

                <p className="mt-1 text-sm text-slate-400">
                  Chọn mùa hoặc tập khác mà không cần quay lại trang chi tiết.
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
              <h3 className="mb-3 text-lg font-black">Mùa</h3>

              <div className="flex flex-wrap gap-2">
                {seasons.map((seasonItem, index) => (
                  <Link
                    key={`${seasonItem.server_name}-${index}`}
                    href={`/ca-nhan/${movie.slug}/xem?season=${index}&tap=0`}
                    onClick={() => setEpisodePanelOpen(false)}
                    className={[
                      "rounded-xl border px-4 py-2 text-sm font-bold",
                      index === safeSeasonIndex
                        ? "border-yellow-300 bg-yellow-300 text-black"
                        : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                    ].join(" ")}
                  >
                    {seasonItem.server_name || `Mùa ${index + 1}`}
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {seasons.map((seasonItem, seasonIndex) => {
                const seasonEpisodes = seasonItem.server_data ?? [];

                return (
                  <div
                    key={`${seasonItem.server_name}-${seasonIndex}`}
                    className={[
                      "rounded-3xl border p-4",
                      seasonIndex === safeSeasonIndex
                        ? "border-yellow-300/40 bg-yellow-300/5"
                        : "border-white/10 bg-white/[0.03]",
                    ].join(" ")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black">
                          {seasonItem.server_name || `Mùa ${seasonIndex + 1}`}
                        </h3>

                        <p className="mt-1 text-sm text-slate-400">
                          {seasonEpisodes.length} tập
                        </p>
                      </div>

                      {seasonEpisodes.length > 0 && (
                        <Link
                          href={`/ca-nhan/${movie.slug}/xem?season=${seasonIndex}&tap=0`}
                          onClick={() => setEpisodePanelOpen(false)}
                          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-500"
                        >
                          Xem mùa này
                        </Link>
                      )}
                    </div>

                    {seasonEpisodes.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                        Mùa này chưa có tập.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                        {seasonEpisodes.map((episodeItem, episodeIndex) => {
                          const active =
                            seasonIndex === safeSeasonIndex &&
                            episodeIndex === safeIndex;

                          const watchedKey = getCustomWatchedKey(
                            movie.slug,
                            seasonIndex,
                            episodeIndex
                          );

                          const watched = watchedEpisodes.includes(watchedKey);

                          return (
                            <Link
                              key={`${seasonIndex}-${episodeItem.name}-${episodeIndex}`}
                              href={`/ca-nhan/${movie.slug}/xem?season=${seasonIndex}&tap=${episodeIndex}`}
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
                href={`/ca-nhan/${movie.slug}/quan-ly`}
                onClick={() => setEpisodePanelOpen(false)}
                className="rounded-2xl border border-yellow-300/30 bg-yellow-300/10 px-5 py-3 text-sm font-black text-yellow-200 hover:bg-yellow-300 hover:text-black"
              >
                Quản lý mùa / thêm tập
              </Link>

              <Link
                href={`/ca-nhan/${movie.slug}`}
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