"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import MovieDetailTabs from "@/components/MovieDetailTabs";
import {
  getCustomMovieBySlugClient,
  StoredCustomMovie,
} from "@/lib/customMoviesClient";
import { getImageUrl, getPeopleList, stripHtml } from "@/lib/kkphim";
import {
  getCustomWatchedKey,
  readWatchHistory,
  readWatchedEpisodes,
  type WatchHistoryItem,
} from "@/lib/watchStore";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function InfoPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200">
      {children}
    </span>
  );
}

function countTotalEpisodes(seasons: StoredCustomMovie["episodes"]) {
  return (seasons || []).reduce((total, season) => {
    return total + (season.server_data ?? []).length;
  }, 0);
}

function countWatchedCustomEpisodes(
  movieSlug: string,
  seasons: StoredCustomMovie["episodes"],
  watchedEpisodes: string[]
) {
  let count = 0;

  (seasons || []).forEach((season, seasonIndex) => {
    (season.server_data ?? []).forEach((_, episodeIndex) => {
      const watchedKey = getCustomWatchedKey(
        movieSlug,
        seasonIndex,
        episodeIndex
      );

      if (watchedEpisodes.includes(watchedKey)) count += 1;
    });
  });

  return count;
}

function getFirstCustomHref(movieSlug: string, seasons: StoredCustomMovie["episodes"]) {
  const seasonIndex = seasons.findIndex(
    (season) => (season.server_data ?? []).length > 0
  );

  if (seasonIndex < 0) return "";

  return `/ca-nhan/${movieSlug}/xem?season=${seasonIndex}&tap=0`;
}

function getLatestCustomTarget(seasons: StoredCustomMovie["episodes"]) {
  for (let seasonIndex = seasons.length - 1; seasonIndex >= 0; seasonIndex -= 1) {
    const episodes = seasons[seasonIndex]?.server_data ?? [];

    if (episodes.length > 0) {
      return {
        seasonIndex,
        episodeIndex: episodes.length - 1,
        episode: episodes[episodes.length - 1],
        seasonName: seasons[seasonIndex]?.server_name || `Mùa ${seasonIndex + 1}`,
      };
    }
  }

  return null;
}

function getLatestCustomHref(movieSlug: string, seasons: StoredCustomMovie["episodes"]) {
  const target = getLatestCustomTarget(seasons);
  if (!target) return "";
  return `/ca-nhan/${movieSlug}/xem?season=${target.seasonIndex}&tap=${target.episodeIndex}`;
}

function getWatchStateLabel(watchedCount: number, totalEpisodes: number) {
  if (totalEpisodes <= 0) return "Chưa có tập";
  if (watchedCount <= 0) return "Chưa xem";
  if (watchedCount >= totalEpisodes) return "Đã xem hết";
  return "Đang xem dở";
}

function getContinueHref(item: WatchHistoryItem | null, fallbackHref: string) {
  if (!item) return fallbackHref;
  return item.href || fallbackHref;
}

