"use client";

import type { MovieDetail } from "@/lib/kkphim";

export const HISTORY_KEY = "baoflix_history";
export const WATCHED_KEY = "baoflix_watched_episodes";

export type WatchHistoryItem = {
  slug: string;
  name: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  lang?: string;
  quality?: string;

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

function getHistoryGroupKey(item: WatchHistoryItem) {
  return `${item.isCustom ? "custom" : "normal"}:${item.slug}`;
}

function getTimeValue(item: WatchHistoryItem) {
  const time = item.watchedAt ? new Date(item.watchedAt).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

/**
 * Gom lịch sử về đúng logic:
 * 1 phim thường = 1 dòng
 * 1 phim riêng = 1 dòng
 * Giữ lại dòng có watchedAt mới nhất.
 */
export function normalizeWatchHistory(items: WatchHistoryItem[]) {
  const map = new Map<string, WatchHistoryItem>();

  items.forEach((item) => {
    if (!item?.slug) return;

    const key = getHistoryGroupKey(item);
    const old = map.get(key);

    if (!old || getTimeValue(item) >= getTimeValue(old)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => getTimeValue(b) - getTimeValue(a)
  );
}

export function readWatchHistory() {
  const raw = readJson<WatchHistoryItem[]>(HISTORY_KEY, []);
  const normalized = normalizeWatchHistory(raw);

  if (normalized.length !== raw.length) {
    writeJson(HISTORY_KEY, normalized);
  }

  return normalized;
}

export function clearWatchHistory() {
  writeJson(HISTORY_KEY, []);
}

export function removeWatchHistoryItem(input: {
  slug: string;
  isCustom?: boolean;
}) {
  const history = readWatchHistory();

  const next = history.filter(
    (item) =>
      !(
        item.slug === input.slug &&
        Boolean(item.isCustom) === Boolean(input.isCustom)
      )
  );

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
    ...history.filter(
      (old) => !(old.slug === item.slug && !Boolean(old.isCustom))
    ),
  ]).slice(0, 200);

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
    ...history.filter(
      (old) => !(old.slug === item.slug && Boolean(old.isCustom))
    ),
  ]).slice(0, 200);

  writeJson(HISTORY_KEY, next);

  return next;
}