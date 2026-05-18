"use client";

import { useEffect, useState } from "react";
import { MovieItem } from "@/lib/kkphim";

const KEY = "baoflix_favorites";

export default function FavoriteButton({ movie }: { movie: MovieItem }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    const list: MovieItem[] = raw ? JSON.parse(raw) : [];
    setSaved(list.some((item) => item.slug === movie.slug));
  }, [movie.slug]);

  function toggleFavorite() {
    const raw = localStorage.getItem(KEY);
    const list: MovieItem[] = raw ? JSON.parse(raw) : [];

    const exists = list.some((item) => item.slug === movie.slug);

    const next = exists
      ? list.filter((item) => item.slug !== movie.slug)
      : [movie, ...list];

    localStorage.setItem(KEY, JSON.stringify(next));
    setSaved(!exists);
  }

  return (
    <button
      onClick={toggleFavorite}
      className={`w-full rounded-2xl px-5 py-3 font-bold ${
        saved
          ? "bg-red-600 hover:bg-red-500"
          : "border border-white/10 bg-white/10 hover:bg-white/15"
      }`}
    >
      {saved ? "Đã lưu yêu thích" : "Lưu vào yêu thích"}
    </button>
  );
}