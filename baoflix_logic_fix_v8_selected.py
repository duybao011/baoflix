#!/usr/bin/env python3
from __future__ import annotations
import argparse, datetime as dt, json, os, shutil, subprocess, sys
from pathlib import Path


def fail(msg):
    raise RuntimeError(msg)


def ro(text, old, new, label):
    c = text.count(old)
    if c != 1:
        fail(f"[{label}] expected 1 match, found {c}")
    return text.replace(old, new, 1)


def rb(text, start, end, new, label):
    i = text.find(start)
    if i < 0:
        fail(f"[{label}] start marker missing")
    j = text.find(end, i + len(start))
    if j < 0:
        fail(f"[{label}] end marker missing")
    return text[:i] + new + text[j + len(end):]


def read(path):
    if not path.exists():
        fail(f"Missing file: {path}")
    return path.read_text(encoding="utf-8")


def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def root_of(start):
    c = start.resolve()
    for r in [c, *c.parents]:
        if (r / "package.json").exists() and (r / "components").exists() and (r / "lib").exists():
            return r
    fail("Không tìm thấy root repo BảoFlix")


FAVORITES_STORE = r'''"use client";

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
'''

FAVORITE_BUTTON = r'''"use client";

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
'''


def patch_movie_card(t):
    t = ro(t,
'''import { useEffect, useState } from "react";
import type { MovieItem } from "@/lib/kkphim";

const FAVORITE_KEY = "baoflix_favorites";''',
'''import { useEffect, useState } from "react";
import type { MovieItem } from "@/lib/kkphim";
import {
  FAVORITES_CHANGE_EVENT,
  isFavorite,
  toggleFavorite as toggleFavoriteStore,
} from "@/lib/favoritesStore";''',
"MovieCard imports")
    t = rb(t, "function readFavorites(): MovieItem[] {", "export default function MovieCard({", "export default function MovieCard({", "MovieCard remove reader")
    t = ro(t,
'''  useEffect(() => {
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
  }''',
'''  useEffect(() => {
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
  }''',
"MovieCard favorites")
    return t


def patch_favorites_page(t):
    t = ro(t,
'''import { MovieItem, Taxonomy } from "@/lib/kkphim";
import CompactMovieCard from "@/components/CompactMovieCard";

const KEY = "baoflix_favorites";''',
'''import { MovieItem, Taxonomy } from "@/lib/kkphim";
import CompactMovieCard from "@/components/CompactMovieCard";
import {
  FAVORITES_CHANGE_EVENT,
  readFavorites,
  removeFavorite as removeFavoriteStore,
} from "@/lib/favoritesStore";''',
"Favorites imports")
    t = ro(t,
'''  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setMovies(raw ? JSON.parse(raw) : []);
    } catch {
      setMovies([]);
    }
  }, []);''',
'''  useEffect(() => {
    function refresh() {
      setMovies(readFavorites());
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
  }, []);''',
"Favorites effect")
    t = ro(t,
'''  function removeFavorite(slug: string) {
    const next = movies.filter((movie) => movie.slug !== slug);
    setMovies(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }''',
'''  function removeFavorite(slug: string) {
    setMovies(removeFavoriteStore(slug));
  }''',
"Favorites remove")
    return t


def patch_my_taste_client(t):
    t = ro(t,
'''import MovieCard from "@/components/MovieCard";
import type { MovieItem } from "@/lib/kkphim";
const HISTORY_KEY = "baoflix_history";
const FAVORITE_KEY = "baoflix_favorites";''',
'''import MovieCard from "@/components/MovieCard";
import type { MovieItem } from "@/lib/kkphim";
import { FAVORITES_CHANGE_EVENT, readFavorites } from "@/lib/favoritesStore";
import { readWatchHistory, WATCH_STORE_CHANGE_EVENT } from "@/lib/watchStore";''',
"MyTaste imports")
    t = rb(t, "function readJson<T>(key: string, fallback: T): T {", 'function findTopTaxonomy(items: LocalMovie[], key: "country" | "category") {', 'function findTopTaxonomy(items: LocalMovie[], key: "country" | "category") {', "MyTaste helper")
    t = ro(t,
'''  useEffect(() => {
    setHistory(readJson<LocalMovie[]>(HISTORY_KEY, []));
    setFavorites(readJson<LocalMovie[]>(FAVORITE_KEY, []));
  }, []);''',
'''  useEffect(() => {
    function refresh() {
      setHistory(readWatchHistory());
      setFavorites(readFavorites());
    }

    refresh();
    window.addEventListener(WATCH_STORE_CHANGE_EVENT, refresh);
    window.addEventListener(FAVORITES_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener(WATCH_STORE_CHANGE_EVENT, refresh);
      window.removeEventListener(FAVORITES_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);''',
"MyTaste reactive")
    return t


