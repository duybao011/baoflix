"use client";

import type { MovieDetail } from "@/lib/kkphim";

export const HISTORY_KEY = "baoflix_history";
export const HISTORY_TOMBSTONES_KEY = "baoflix_history_tombstones_v1";
export const WATCHED_KEY = "baoflix_watched_episodes";
export const WATCH_STORE_CHANGE_EVENT = "baoflix-watch-store-change";
// BAOFLIX_PERSONAL_HISTORY_SYNC

export type WatchHistoryItem = {
  slug: string;
  name: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  lang?: string;
  quality?: string;
  type?: string;

  episodeName?: string;
  episodeIndex?: number;

  serverIndex?: number;
  serverName?: string;

  seasonIndex?: number;
  seasonName?: string;

  watchedAt?: string;
  href?: string;
  isCustom?: boolean;

  country?: {
    name: string;
    slug: string;
  }[];

  category?: {
    name: string;
    slug: string;
  }[];
};

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));

  if (
    key === HISTORY_KEY ||
    key === HISTORY_TOMBSTONES_KEY ||
    key === WATCHED_KEY
  ) {
    window.dispatchEvent(
      new CustomEvent(WATCH_STORE_CHANGE_EVENT, {
        detail: { key },
      })
    );
  }
}

export function getNormalWatchedKey(
  movieSlug: string,
  serverIndex: number,
  episodeIndex: number
) {
  return `${movieSlug}|server:${serverIndex}|episode:${episodeIndex}`;
}

export function getCustomWatchedKey(
  movieSlug: string,
  seasonIndex: number,
  episodeIndex: number
) {
  return `custom:${movieSlug}|season:${seasonIndex}|episode:${episodeIndex}`;
}

export function readWatchedEpisodes(): string[] {
  return readJson<string[]>(WATCHED_KEY, []);
}

export function saveWatchedEpisode(key: string) {
  const list = readWatchedEpisodes();

  if (list.includes(key)) {
    return list;
  }

  const next = [key, ...list];
  writeJson(WATCHED_KEY, next);

  return next;
}

export type WatchHistoryTombstones = Record<string, string>;

export function readWatchHistoryTombstones(): WatchHistoryTombstones {
  const value = readJson<unknown>(HISTORY_TOMBSTONES_KEY, {});
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const next: WatchHistoryTombstones = {};
  Object.entries(value as Record<string, unknown>).forEach(([slug, deletedAt]) => {
    if (!slug || typeof deletedAt !== "string") return;
    if (!Number.isFinite(Date.parse(deletedAt))) return;
    next[slug] = deletedAt;
  });
  return next;
}

function writeWatchHistoryTombstones(value: WatchHistoryTombstones) {
  const ordered = Object.fromEntries(
    Object.entries(value)
      .sort(([, a], [, b]) => Date.parse(b) - Date.parse(a))
      .slice(0, 200)
  );
  writeJson(HISTORY_TOMBSTONES_KEY, ordered);
  return ordered;
}

export function rememberWatchHistoryDeletion(slug: string, deletedAt = new Date().toISOString()) {
  const cleanSlug = slug.trim();
  if (!cleanSlug) return readWatchHistoryTombstones();

  const current = readWatchHistoryTombstones();
  const oldTime = Date.parse(current[cleanSlug] || "");
  const nextTime = Date.parse(deletedAt);

  if (!Number.isFinite(nextTime)) return current;
  if (Number.isFinite(oldTime) && oldTime >= nextTime) return current;

  return writeWatchHistoryTombstones({ ...current, [cleanSlug]: deletedAt });
}

export function clearWatchHistoryDeletion(slug: string) {
  const current = readWatchHistoryTombstones();
  if (!current[slug]) return current;

  const next = { ...current };
  delete next[slug];
  return writeWatchHistoryTombstones(next);
}

export function resolveWatchHistoryWithTombstones(
  items: WatchHistoryItem[],
  tombstones: WatchHistoryTombstones
) {
  const history = normalizeWatchHistory(items);
  const nextTombstones = { ...tombstones };
  const visible: WatchHistoryItem[] = [];

  history.forEach((item) => {
    const deletedTime = Date.parse(nextTombstones[item.slug] || "");
    const watchedTime = getTimeValue(item);

    if (Number.isFinite(deletedTime) && deletedTime >= watchedTime) return;
    if (Number.isFinite(deletedTime) && watchedTime > deletedTime) {
      delete nextTombstones[item.slug];
    }
    visible.push(item);
  });

  return { history: visible, tombstones: nextTombstones };
}

function getHistoryGroupKey(item: WatchHistoryItem) {
  // Cùng slug thì gộp chung 1 lịch sử, dù là phim trong code hay phim thêm bằng giao diện.
  // Ví dụ:
  // /phim/sabakan-uchuu-e-iku và /ca-nhan/sabakan-uchuu-e-iku
  // chỉ còn 1 card "Xem tiếp", giữ bản có watchedAt mới nhất.
  return item.slug;
}

