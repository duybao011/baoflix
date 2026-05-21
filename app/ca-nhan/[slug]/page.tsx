"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import MovieDetailTabs from "@/components/MovieDetailTabs";
import {
  getCustomMovieBySlugClient,
  StoredCustomMovie,
} from "@/lib/customMoviesClient";
import { getImageUrl, getPeopleList, stripHtml } from "@/lib/kkphim";
import {
  getCustomWatchedKey,
  readWatchedEpisodes,
} from "@/lib/watchStore";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default function CustomMovieDetailPage({ params }: PageProps) {
  const { slug } = use(params);

  const [movieData, setMovieData] = useState<StoredCustomMovie | null>(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState<string[]>([]);

  useEffect(() => {
    setMovieData(getCustomMovieBySlugClient(slug) || null);
  }, [slug]);

  useEffect(() => {
    setWatchedEpisodes(readWatchedEpisodes());

    function refreshWatchedEpisodes() {
      setWatchedEpisodes(readWatchedEpisodes());
    }

    window.addEventListener("storage", refreshWatchedEpisodes);
    window.addEventListener("focus", refreshWatchedEpisodes);

    return () => {
      window.removeEventListener("storage", refreshWatchedEpisodes);
      window.removeEventListener("focus", refreshWatchedEpisodes);
    };
  }, []);

  if (!movieData) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-black">Không tìm thấy phim riêng</h1>

        <p className="mt-2 text-slate-400">
          Phim này có thể nằm trên thiết bị khác hoặc đã bị xóa.
        </p>

        <Link
          href="/ca-nhan"
          className="mt-5 inline-block rounded-2xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500"
        >
          Quay lại phim riêng
        </Link>
      </div>
    );
  }

  const movie = movieData.movie;
  const seasons = movieData.episodes ?? [];
  const firstSeason = seasons[0];
  const firstEpisodes = firstSeason?.server_data ?? [];

  const actors = getPeopleList(movie.actor);
  const directors = getPeopleList(movie.director);

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

        {movie.status && (
          <p>
            <span className="font-bold text-white">Trạng thái:</span>{" "}
            {movie.status}
          </p>
        )}
      </div>

      {movie.country && movie.country.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-black">Quốc gia</h3>

          <div className="flex flex-wrap gap-2">
            {movie.country.map((item) => (
              <span
                key={item.slug}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300"
              >
                {item.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {movie.category && movie.category.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-black">Thể loại</h3>

          <div className="flex flex-wrap gap-2">
            {movie.category.map((item) => (
              <span
                key={item.slug}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300"
              >
                {item.name}
              </span>
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
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Danh sách tập</h2>

          <p className="mt-1 text-sm text-slate-400">
            Có {seasons.length} mùa trong phim riêng này.
          </p>
        </div>

        {firstEpisodes.length > 0 && (
          <Link
            href={`/ca-nhan/${movie.slug}/xem?season=0&tap=0`}
            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-500"
          >
            Xem ngay
          </Link>
        )}
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
                <div className="mb-4 flex items-center justify-between gap-3">
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
                      href={`/ca-nhan/${movie.slug}/xem?season=${seasonIndex}&tap=0`}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-500"
                    >
                      Xem mùa này
                    </Link>
                  )}
                </div>

                {episodes.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                    Mùa này chưa có tập.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                    {episodes.map((episode, episodeIndex) => {
                      const watched = watchedEpisodes.includes(
                        getCustomWatchedKey(
                          movie.slug,
                          seasonIndex,
                          episodeIndex
                        )
                      );

                      return (
                        <Link
                          key={`${seasonIndex}-${episode.name}-${episodeIndex}`}
                          href={`/ca-nhan/${movie.slug}/xem?season=${seasonIndex}&tap=${episodeIndex}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-bold hover:bg-red-600"
                        >
                          <span className="inline-flex items-center justify-center gap-1">
                            {watched && (
                              <span className="text-yellow-300">✓</span>
                            )}
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
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
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
        <Link
          href="/ca-nhan"
          className="text-sm text-red-300 hover:text-red-200"
        >
          ← Quay lại phim riêng
        </Link>

        <p className="mt-5 mb-3 text-sm font-bold uppercase tracking-[0.3em] text-red-400">
          {movie.episode_current || "Phim riêng"}
        </p>

        <h1 className="text-4xl font-black md:text-5xl">{movie.name}</h1>

        <p className="mt-2 text-lg text-slate-400">{movie.origin_name}</p>

        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          {movie.year && (
            <span className="rounded-full bg-white/10 px-3 py-1">
              {movie.year}
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

          {movie.episode_current && (
            <span className="rounded-full bg-red-600 px-3 py-1">
              {movie.episode_current}
            </span>
          )}
        </div>

        <MovieDetailTabs
          info={infoTab}
          episodes={episodesTab}
          cast={castTab}
          related={relatedTab}
        />
      </section>
    </div>
  );
}