def patch_dashboard(t):
    t = ro(t,
'''import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
const HISTORY_KEY = "baoflix_history";
const FAVORITE_KEY = "baoflix_favorites";
const WATCHED_KEY = "baoflix_watched_episodes";
const SEARCH_HISTORY_KEY = "baoflix_search_history";''',
'''import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  readWatchHistory,
  readWatchedEpisodes,
  WATCH_STORE_CHANGE_EVENT,
} from "@/lib/watchStore";
import { FAVORITES_CHANGE_EVENT, readFavorites } from "@/lib/favoritesStore";
const SEARCH_HISTORY_KEY = "baoflix_search_history";''',
"Dashboard imports")
    t = ro(t,
'''  watchedAt?: string;
  country?: Taxonomy[];''',
'''  watchedAt?: string;
  href?: string;
  isCustom?: boolean;
  seasonIndex?: number;
  seasonName?: string;
  country?: Taxonomy[];''',
"Dashboard fields")
    marker = 'function countTaxonomy(items: DashboardMovie[], key: "country" | "category") {'
    helper = r'''function getHistoryHref(item: DashboardMovie) {
  if (item.href) return item.href;
  if (item.isCustom) {
    return `/ca-nhan/${item.slug}/xem?season=${item.seasonIndex ?? 0}&tap=${item.episodeIndex ?? 0}`;
  }
  return `/xem/${item.slug}?server=${item.serverIndex ?? 0}&tap=${item.episodeIndex ?? 0}`;
}

'''
    if marker not in t:
        fail("[Dashboard helper] marker missing")
    t = t.replace(marker, helper + marker, 1)
    t = ro(t,
'''  useEffect(() => {
    setHistory(readJson<DashboardMovie[]>(HISTORY_KEY, []));
    setFavorites(readJson<DashboardMovie[]>(FAVORITE_KEY, []));
    setWatched(readJson<string[]>(WATCHED_KEY, []));
    setSearchHistory(readJson<string[]>(SEARCH_HISTORY_KEY, []));
  }, []);''',
'''  useEffect(() => {
    function refresh() {
      setHistory(readWatchHistory());
      setFavorites(readFavorites());
      setWatched(readWatchedEpisodes());
      setSearchHistory(readJson<string[]>(SEARCH_HISTORY_KEY, []));
    }

    refresh();
    window.addEventListener(WATCH_STORE_CHANGE_EVENT, refresh);
    window.addEventListener(FAVORITES_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener(WATCH_STORE_CHANGE_EVENT, refresh);
      window.removeEventListener(FAVORITES_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);''',
"Dashboard reactive")
    t = ro(t,
'''                href={`/xem/${item.slug}?server=${item.serverIndex ?? 0}&tap=${item.episodeIndex ?? 0}`}''',
'''                href={getHistoryHref(item)}''',
"Dashboard custom route")
    return t