export default function CustomMovieDetailPage({ params }: PageProps) {
  const { slug } = use(params);

  const [movieData, setMovieData] = useState<StoredCustomMovie | null>(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState<string[]>([]);
  const [historyItem, setHistoryItem] = useState<WatchHistoryItem | null>(null);

  useEffect(() => {
    setMovieData(getCustomMovieBySlugClient(slug) || null);
  }, [slug]);

  useEffect(() => {
    function refresh() {
      setWatchedEpisodes(readWatchedEpisodes());
      setHistoryItem(
        readWatchHistory().find((item) => item.slug === slug && item.isCustom) ||
          null
      );
    }

    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [slug]);

  if (!movieData) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-black">Không tìm thấy phim riêng</h1>

        <p className="mt-2 text-slate-400">
          Phim này có thể nằm trên thiết bị khác, chưa được import vào trình
          duyệt này, hoặc đã bị xóa.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/ca-nhan"
            className="inline-block rounded-2xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500"
          >
            Quay lại phim riêng
          </Link>

          <Link
            href="/ca-nhan/them"
            className="inline-block rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10"
          >
            Import / thêm phim
          </Link>
        </div>
      </div>
    );
  }

  const movie = movieData.movie;
  const seasons = movieData.episodes ?? [];

  const actors = getPeopleList(movie.actor);
  const directors = getPeopleList(movie.director);

  const firstHref = getFirstCustomHref(movie.slug, seasons);
  const latestHref = getLatestCustomHref(movie.slug, seasons);
  const latestTarget = getLatestCustomTarget(seasons);
  const continueHref = getContinueHref(historyItem, firstHref);

  const totalEpisodes = countTotalEpisodes(seasons);
  const watchedCount = countWatchedCustomEpisodes(
    movie.slug,
    seasons,
    watchedEpisodes
  );
  const progressPercent =
    totalEpisodes > 0
      ? Math.min(100, Math.round((watchedCount / totalEpisodes) * 100))
      : 0;

  const latestWatched = latestTarget
    ? watchedEpisodes.includes(
        getCustomWatchedKey(
          movie.slug,
          latestTarget.seasonIndex,
          latestTarget.episodeIndex
        )
      )
    : false;

  const infoTab = (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="mb-4 text-2xl font-black">Thông tin phim</h2>

      <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
        {movie.origin_name && (
          <p>
            <span className="font-bold text-white">Tên gốc:</span>{" "}
            {movie.origin_name}
          </p>
        )}

        {movie.year && (
          <p>
            <span className="font-bold text-white">Năm:</span> {movie.year}
          </p>
        )}

        {movie.episode_current && (
          <p>
            <span className="font-bold text-white">Tập hiện tại:</span>{" "}
            {movie.episode_current}
          </p>
        )}

        {movie.episode_total && (
          <p>
            <span className="font-bold text-white">Tổng tập:</span>{" "}
            {movie.episode_total}
          </p>
        )}

        {movie.quality && (
          <p>
            <span className="font-bold text-white">Chất lượng:</span>{" "}
            {movie.quality}
          </p>
        )}

        {movie.lang && (
          <p>
            <span className="font-bold text-white">Nguồn:</span> {movie.lang}
          </p>
        )}
      </div>

      {movie.country && movie.country.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-black">Quốc gia</h3>

          <div className="flex flex-wrap gap-2">
            {movie.country.map((item) => (
              <InfoPill key={item.slug}>{item.name}</InfoPill>
            ))}
          </div>
        </div>
      )}

      {movie.category && movie.category.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-black">Thể loại</h3>

          <div className="flex flex-wrap gap-2">
            {movie.category.map((item) => (
              <InfoPill key={item.slug}>{item.name}</InfoPill>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-2 font-black">Nội dung</h3>

        <p className="whitespace-pre-line leading-7 text-slate-300">
          {stripHtml(movie.content) || "Chưa có mô tả."}
        </p>
      </div>
    </section>
  );

  const episodesTab = (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Danh sách tập</h2>

          <p className="mt-1 text-sm text-slate-400">
            Có {seasons.length} mùa trong phim riêng này.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {firstHref && (
            <Link
              href={firstHref}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold hover:bg-white/10"
            >
              Tập đầu
            </Link>
          )}

          {latestHref && latestHref !== firstHref && (
            <Link
              href={latestHref}
              className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-500"
            >
              Tập mới nhất
            </Link>
          )}
        </div>
      </div>

      {seasons.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-400">
          Phim này chưa có tập.
        </div>
      ) : (
        <div className="space-y-6">
          {seasons.map((season, seasonIndex) => {
            const episodes = season.server_data ?? [];

            return (
              <div
                key={`${season.server_name}-${seasonIndex}`}
                className="rounded-3xl border border-white/10 bg-black/20 p-4"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black">
                      {season.server_name || `Mùa ${seasonIndex + 1}`}
                    </h3>

                    <p className="mt-1 text-sm text-slate-400">
                      {episodes.length} tập
                    </p>
                  </div>

                  {episodes.length > 0 && (
                    <Link
                      href={`/ca-nhan/${movie.slug}/xem?season=${seasonIndex}&tap=${episodes.length - 1}`}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-500"
                    >
                      Tập mới nhất
                    </Link>
                  )}
                </div>

                {episodes.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                    Mùa này chưa có tập.
                  </div>
                ) : (
                  <div data-tv-row className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                    {episodes.map((episode, episodeIndex) => {
                      const watched = watchedEpisodes.includes(
                        getCustomWatchedKey(movie.slug, seasonIndex, episodeIndex)
                      );

                      return (
                        <Link
                          key={`${seasonIndex}-${episode.name}-${episodeIndex}`}
                          href={`/ca-nhan/${movie.slug}/xem?season=${seasonIndex}&tap=${episodeIndex}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-bold hover:bg-red-600"
                        >
                          <span className="inline-flex items-center justify-center gap-1">
                            {watched && <span className="text-yellow-300">✓</span>}
                            <span>{episode.name}</span>
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
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/ca-nhan/${movie.slug}/quan-ly`}
          className="inline-block rounded-2xl border border-yellow-300/30 bg-yellow-300/10 px-5 py-3 text-sm font-black text-yellow-200 hover:bg-yellow-300 hover:text-black"
        >
          Quản lý mùa / thêm tập
        </Link>

        <Link
          href="/ca-nhan/them"
          className="inline-block rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold hover:bg-white/10"
        >
          + Thêm phim khác
        </Link>
      </div>
    </section>
  );

  const castTab = (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="mb-4 text-2xl font-black">Diễn viên & đạo diễn</h2>

      {actors.length > 0 ? (
        <div>
          <h3 className="mb-3 font-black">Diễn viên</h3>

          <div className="flex flex-wrap gap-2">
            {actors.map((actor) => (
              <span
                key={actor}
                className="rounded-full border border-yellow-300/20 bg-yellow-300/10 px-3 py-1 text-sm text-yellow-200"
              >
                {actor}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-slate-400">Chưa có dữ liệu diễn viên.</p>
      )}

      {directors.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 font-black">Đạo diễn</h3>

          <div className="flex flex-wrap gap-2">
            {directors.map((director) => (
              <span
                key={director}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300"
              >
                {director}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );

  const relatedTab = (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="text-2xl font-black">Liên quan</h2>

      <p className="mt-2 text-slate-400">
        Phim riêng thêm bằng giao diện hiện chưa có gợi ý liên quan. Sau này có
        thể gợi ý theo quốc gia/thể loại giống phim thường.
      </p>
    </section>
  );

  return (
    <div
      data-tv-scope="custom-movie-detail"
      data-tv-lock="true"
      data-tv-autofocus="true"
      className="grid gap-8 lg:grid-cols-[320px_1fr]"
    >
      <aside>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <img
            src={getImageUrl(movie.poster_url || movie.thumb_url)}
            alt={movie.name}
            className="aspect-[2/3] w-full object-cover"
          />
        </div>
      </aside>

      <section>
        <Link href="/ca-nhan" className="text-sm text-red-300 hover:text-red-200">
          ← Quay lại phim riêng
        </Link>

        <p className="mt-5 mb-3 text-sm font-bold uppercase tracking-[0.3em] text-red-400">
          {movie.episode_current || "Phim riêng"}
        </p>

        <h1 className="text-4xl font-black md:text-5xl">{movie.name}</h1>

        {movie.origin_name && (
          <p className="mt-2 text-lg font-bold text-yellow-300">
            {movie.origin_name}
          </p>
        )}

        <div data-tv-row className="mt-5 flex flex-wrap gap-3">
          {continueHref ? (
            <Link
              href={continueHref}
              data-tv-default
              className="rounded-2xl bg-yellow-300 px-6 py-3 font-black text-black hover:bg-yellow-200"
            >
              ▶ Xem tiếp
            </Link>
          ) : firstHref ? (
            <Link
              href={firstHref}
              data-tv-default
              className="rounded-2xl bg-yellow-300 px-6 py-3 font-black text-black hover:bg-yellow-200"
            >
              ▶ Xem ngay
            </Link>
          ) : (
            <button
              disabled
              className="rounded-2xl bg-white/10 px-6 py-3 font-black text-white opacity-50"
            >
              Chưa có tập
            </button>
          )}

          {firstHref && (
            <Link
              href={firstHref}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white hover:bg-white/10"
            >
              Tập đầu
            </Link>
          )}

          {latestHref && latestHref !== firstHref && (
            <Link
              href={latestHref}
              className="rounded-2xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-500"
            >
              Tập mới nhất
            </Link>
          )}
        </div>

        <section className="mt-5 rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
                Trạng thái xem
              </p>

              <h2 className="mt-2 text-xl font-black text-white">
                {getWatchStateLabel(watchedCount, totalEpisodes)}
              </h2>

              <p className="mt-1 text-sm text-slate-300">
                Đã xem {watchedCount}/{totalEpisodes} tập
                {historyItem?.episodeName ? ` • xem tiếp: ${historyItem.episodeName}` : ""}
              </p>
            </div>

            {latestTarget && (
              <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-slate-300">
                {latestWatched ? "✓ Đã xem tập mới nhất" : "Tập mới nhất chưa xem"}
              </span>
            )}
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full rounded-full bg-yellow-300 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {latestTarget && (
            <p className="mt-3 text-xs text-slate-400">
              Tập mới nhất: {latestTarget.seasonName} • {latestTarget.episode.name}
            </p>
          )}
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          {movie.year && <InfoPill>{movie.year}</InfoPill>}
          {movie.quality && <InfoPill>{movie.quality}</InfoPill>}
          {movie.lang && <InfoPill>{movie.lang}</InfoPill>}
        </div>

        <div className="mt-8">
          <MovieDetailTabs
            defaultTab="episodes"
            episodes={episodesTab}
            cast={castTab}
            related={relatedTab}
            info={infoTab}
          />
        </div>
      </section>
    </div>
  );
}
