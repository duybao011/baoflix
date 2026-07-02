"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MovieItem } from "@/lib/kkphim";

const FAVORITE_KEY = "baoflix_favorites";
const IMAGE_BASE = "https://phimimg.com";
const PLACEHOLDER_IMAGE = "/placeholder.svg";

function getCardImageUrl(url?: string) {
  const rawUrl = String(url || "").trim();

  if (!rawUrl) return PLACEHOLDER_IMAGE;
  if (
    rawUrl === "/placeholder.png" ||
    rawUrl === "placeholder.png" ||
    rawUrl.endsWith("/placeholder.png")
  ) {
    return PLACEHOLDER_IMAGE;
  }

  if (rawUrl.startsWith("/")) return rawUrl;
  if (rawUrl.startsWith("http")) return rawUrl;

  return `${IMAGE_BASE}/${rawUrl.replace(/^\/+/, "")}`;
}

function readFavorites(): MovieItem[] {
  try {
    const raw = localStorage.getItem(FAVORITE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function MovieCard({
  movie,
  tvDefault = false,
}: {
  movie: MovieItem;
  tvDefault?: boolean;
}) {
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

  function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;

    if (image.src.endsWith(PLACEHOLDER_IMAGE)) return;

    image.src = PLACEHOLDER_IMAGE;
  }

  return (
    <article className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] shadow-md shadow-black/20 transition hover:-translate-y-0.5 hover:bg-white/[0.07] focus-within:border-yellow-300">
      <Link
        href={`/phim/${movie.slug}`}
        data-tv-default={tvDefault ? true : undefined}
        data-tv-focus-key={`movie:${movie.slug}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
        aria-label={`Mở phim ${movie.name}`}
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-slate-900">
          <img
            src={getCardImageUrl(movie.poster_url || movie.thumb_url)}
            alt={movie.name}
            className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.035] group-focus-visible:scale-[1.035]"
            loading="lazy"
            decoding="async"
            onError={handleImageError}
          />

          {movie.episode_current && (
            <div className="absolute left-1.5 top-1.5 max-w-[88%] truncate rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-black">
              {movie.episode_current}
            </div>
          )}

          {movie.lang && (
            <div className="absolute bottom-1.5 left-1.5 max-w-[88%] truncate rounded-md bg-black/72 px-2 py-0.5 text-[10px] font-bold">
              {movie.lang}
            </div>
          )}
        </div>

        <div className="min-h-[52px] space-y-0.5 p-1.5">
          <h3 className="line-clamp-2 text-[11px] font-black leading-tight text-white group-hover:text-red-300 min-[1280px]:text-[12px]">
            {movie.name}
          </h3>

          <p className="line-clamp-1 text-[10px] font-semibold text-slate-400">
            {movie.origin_name || "Đang cập nhật"}
          </p>

          <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500">
            <span>{movie.year || "N/A"}</span>
            <span className="truncate">{movie.quality || "HD"}</span>
          </div>
        </div>
      </Link>

      {/* PC/mobile only: remote TV bỏ qua nút này */}
      <button
        type="button"
        data-tv-skip
        tabIndex={-1}
        onClick={() => setOpen((value) => !value)}
        className="absolute right-1.5 top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-xs font-black text-white backdrop-blur hover:bg-red-600"
        aria-label="Thông tin nhanh"
      >
        ⋯
      </button>

      {/* Overlay này vẫn dùng cho PC/mobile. TV remote sẽ không đi vào các nút bên trong. */}
      <div
        className={[
          "absolute inset-1.5 z-10 flex-col justify-end rounded-xl bg-black/85 p-2.5 backdrop-blur-md transition",
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

        <div className="mb-2.5">
          <h3 className="line-clamp-2 text-[12px] font-black text-white">
            {movie.name}
          </h3>

          <p className="mt-1 line-clamp-1 text-[10px] text-slate-400">
            {movie.origin_name || "Đang cập nhật"}
          </p>

          <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
            {movie.year && (
              <span className="rounded-full bg-white/10 px-2 py-0.5">
                {movie.year}
              </span>
            )}

            {movie.quality && (
              <span className="rounded-full bg-white/10 px-2 py-0.5">
                {movie.quality}
              </span>
            )}

            {movie.lang && (
              <span className="rounded-full bg-white/10 px-2 py-0.5">
                {movie.lang}
              </span>
            )}

            {movie.episode_current && (
              <span className="rounded-full bg-red-600 px-2 py-0.5">
                {movie.episode_current}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Link
            href={`/phim/${movie.slug}`}
            data-tv-skip
            tabIndex={-1}
            className="rounded-lg bg-red-600 px-3 py-2 text-center text-xs font-black hover:bg-red-500"
          >
            Chi tiết
          </Link>

          <Link
            href={`/xem/${movie.slug}?server=0&tap=0`}
            data-tv-skip
            tabIndex={-1}
            className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-center text-xs font-bold hover:bg-white/20"
          >
            Xem ngay
          </Link>

          <button
            type="button"
            data-tv-skip
            tabIndex={-1}
            onClick={toggleFavorite}
            className={[
              "rounded-lg px-3 py-2 text-xs font-bold",
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