def patch_movie_detail_actions(t):
    t = ro(t,
'''import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";
import {''',
'''import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";
import { findEpisodeMatch } from "@/lib/episodeMatch";
import {''',
"MovieDetailActions import")
    old = r'''function getWatchedEpisodeIndexes(
  movieSlug: string,
  servers: EpisodeServer[],
  watchedKeys: string[]
) {
  const watchedKeySet = new Set(watchedKeys);
  const watchedEpisodeIndexes = new Set<number>();

  servers.forEach((server, serverIndex) => {
    const episodes = server.server_data ?? [];

    episodes.forEach((_, episodeIndex) => {
      const key = getNormalWatchedKey(movieSlug, serverIndex, episodeIndex);

      if (watchedKeySet.has(key)) {
        watchedEpisodeIndexes.add(episodeIndex);
      }
    });
  });

  return watchedEpisodeIndexes;
}'''
    new = r'''function getWatchedEpisodeIndexes(
  movieSlug: string,
  servers: EpisodeServer[],
  watchedKeys: string[],
  canonicalServerIndex: number
) {
  const watchedKeySet = new Set(watchedKeys);
  const watchedEpisodeIndexes = new Set<number>();
  const canonicalEpisodes = servers[canonicalServerIndex]?.server_data ?? [];

  if (!canonicalEpisodes.length) return watchedEpisodeIndexes;

  servers.forEach((server, serverIndex) => {
    const episodes = server.server_data ?? [];

    episodes.forEach((episode, episodeIndex) => {
      const key = getNormalWatchedKey(movieSlug, serverIndex, episodeIndex);
      if (!watchedKeySet.has(key)) return;

      const match = findEpisodeMatch(episode, canonicalEpisodes, episodeIndex);
      if (match.matched && match.index >= 0) {
        watchedEpisodeIndexes.add(match.index);
      }
    });
  });

  return watchedEpisodeIndexes;
}'''
    t = ro(t, old, new, "MovieDetailActions mapping")
    t = ro(t,
'''    return getWatchedEpisodeIndexes(movie.slug, servers, watchedEpisodes);
  }, [movie.slug, servers, watchedEpisodes]);''',
'''    return getWatchedEpisodeIndexes(
      movie.slug,
      servers,
      watchedEpisodes,
      latestInfo?.serverIndex ?? 0
    );
  }, [movie.slug, servers, watchedEpisodes, latestInfo?.serverIndex]);''',
"MovieDetailActions call")
    return t

def patch_custom_movie_form(t):
    t = ro(t,
'''import {
  createCustomMovieFromForm,
  upsertCustomMovie,
} from "@/lib/customMoviesClient";''',
'''import {
  checkEpisodeLink,
  createCustomMovieFromForm,
  getCustomMovieBySlugClient,
  upsertCustomMovie,
} from "@/lib/customMoviesClient";''',
"CustomMovieForm imports")
    marker = "export default function CustomMovieForm() {"
    helper = r'''function validateEpisodeLines(episodesText: string) {
  const errors: string[] = [];

  episodesText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, rawIndex) => {
      if (line.startsWith("#")) return;

      const parts = line.includes("|") ? line.split("|") : [];
      const label = parts.length > 0
        ? parts[0]?.trim() || `Dòng ${rawIndex + 1}`
        : `Dòng ${rawIndex + 1}`;
      const videoUrl = parts.length > 0 ? parts[1]?.trim() || "" : line;
      const subtitleUrl = parts.length > 2 ? parts.slice(2).join("|").trim() : "";

      const videoCheck = checkEpisodeLink(videoUrl);
      if (!videoCheck.ok) {
        errors.push(`${label}: video - ${videoCheck.message}`);
      }

      if (subtitleUrl) {
        const subtitleCheck = checkEpisodeLink(subtitleUrl);
        if (!subtitleCheck.ok) {
          errors.push(`${label}: phụ đề - ${subtitleCheck.message}`);
        }
      }
    });

  return errors;
}

'''
    if marker not in t:
        fail("[CustomMovieForm validator] marker missing")
    t = t.replace(marker, helper + marker, 1)
    t = ro(t,
'''    if (!episodesText.trim()) {
      alert("Nhập ít nhất 1 tập phim.");
      return;
    }

    const movie = createCustomMovieFromForm({''',
'''    if (!episodesText.trim()) {
      alert("Nhập ít nhất 1 tập phim.");
      return;
    }

    const episodeErrors = validateEpisodeLines(episodesText);
    if (episodeErrors.length > 0) {
      alert([
        "Có link tập/phụ đề chưa hợp lệ:",
        "",
        ...episodeErrors.slice(0, 8),
        episodeErrors.length > 8 ? `... và ${episodeErrors.length - 8} lỗi khác.` : "",
      ].filter(Boolean).join("\\n"));
      return;
    }

    const existing = getCustomMovieBySlugClient(finalSlug);
    if (existing) {
      const shouldOverwrite = window.confirm(
        `Slug "${finalSlug}" đã tồn tại (${existing.movie.name}).\\n\\nGhi đè phim cũ bằng dữ liệu mới?`
      );
      if (!shouldOverwrite) return;
    }

    const movie = createCustomMovieFromForm({''',
"CustomMovieForm validation")
    return t


