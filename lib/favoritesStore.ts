"use client";

import type { MovieItem } from "@/lib/kkphim";

export const FAVORITES_KEY = "baoflix_favorites";
export const FAVORITES_CHANGE_EVENT = "baoflix-favorites-change";

type ChangeDetail = {
  type: "toggle" | "remove" | "replace";
  slug?: string;
};

function notify(detail: ChangeDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FAVORITES_CHANGE_EVENT, { detail }));
}

export function readFavorites(): MovieItem[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is MovieItem => Boolean(item?.slug && item?.name))
      : [];
  } catch {
    return [];
  }
}

export function isFavorite(slug: string) {
  return readFavorites().some((item) => item.slug === slug);
}

export function writeFavorites(movies: MovieItem[], detail: ChangeDetail = { type: "replace" }) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(movies));
  notify(detail);
  return movies;
}

export function toggleFavorite(movie: MovieItem) {
  const movies = readFavorites();
  const exists = movies.some((item) => item.slug === movie.slug);
  const next = exists
    ? movies.filter((item) => item.slug !== movie.slug)
    : [movie, ...movies];
  writeFavorites(next, { type: "toggle", slug: movie.slug });
  return { saved: !exists, movies: next };
}

export function removeFavorite(slug: string) {
  const next = readFavorites().filter((item) => item.slug !== slug);
  writeFavorites(next, { type: "remove", slug });
  return next;
}
