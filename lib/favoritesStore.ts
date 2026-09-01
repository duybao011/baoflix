"use client";

import type { MovieItem } from "@/lib/kkphim";

export const FAVORITES_KEY = "baoflix_favorites";
export const FAVORITES_CHANGE_EVENT = "baoflix-favorites-change";

// BAOFLIX_PERF_PHASE2A_FAVORITES_CACHE
// Một cache + một bộ listener toàn cục dùng chung cho mọi MovieCard.
// Tránh mỗi card tự parse cùng một localStorage và tự gắn focus/storage listener.
type ChangeDetail = {
  type: "toggle" | "remove" | "replace";
  slug?: string;
};

type FavoriteSubscriber = () => void;

let cachedRaw: string | null | undefined;
let cachedMovies: MovieItem[] = [];
let cachedSlugs = new Set<string>();
const subscribers = new Set<FavoriteSubscriber>();
let globalListenersAttached = false;

function parseFavorites(raw: string | null): MovieItem[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is MovieItem =>
            Boolean(item?.slug && item?.name)
        )
      : [];
  } catch {
    return [];
  }
}

function updateCache(raw: string | null) {
  if (cachedRaw === raw) return false;

  cachedRaw = raw;
  cachedMovies = parseFavorites(raw);
  cachedSlugs = new Set(
    cachedMovies.map((movie) => movie.slug)
  );

  return true;
}

function ensureCache() {
  if (cachedRaw !== undefined) return;
  if (typeof window === "undefined") return;

  updateCache(localStorage.getItem(FAVORITES_KEY));
}

function refreshCacheFromStorage() {
  if (typeof window === "undefined") return false;
  return updateCache(localStorage.getItem(FAVORITES_KEY));
}

function emitSubscribers() {
  subscribers.forEach((subscriber) => {
    try {
      subscriber();
    } catch {
      // Một card lỗi không được làm ngắt cập nhật các card khác.
    }
  });
}

function handleStorage(event: StorageEvent) {
  if (
    event.key !== null &&
    event.key !== FAVORITES_KEY
  ) {
    return;
  }

  const changed =
    event.key === FAVORITES_KEY
      ? updateCache(event.newValue)
      : refreshCacheFromStorage();

  if (changed) emitSubscribers();
}

function handleFocus() {
  if (refreshCacheFromStorage()) {
    emitSubscribers();
  }
}

function handleLegacyFavoriteChange() {
  // Tương thích code cũ có thể tự ghi localStorage rồi phát event.
  if (refreshCacheFromStorage()) {
    emitSubscribers();
  }
}

function attachGlobalListeners() {
  if (
    globalListenersAttached ||
    typeof window === "undefined"
  ) {
    return;
  }

  globalListenersAttached = true;
  window.addEventListener("storage", handleStorage);
  window.addEventListener("focus", handleFocus);
  window.addEventListener(
    FAVORITES_CHANGE_EVENT,
    handleLegacyFavoriteChange
  );
}

function detachGlobalListeners() {
  if (
    !globalListenersAttached ||
    typeof window === "undefined"
  ) {
    return;
  }

  globalListenersAttached = false;
  window.removeEventListener("storage", handleStorage);
  window.removeEventListener("focus", handleFocus);
  window.removeEventListener(
    FAVORITES_CHANGE_EVENT,
    handleLegacyFavoriteChange
  );
}

function notify(detail: ChangeDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(FAVORITES_CHANGE_EVENT, { detail })
  );
}

export function subscribeFavorites(
  subscriber: FavoriteSubscriber
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  // Đọc localStorage đúng một lần trước khi card đầu tiên subscribe.
  ensureCache();

  subscribers.add(subscriber);
  if (subscribers.size === 1) {
    attachGlobalListeners();
  }

  return () => {
    subscribers.delete(subscriber);

    if (subscribers.size === 0) {
      detachGlobalListeners();
    }
  };
}

export function readFavorites(): MovieItem[] {
  // Các màn hình không subscribe vẫn nhận dữ liệu mới nhất khi chủ động đọc.
  refreshCacheFromStorage();
  return [...cachedMovies];
}

export function isFavorite(slug: string) {
  ensureCache();
  return cachedSlugs.has(slug);
}

export function writeFavorites(
  movies: MovieItem[],
  detail: ChangeDetail = { type: "replace" }
) {
  const raw = JSON.stringify(movies);
  localStorage.setItem(FAVORITES_KEY, raw);

  if (updateCache(raw)) {
    emitSubscribers();
  }

  // Giữ event cũ cho PersonalDashboard/các component hiện hữu.
  notify(detail);
  return movies;
}

export function toggleFavorite(movie: MovieItem) {
  const movies = readFavorites();
  const exists = cachedSlugs.has(movie.slug);
  const next = exists
    ? movies.filter((item) => item.slug !== movie.slug)
    : [movie, ...movies];

  writeFavorites(next, {
    type: "toggle",
    slug: movie.slug,
  });

  return { saved: !exists, movies: next };
}

export function removeFavorite(slug: string) {
  const next = readFavorites().filter(
    (item) => item.slug !== slug
  );

  writeFavorites(next, {
    type: "remove",
    slug,
  });

  return next;
}