def patch_search_box(t):
    old = r'''  useEffect(() => {
    if (trimmedKeyword.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);

        const res = await fetch(
          `/api/search-suggest?q=${encodeURIComponent(trimmedKeyword)}`
        );

        const data = await res.json();

        setSuggestions(data.items || []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [trimmedKeyword]);'''
    new = r'''  useEffect(() => {
    if (trimmedKeyword.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        if (!cancelled) setLoading(true);
        const res = await fetch(
          `/api/search-suggest?q=${encodeURIComponent(trimmedKeyword)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Không lấy được gợi ý tìm kiếm.");
        const data = await res.json();
        if (!cancelled) {
          setSuggestions(Array.isArray(data?.items) ? data.items : []);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmedKeyword]);'''
    return ro(t, old, new, "SearchBox abort")


def patch_local_custom_search(t):
    t = ro(t,
'''import {
  readCustomMovies,
  type StoredCustomMovie,
} from "@/lib/customMoviesClient";''',
'''import {
  CUSTOM_MOVIES_CHANGE_EVENT,
  readCustomMovies,
  type StoredCustomMovie,
} from "@/lib/customMoviesClient";''',
"LocalCustomSearch imports")
    t = ro(t,
'''    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };''',
'''    window.addEventListener(CUSTOM_MOVIES_CHANGE_EVENT, refresh);
    window.addEventListener("baoflix-custom-movies-synced", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener(CUSTOM_MOVIES_CHANGE_EVENT, refresh);
      window.removeEventListener("baoflix-custom-movies-synced", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };''',
"LocalCustomSearch realtime")
    return t


RELATED_MOVIES = r'''import MovieGrid from "@/components/MovieGrid";
import {
  getMoviesByCountry,
  getMoviesByGenre,
  getMoviesByYear,
  MovieDetail,
  MovieItem,
  MovieListResult,
} from "@/lib/kkphim";

function addUniqueMovies(target: MovieItem[], source: MovieItem[], currentSlug: string) {
  const existingSlugs = new Set(target.map((movie) => movie.slug));
  source.forEach((movie) => {
    if (!movie?.slug || movie.slug === currentSlug || existingSlugs.has(movie.slug)) return;
    target.push(movie);
    existingSlugs.add(movie.slug);
  });
}

async function safeRelatedResult(label: string, loader: () => Promise<MovieListResult>) {
  try {
    return await loader();
  } catch (error) {
    console.warn("Lỗi lấy phim liên quan:", label, error);
    return null;
  }
}

export default async function RelatedMovies({ movie }: { movie: MovieDetail }) {
  const countrySlug = movie.country?.[0]?.slug;
  const categorySlug = movie.category?.[0]?.slug;
  const year = movie.year ? String(movie.year) : "";
  const relatedMovies: MovieItem[] = [];

  if (categorySlug && countrySlug) {
    const combined = await safeRelatedResult(`${categorySlug}+${countrySlug}`, () =>
      getMoviesByGenre(categorySlug, 1, 24, { country: countrySlug })
    );
    addUniqueMovies(relatedMovies, combined?.items || [], movie.slug);
  }

  if (relatedMovies.length < 18) {
    const [categoryResult, countryResult, yearResult] = await Promise.all([
      categorySlug
        ? safeRelatedResult(categorySlug, () => getMoviesByGenre(categorySlug, 1, 24))
        : Promise.resolve(null),
      countrySlug
        ? safeRelatedResult(countrySlug, () => getMoviesByCountry(countrySlug, 1, 24))
        : Promise.resolve(null),
      year
        ? safeRelatedResult(year, () => getMoviesByYear(year, 1, 24))
        : Promise.resolve(null),
    ]);

    addUniqueMovies(relatedMovies, categoryResult?.items || [], movie.slug);
    addUniqueMovies(relatedMovies, countryResult?.items || [], movie.slug);
    addUniqueMovies(relatedMovies, yearResult?.items || [], movie.slug);
  }

  const movies = relatedMovies.slice(0, 18);
  if (!movies.length) return null;

  return <section><MovieGrid title="Có thể fen sẽ thích" movies={movies} /></section>;
}
'''


