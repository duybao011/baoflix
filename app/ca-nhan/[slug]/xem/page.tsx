"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import HlsPlayer from "@/components/HlsPlayer";
import {
  getCustomMovieBySlugClient,
  StoredCustomMovie,
} from "@/lib/customMoviesClient";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default function CustomMovieWatchPage({ params }: PageProps) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const tap = Number(searchParams.get("tap") || 0);

  const [movieData, setMovieData] = useState<StoredCustomMovie | null>(null);

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
  const episodes = movieData.episodes?.[0]?.server_data ?? [];

  const safeIndex =
    Number.isNaN(tap) || tap < 0 || tap >= episodes.length ? 0 : tap;

  const episode = episodes[safeIndex];

  const previousHref =
    safeIndex > 0 ? `/ca-nhan/${movie.slug}/xem?tap=${safeIndex - 1}` : "";

  const nextHref =
    safeIndex < episodes.length - 1
      ? `/ca-nhan/${movie.slug}/xem?tap=${safeIndex + 1}`
      : "";

  return (
    <div>
      <Link href={`/ca-nhan/${movie.slug}`} className="text-sm text-red-300">
        ← Quay lại chi tiết phim
      </Link>

      <h1 className="mt-4 text-3xl font-black">{movie.name}</h1>

      <p className="mt-1 text-slate-400">
        Đang xem: {episode?.name || "Chưa có tập"}
      </p>

      <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black">
        {episode?.link_embed ? (
          <iframe
            src={episode.link_embed}
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            className="aspect-video w-full"
            title={`${movie.name} - ${episode.name}`}
          />
        ) : episode?.link_m3u8 ? (
          <HlsPlayer src={episode.link_m3u8} />
        ) : (
          <div className="flex aspect-video items-center justify-center text-slate-400">
            Tập này chưa có link phát.
          </div>
        )}
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

        <Link
          href={`/ca-nhan/${movie.slug}`}
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10"
        >
          Danh sách tập
        </Link>

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
    </div>
  );
}