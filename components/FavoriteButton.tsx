"use client";

import { useEffect, useState } from "react";
import type { MovieItem } from "@/lib/kkphim";
import {
  FAVORITES_CHANGE_EVENT,
  isFavorite,
  toggleFavorite as toggleFavoriteStore,
} from "@/lib/favoritesStore";

export default function FavoriteButton({ movie }: { movie: MovieItem }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    function refresh() {
      setSaved(isFavorite(movie.slug));
    }

    refresh();
    window.addEventListener(FAVORITES_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener(FAVORITES_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [movie.slug]);

  function toggleFavorite() {
    setSaved(toggleFavoriteStore(movie).saved);
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
