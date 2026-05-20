"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import MovieDetailTabs from "@/components/MovieDetailTabs";
import {
  getCustomMovieBySlugClient,
  StoredCustomMovie,
} from "@/lib/customMoviesClient";
import { getImageUrl, getPeopleList, stripHtml } from "@/lib/kkphim";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default function CustomMovieDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const [movieData, setMovieData] = useState<StoredCustomMovie | null>(null);

  useEffect(() => {
    setMovieData(getCustomMovieBySlugClient(slug) || null);
  }, [slug]);

  if (!movieData) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-black">Không tìm thấy phim riêng</h1>

        <p className="mt-2 text-slate-400">
          Phim này có thể nằm trên thiết bị khác hoặc đã bị xóa.
        </p>

        <Link
          href="/ca-nhan"
          className="mt-5 inline-block rounded-2xl bg-red-600 px-5 py-3 font-bold"
        >
          Quay lại phim riêng
        </Link>
      </div>
    );
  }

  const movie = movieData.movie;
  const server = movieData.episodes?.[0];
  const episodes = server?.server_data ?? [];
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
            Nguồn: {server?.server_name || "Nguồn riêng"}
          </p>
        </div>

        {episodes.length > 0 && (
          <Link
            href={`/ca-nhan/${movie.slug}/xem?tap=0`}
            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-500"
          >
            Xem ngay
          </Link>
        )}
      </div>

      {episodes.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-400">
          Phim này chưa có tập.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {episodes.map((episode, index) => (
            <Link
              key={`${episode.name}-${index}`}
              href={`/ca-nhan/${movie.slug}/xem?tap=${index}`}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm hover:bg-red-600"
            >
              {episode.name}
            </Link>
          ))}
        </div>
      )}
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
        <Link href="/ca-nhan" className="text-sm text-red-300 hover:text-red-200">
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