TV_FLOATING = r'''"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isMobileDevice } from "@/lib/tvMode";

export default function TvModeFloatingButton() {
  const pathname = usePathname();
  const [showOnDevice, setShowOnDevice] = useState(false);

  useEffect(() => {
    setShowOnDevice(!isMobileDevice());
  }, []);

  const hiddenPaths = ["/tv", "/xem", "/ca-nhan"];
  const shouldHide = hiddenPaths.some((path) => pathname.startsWith(path));

  if (shouldHide || !showOnDevice) return null;

  return (
    <Link
      href="/tv"
      className="fixed bottom-24 right-4 z-40 rounded-full border border-yellow-300/30 bg-yellow-300 px-4 py-3 text-sm font-black text-black shadow-2xl shadow-black/40 hover:bg-yellow-200 lg:hidden"
    >
      TV
    </Link>
  );
}
'''


def patch_watch_page(t):
    return ro(t,
'''  } catch {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-black">Không tải được phim</h1>''',
'''  } catch {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <LocalCustomMovieRouteSync
          slug={slug}
          mode="watch"
          serverIndex={Number(query.server || 0)}
          episodeIndex={Number(query.tap || 0)}
        />

        <h1 className="text-2xl font-black">Không tải được phim</h1>''',
"WatchPage custom fallback")


MY_TASTE_ROUTE = r'''import { NextResponse } from "next/server";
import { getMoviesByCountry, getMoviesByGenre } from "@/lib/kkphim";

function uniqueMovies(items: any[]) {
  const map = new Map<string, any>();
  items.forEach((movie) => {
    if (!movie?.slug) return;
    if (!map.has(movie.slug)) map.set(movie.slug, movie);
  });
  return Array.from(map.values());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country") || "";
  const category = searchParams.get("category") || "";
  const results: any[] = [];

  try {
    if (country && category) {
      const combined = await getMoviesByCountry(country, 1, 24, { category });
      results.push(...(combined.items || []));

      if (uniqueMovies(results).length < 18) {
        const [countryFallback, categoryFallback] = await Promise.all([
          getMoviesByCountry(country, 1, 24),
          getMoviesByGenre(category, 1, 24),
        ]);
        results.push(...(countryFallback.items || []));
        results.push(...(categoryFallback.items || []));
      }
    } else if (country) {
      const result = await getMoviesByCountry(country, 1, 24);
      results.push(...(result.items || []));
    } else if (category) {
      const result = await getMoviesByGenre(category, 1, 24);
      results.push(...(result.items || []));
    }

    return NextResponse.json({ items: uniqueMovies(results).slice(0, 24) });
  } catch {
    return NextResponse.json({ items: uniqueMovies(results).slice(0, 24) });
  }
}
'''

