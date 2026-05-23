"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MovieItem } from "@/lib/kkphim";

const FAVORITE_KEY = "baoflix_favorites";
const IMAGE_BASE = "https://phimimg.com";

function getCardImageUrl(url?: string) {
  if (!url) return "/placeholder.png";
  if (url.startsWith("/")) return url;
  if (url.startsWith("http")) return url;
  return `${IMAGE_BASE}/${url.replace(/^\/+/, "")}`;
}

function readFavorites(): MovieItem[] {
  try {
    const raw = localStorage.getItem(FAVORITE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function MovieCard({ movie }: { movie: MovieItem }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const list = readFavorites();
    setSaved(list.some((item) => item.slug === movie.slug));
  }, [movie.slug]);

  function toggleFavorite() {
    const list = readFavorites();
    const exists = list.some((item) => item.slug === movie.slug);

    const next = exists
      ? list.filter((item) => item.slug !== movie.slug)
      : [movie, ...list];

    localStorage.setItem(FAVORITE_KEY, JSON.stringify(next));
    setSaved(!exists);
  }

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg transition hover:-translate-y-1 hover:bg-white/[0.07] focus-within:border-yellow-300">
      <Link
        href={`/phim/${movie.slug}`}
        className="block"
        aria-label={`Mở phim ${movie.name}`}
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-slate-900">
          <img
            src={getCardImageUrl(movie.poster_url || movie.thumb_url)}
            alt={movie.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />

          {movie.episode_current && (
            <div className="absolute left-2 top-2 rounded-full bg-red-600 px-3 py-1 text-xs font-bold">
              {movie.episode_current}
            </div>
          )}

          {movie.lang && (
            <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-3 py-1 text-xs">
              {movie.lang}
            </div>
          )}
        </div>
      </Link>

      {/* PC/mobile only: remote TV bỏ qua nút này */}
      <button
        type="button"
        data-tv-skip
        tabIndex={-1}
        onClick={() => setOpen((value) => !value)}
        className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-sm font-black text-white backdrop-blur hover:bg-red-600"
        aria-label="Thông tin nhanh"
      >
        ⋯
      </button>

      <div className="space-y-1 p-3">
        <Link href={`/phim/${movie.slug}`}>
          <h3 className="line-clamp-2 text-sm font-bold text-white hover:text-red-300">
            {movie.name}
          </h3>
        </Link>

        <p className="line-clamp-1 text-xs text-slate-400">
          {movie.origin_name || "Đang cập nhật"}
        </p>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{movie.year || "N/A"}</span>
          <span>{movie.quality || "HD"}</span>
        </div>
      </div>

      {/* Overlay này vẫn dùng cho PC/mobile. TV remote sẽ không đi vào các nút bên trong. */}
      <div
        className={[
          "absolute inset-2 z-10 flex-col justify-end rounded-2xl bg-black/85 p-3 backdrop-blur-md transition",
          open ? "flex" : "hidden md:group-hover:flex",
        ].join(" ")}
      >
        <button
          type="button"
          data-tv-skip
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs hover:bg-red-600 md:hidden"
          aria-label="Đóng"
        >
          ×
        </button>

        <div className="mb-3">
          <h3 className="line-clamp-2 text-sm font-black text-white">
            {movie.name}
          </h3>

          <p className="mt-1 line-clamp-1 text-xs text-slate-400">
            {movie.origin_name || "Đang cập nhật"}
          </p>

          <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
            {movie.year && (
              <span className="rounded-full bg-white/10 px-2 py-1">
                {movie.year}
              </span>
            )}

            {movie.quality && (
              <span className="rounded-full bg-white/10 px-2 py-1">
                {movie.quality}
              </span>
            )}

            {movie.lang && (
              <span className="rounded-full bg-white/10 px-2 py-1">
                {movie.lang}
              </span>
            )}

            {movie.episode_current && (
              <span className="rounded-full bg-red-600 px-2 py-1">
                {movie.episode_current}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <Link
            href={`/phim/${movie.slug}`}
            data-tv-skip
            tabIndex={-1}
            className="rounded-xl bg-red-600 px-3 py-2 text-center text-xs font-black hover:bg-red-500"
          >
            Chi tiết
          </Link>

          <Link
            href={`/xem/${movie.slug}?server=0&tap=0`}
            data-tv-skip
            tabIndex={-1}
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-center text-xs font-bold hover:bg-white/20"
          >
            Xem ngay
          </Link>

          <button
            type="button"
            data-tv-skip
            tabIndex={-1}
            onClick={toggleFavorite}
            className={[
              "rounded-xl px-3 py-2 text-xs font-bold",
              saved
                ? "bg-yellow-300 text-black hover:bg-yellow-200"
                : "border border-white/10 bg-white/10 text-white hover:bg-white/20",
            ].join(" ")}
          >
            {saved ? "Đã lưu" : "Lưu yêu thích"}
          </button>
        </div>
      </div>
    </article>
  );
}