function getTimeValue(item: WatchHistoryItem) {
  const time = item.watchedAt ? new Date(item.watchedAt).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function normalizeHistoryItem(item: WatchHistoryItem): WatchHistoryItem {
  if (!item.href) {
    if (item.isCustom) {
      return {
        ...item,
        href: `/ca-nhan/${item.slug}/xem?season=${item.seasonIndex ?? 0}&tap=${
          item.episodeIndex ?? 0
        }`,
      };
    }

    return {
      ...item,
      href: `/xem/${item.slug}?server=${item.serverIndex ?? 0}&tap=${
        item.episodeIndex ?? 0
      }`,
    };
  }

  return item;
}

/**
 * Gom lịch sử về đúng logic:
 * 1 slug phim = 1 dòng duy nhất.
 * Nếu phim trong code và phim thêm bằng giao diện có cùng slug,
 * giữ lại dòng có watchedAt mới nhất.
 */
export function normalizeWatchHistory(items: WatchHistoryItem[]) {
  const map = new Map<string, WatchHistoryItem>();

  items.forEach((item) => {
    if (!item?.slug) return;

    const normalizedItem = normalizeHistoryItem(item);
    const key = getHistoryGroupKey(normalizedItem);
    const old = map.get(key);

    if (!old || getTimeValue(normalizedItem) >= getTimeValue(old)) {
      map.set(key, normalizedItem);
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => getTimeValue(b) - getTimeValue(a)
  );
}

export function applySyncedWatchState(
  history: WatchHistoryItem[],
  watchedEpisodes: string[],
  tombstones: WatchHistoryTombstones = readWatchHistoryTombstones()
) {
  const nextHistory = normalizeWatchHistory(history).slice(0, 200);
  const nextWatched = Array.from(
    new Set(watchedEpisodes.filter(Boolean))
  ).slice(0, 5000);

  const oldHistory = readJson<WatchHistoryItem[]>(
    HISTORY_KEY,
    []
  );
  const oldWatched = readJson<string[]>(
    WATCHED_KEY,
    []
  );
  const oldTombstones = readWatchHistoryTombstones();

  let changed = false;

  if (
    JSON.stringify(oldHistory) !== JSON.stringify(nextHistory)
  ) {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(nextHistory)
    );
    changed = true;
  }

  if (
    JSON.stringify(oldWatched) !== JSON.stringify(nextWatched)
  ) {
    localStorage.setItem(
      WATCHED_KEY,
      JSON.stringify(nextWatched)
    );
    changed = true;
  }

  if (JSON.stringify(oldTombstones) !== JSON.stringify(tombstones)) {
    localStorage.setItem(HISTORY_TOMBSTONES_KEY, JSON.stringify(tombstones));
    changed = true;
  }

  if (changed) {
    window.dispatchEvent(new Event("storage"));
  }

  return changed;
}

export function readWatchHistory() {
  const raw = readJson<WatchHistoryItem[]>(HISTORY_KEY, []);
  const normalized = normalizeWatchHistory(raw);

  if (JSON.stringify(normalized) !== JSON.stringify(raw)) {
    writeJson(HISTORY_KEY, normalized);
  }

  return normalized;
}

export function clearWatchHistory() {
  const history = readWatchHistory();
  const deletedAt = new Date().toISOString();
  const tombstones = { ...readWatchHistoryTombstones() };

  history.forEach((item) => {
    tombstones[item.slug] = deletedAt;
  });

  writeWatchHistoryTombstones(tombstones);
  writeJson(HISTORY_KEY, []);
}

export function removeWatchHistoryItem(input: {
  slug: string;
  isCustom?: boolean;
}) {
  const history = readWatchHistory();

  // Vì lịch sử đã gộp theo slug, xóa 1 phim là xóa luôn mọi biến thể normal/custom cùng slug.
  const next = history.filter((item) => item.slug !== input.slug);

  rememberWatchHistoryDeletion(input.slug);
  writeJson(HISTORY_KEY, next);

  return next;
}

export function saveNormalWatchHistory(input: {
  movie: MovieDetail;
  serverIndex: number;
  episodeIndex: number;
  serverName?: string;
  episodeName?: string;
}) {
  const history = readWatchHistory();

  const item: WatchHistoryItem = {
    slug: input.movie.slug,
    name: input.movie.name,
    origin_name: input.movie.origin_name,
    poster_url: input.movie.poster_url,
    thumb_url: input.movie.thumb_url,
    year: input.movie.year,
    lang: input.movie.lang,
    quality: input.movie.quality,
    type: input.movie.type,
    country: input.movie.country,
    category: input.movie.category,

    episodeName: input.episodeName,
    episodeIndex: input.episodeIndex,

    serverIndex: input.serverIndex,
    serverName: input.serverName,

    watchedAt: new Date().toISOString(),
    href: `/xem/${input.movie.slug}?server=${input.serverIndex}&tap=${input.episodeIndex}`,
    isCustom: false,
  };

  const next = normalizeWatchHistory([
    item,
    ...history.filter((old) => old.slug !== item.slug),
  ]).slice(0, 200);

  clearWatchHistoryDeletion(item.slug);
  writeJson(HISTORY_KEY, next);

  return next;
}

export function saveCustomWatchHistory(input: {
  movie: MovieDetail;
  seasonIndex: number;
  episodeIndex: number;
  seasonName?: string;
  episodeName?: string;
}) {
  const history = readWatchHistory();

  const item: WatchHistoryItem = {
    slug: input.movie.slug,
    name: input.movie.name,
    origin_name: input.movie.origin_name,
    poster_url: input.movie.poster_url,
    thumb_url: input.movie.thumb_url,
    year: input.movie.year,
    lang: input.movie.lang,
    quality: input.movie.quality,
    type: input.movie.type,
    country: input.movie.country,
    category: input.movie.category,

    episodeName: input.episodeName,
    episodeIndex: input.episodeIndex,

    seasonIndex: input.seasonIndex,
    seasonName: input.seasonName,

    watchedAt: new Date().toISOString(),
    href: `/ca-nhan/${input.movie.slug}/xem?season=${input.seasonIndex}&tap=${input.episodeIndex}`,
    isCustom: true,
  };

  const next = normalizeWatchHistory([
    item,
    ...history.filter((old) => old.slug !== item.slug),
  ]).slice(0, 200);

  clearWatchHistoryDeletion(item.slug);
  writeJson(HISTORY_KEY, next);

  return next;
}