def patch_kkphim(t):
    t = ro(t,
'''  return total <= 1;
}

function isSeriesAnimation''',
'''  // Metadata không đủ thì không đoán unknown thành phim lẻ.
  return total === 1;
}

function isSeriesAnimation''',
"Animation unknown")

    start = "async function getAggregatedMultiFilterMovies("
    end = "export const DEFAULT_GENRES: Taxonomy[] = ["
    new_fn = r'''async function getAggregatedMultiFilterMovies(
  filters: FilterValues = {}
): Promise<MovieListResult> {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.max(1, Number(filters.limit || 36));
  const type = filters.type || "tat-ca";
  const subtype = filters.subtype || "tat-ca";
  const year = filters.year || "tat-ca";
  const categorySlugs = parseMultiFilterValue(filters.category);
  const countrySlugs = parseMultiFilterValue(filters.country);
  const sourceLimit = Math.max(limit, MULTI_FILTER_SOURCE_LIMIT);

  const baseFilters: Partial<FilterValues> = {
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    sort_lang: filters.sort_lang,
    year: year !== "tat-ca" ? year : undefined,
  };

  function buildTasks(sourcePage: number) {
    const tasks: Promise<MovieListResult>[] = [];

    if (categorySlugs.length && countrySlugs.length) {
      categorySlugs.forEach((categorySlug) => {
        countrySlugs.forEach((countrySlug) => {
          if (type && type !== "tat-ca") {
            tasks.push(getMoviesByList(type, sourcePage, sourceLimit, {
              ...baseFilters,
              category: categorySlug,
              country: countrySlug,
            }));
          } else {
            tasks.push(getMoviesByGenre(categorySlug, sourcePage, sourceLimit, {
              ...baseFilters,
              country: countrySlug,
            }));
          }
        });
      });
      return tasks;
    }

    if (type && type !== "tat-ca") {
      categorySlugs.forEach((categorySlug) => {
        tasks.push(getMoviesByList(type, sourcePage, sourceLimit, {
          ...baseFilters,
          category: categorySlug,
        }));
      });
      countrySlugs.forEach((countrySlug) => {
        tasks.push(getMoviesByList(type, sourcePage, sourceLimit, {
          ...baseFilters,
          country: countrySlug,
        }));
      });
      return tasks;
    }

    categorySlugs.forEach((categorySlug) => {
      tasks.push(getMoviesByGenre(categorySlug, sourcePage, sourceLimit, baseFilters));
    });
    countrySlugs.forEach((countrySlug) => {
      tasks.push(getMoviesByCountry(countrySlug, sourcePage, sourceLimit, baseFilters));
    });
    return tasks;
  }

  if (!categorySlugs.length && !countrySlugs.length) {
    return getLatestMovieListResult(page, limit);
  }

  let sourcePage = 1;
  let mergedItems: MovieItem[] = [];
  let finalItems: MovieItem[] = [];
  let hasMoreSourcePages = true;
  const targetCount = (page + 1) * limit;
  const minimumSourcePages = page + 1;

  while (hasMoreSourcePages) {
    const results = await Promise.allSettled(buildTasks(sourcePage));
    const fulfilled = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    );

    if (!fulfilled.length) break;

    mergedItems = uniqueMovies([
      ...mergedItems,
      ...fulfilled.flatMap((result) => result.items || []),
    ]);

    const locallyFiltered = applyLocalMultiTagFilter(
      mergedItems,
      categorySlugs,
      countrySlugs
    );

    const subtypeFiltered =
      type === "hoat-hinh" && subtype !== "tat-ca"
        ? filterAnimationSubtype({
            title: "Hoạt hình",
            items: locallyFiltered,
            pagination: {},
          }, subtype).items
        : locallyFiltered;

    finalItems = sortLocalMoviesByFilter(subtypeFiltered, filters);

    hasMoreSourcePages = fulfilled.some((result) =>
      Number(result.pagination?.totalPages || 0) > sourcePage
    );

    if (sourcePage >= minimumSourcePages && finalItems.length >= targetCount) break;
    if (!hasMoreSourcePages) break;
    sourcePage += 1;
  }

  const paginated = paginateLocalMovies(finalItems, page, limit);

  return {
    title: getMultiFilterTitle(categorySlugs, countrySlugs, type),
    items: paginated.items,
    pagination: {
      ...paginated.pagination,
      totalPages: hasMoreSourcePages
        ? Math.max(paginated.pagination.totalPages || 1, page + 1)
        : paginated.pagination.totalPages,
    },
  };
}

'''
    return rb(t, start, end, new_fn + end, "Multi-filter progressive")


def build(root):
    return {
        "lib/favoritesStore.ts": FAVORITES_STORE,
        "components/FavoriteButton.tsx": FAVORITE_BUTTON,
        "components/MovieCard.tsx": patch_movie_card(read(root / "components/MovieCard.tsx")),
        "app/yeu-thich/page.tsx": patch_favorites_page(read(root / "app/yeu-thich/page.tsx")),
        "components/MyTasteClient.tsx": patch_my_taste_client(read(root / "components/MyTasteClient.tsx")),
        "components/PersonalDashboard.tsx": patch_dashboard(read(root / "components/PersonalDashboard.tsx")),
        "components/MovieDetailActions.tsx": patch_movie_detail_actions(read(root / "components/MovieDetailActions.tsx")),
        "components/CustomMovieForm.tsx": patch_custom_movie_form(read(root / "components/CustomMovieForm.tsx")),
        "components/SearchBox.tsx": patch_search_box(read(root / "components/SearchBox.tsx")),
        "components/LocalCustomSearchResults.tsx": patch_local_custom_search(read(root / "components/LocalCustomSearchResults.tsx")),
        "components/RelatedMovies.tsx": RELATED_MOVIES,
        "components/TvModeFloatingButton.tsx": TV_FLOATING,
        "app/xem/[slug]/page.tsx": patch_watch_page(read(root / "app/xem/[slug]/page.tsx")),
        "app/api/my-taste/route.ts": MY_TASTE_ROUTE,
        "lib/kkphim.ts": patch_kkphim(read(root / "lib/kkphim.ts")),
    }


def backup(root, changed, dst):
    for rel in changed:
        src = root / rel
        if not src.exists():
            continue
        out = dst / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, out)


def restore(root, changed, dst):
    for rel in changed:
        src = dst / rel
        target = root / rel
        if src.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, target)
        elif rel == "lib/favoritesStore.ts" and target.exists():
            target.unlink()


def run(root, cmd):
    print("$", " ".join(cmd))
    return subprocess.run(cmd, cwd=root).returncode


def main():
    ap = argparse.ArgumentParser(description="BảoFlix selected logic fixes V8")
    ap.add_argument("--root", type=Path, default=Path.cwd())
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    root = root_of(args.root)
    print("Repo:", root)
    package = json.loads(read(root / "package.json"))
    if package.get("name") != "baoflix":
        print("Cảnh báo package name:", package.get("name"))

    patched = build(root)
    changed = []
    for rel, content in patched.items():
        path = root / rel
        old = read(path) if path.exists() else None
        if old != content:
            changed.append(rel)

    if not changed:
        print("Không có thay đổi; có thể V8 đã được áp dụng.")
        return 0

    print("Sẽ sửa:")
    for rel in changed:
        print(" -", rel)

    if args.dry_run:
        print("Dry-run OK: markers khớp main hiện tại.")
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = root.parent / f"{root.name}_patch_backups" / f"v8_{stamp}"
    backup(root, changed, backup_dir)
    print("Backup:", backup_dir)

    try:
        for rel in changed:
            write(root / rel, patched[rel])

        print("Patch V8 hoàn tất.")

        if args.check:
            npm = "npm.cmd" if os.name == "nt" else "npm"
            targets = [rel for rel in changed if Path(rel).suffix.lower() in {".ts", ".tsx", ".js", ".jsx", ".mts"}]
            if targets:
                if run(root, [npm, "exec", "--", "eslint", *targets]) != 0:
                    fail("Patched source lint failed")
            if run(root, [npm, "run", "build"]) != 0:
                fail("npm run build failed")
            print("Lint patched files + build: OK.")
        else:
            print("Nên chạy npm run build sau khi test local.")

        print("Giữ nguyên TV custom-movie cloud sync theo yêu cầu.")
        return 0
    except Exception as exc:
        print(f"Patch lỗi, rollback: {exc}", file=sys.stderr)
        restore(root, changed, backup_dir)
        print("Đã rollback.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"PATCH ABORTED: {exc}", file=sys.stderr)
        raise SystemExit(2)
