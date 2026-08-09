#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BảoFlix Performance Phase 1

Mục tiêu:
- Local dev dùng Turbopack mặc định của Next 16.
- Giảm sync Supabase và chỉ upsert phim riêng thực sự thay đổi.
- Giảm mạnh request của bộ lọc nhiều tag.
- Search suggestion: 3 ký tự, debounce 450ms, abort request cũ, CDN cache ngắn.
- Prefetch menu khi hover/focus.
- Drive Relay TV: timeout 3.5s + cooldown 5 phút nếu timeout.
- Thêm app/loading.tsx nhẹ.
- Giảm deployment context của Vercel.

BẢO VỆ:
- KHÔNG sửa components/TvRemoteNavigator.tsx
- KHÔNG sửa components/TvWatchOverlay.tsx
- KHÔNG sửa logic overlay/remote chung.
- Chỉ sửa repo local; không gọi GitHub, không commit, không push.

Cách dùng:
    python BaoFlix_Performance_Phase1.py
    python BaoFlix_Performance_Phase1.py --repo D:\\duong-dan\\baoflix
    python BaoFlix_Performance_Phase1.py --dry-run
    python BaoFlix_Performance_Phase1.py --verify
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

TARGETS = [
    Path("package.json"),
    Path("components/CustomMoviesCloudSync.tsx"),
    Path("lib/customMoviesRemote.ts"),
    Path("lib/kkphim.ts"),
    Path("components/Header.tsx"),
    Path("app/api/search-suggest/route.ts"),
    Path("components/CustomDrivePlayer.tsx"),
    Path(".vercelignore"),
    Path("app/loading.tsx"),
]

PROTECTED = [
    Path("components/TvRemoteNavigator.tsx"),
    Path("components/TvWatchOverlay.tsx"),
]

PHASE_MARKER = "BAOFLIX_PERF_PHASE1"


class PatchError(RuntimeError):
    pass


def find_repo_root(start: Path) -> Path:
    start = start.expanduser().resolve()
    for candidate in (start, *start.parents):
        if (
            (candidate / "package.json").is_file()
            and (candidate / "components").is_dir()
            and (candidate / "app").is_dir()
        ):
            return candidate
    raise PatchError(
        "Không tìm thấy repo BảoFlix. Đặt script cạnh package.json "
        "hoặc truyền --repo DUONG_DAN."
    )


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0:
        raise PatchError(
            f"Không tìm thấy đoạn mã cần vá: {label}. "
            "Repo local có thể khác bản GitHub đã kiểm tra; dừng để tránh sửa nhầm."
        )
    if count > 1:
        raise PatchError(f"Đoạn '{label}' xuất hiện {count} lần; dừng để tránh sửa nhầm.")
    return text.replace(old, new, 1)


def replace_region(text: str, start_marker: str, end_marker: str, new_region: str, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise PatchError(f"Không tìm thấy đầu vùng: {label}")
    end = text.find(end_marker, start)
    if end < 0:
        raise PatchError(f"Không tìm thấy cuối vùng: {label}")
    return text[:start] + new_region.rstrip() + "\n\n" + text[end:]


def patch_package_json(text: str) -> tuple[str, list[str]]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise PatchError(f"package.json không đọc được: {exc}") from exc

    scripts = data.setdefault("scripts", {})
    notes: list[str] = []
    if scripts.get("dev") != "next dev":
        old_dev = scripts.get("dev")
        scripts["dev"] = "next dev"
        if old_dev:
            scripts.setdefault("dev:webpack", old_dev)
        notes.append("npm run dev chuyển sang Turbopack mặc định của Next 16.")
    scripts.setdefault("dev:turbo", "next dev --turbopack")
    scripts.setdefault("dev:webpack", "next dev --webpack")
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n", notes


OPTIMIZED_CLOUD_SYNC = r'''"use client";

import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  CUSTOM_MOVIES_CHANGE_EVENT,
  type CustomMoviesChangeDetail,
} from "@/lib/customMoviesClient";
import { syncCustomMoviesBidirectional } from "@/lib/customMoviesRemote";

const MIN_SYNC_INTERVAL_MS = 60_000;
const INITIAL_SYNC_DELAY_MS = 1_500;

export default function CustomMoviesCloudSync() {
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const queuedRef = useRef(false);
  const queuedForceRef = useRef(false);
  const lastCompletedSyncRef = useRef(0);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();

    async function runSync(force = false) {
      if (!active) return;
      const now = Date.now();
      if (
        !force &&
        lastCompletedSyncRef.current > 0 &&
        now - lastCompletedSyncRef.current < MIN_SYNC_INTERVAL_MS
      ) {
        return;
      }

      if (runningRef.current) {
        queuedRef.current = true;
        queuedForceRef.current = queuedForceRef.current || force;
        return;
      }

      runningRef.current = true;
      try {
        await syncCustomMoviesBidirectional();
        lastCompletedSyncRef.current = Date.now();
      } catch (error) {
        console.warn("[BảoFlix] Đồng bộ Supabase thất bại:", error);
      } finally {
        runningRef.current = false;
        if (queuedRef.current && active) {
          const forceNext = queuedForceRef.current;
          queuedRef.current = false;
          queuedForceRef.current = false;
          scheduleSync(forceNext ? 120 : 500, forceNext);
        }
      }
    }

    function scheduleSync(delay = 500, force = false) {
      if (!active) return;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void runSync(force);
      }, delay);
    }

    function handleLocalChange(event: Event) {
      const detail = (event as CustomEvent<CustomMoviesChangeDetail>).detail;
      scheduleSync(detail?.type === "delete" ? 120 : 350, true);
    }

    function handleStorage(event: StorageEvent) {
      if (
        event.key === "baoflix_custom_movies" ||
        event.key === "baoflix_custom_movies_pending_deletes"
      ) {
        scheduleSync(300, true);
      }
    }

    function handleFocus() {
      scheduleSync(500, false);
    }

    function handleOnline() {
      scheduleSync(150, true);
    }

    window.addEventListener(CUSTOM_MOVIES_CHANGE_EVENT, handleLocalChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        scheduleSync(100, true);
      } else if (event === "TOKEN_REFRESHED") {
        scheduleSync(500, false);
      }
    });

    // BAOFLIX_PERF_PHASE1: render giao diện trước, sync nền sau.
    scheduleSync(INITIAL_SYNC_DELAY_MS, false);

    return () => {
      active = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      subscription.unsubscribe();
      window.removeEventListener(CUSTOM_MOVIES_CHANGE_EVENT, handleLocalChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
'''


def patch_cloud_sync(text: str) -> tuple[str, list[str]]:
    if PHASE_MARKER in text and "MIN_SYNC_INTERVAL_MS" in text:
        return text, ["Supabase sync đã có Phase 1; bỏ qua."]
    for marker in ["syncCustomMoviesBidirectional", "scheduleSync(100);", 'window.addEventListener("focus", handleFocus);']:
        if marker not in text:
            raise PatchError(f"CustomMoviesCloudSync.tsx thiếu marker '{marker}', không ghi đè.")
    return OPTIMIZED_CLOUD_SYNC, [
        "Sync đầu trang lùi 1.5 giây để UI render trước.",
        "Focus/tab chỉ sync lại nếu lần gần nhất cách ít nhất 60 giây.",
        "Thay đổi local/online/sign-in vẫn ép sync nhanh.",
    ]


def patch_custom_movies_remote(text: str) -> tuple[str, list[str]]:
    if "moviesToUpload" in text and PHASE_MARKER in text:
        return text, ["customMoviesRemote đã có Phase 1; bỏ qua."]

    new_write = r'''function writeCustomMoviesCache(movies: StoredCustomMovie[]) {
  const nextValue = JSON.stringify(movies);
  const currentValue = localStorage.getItem(CUSTOM_MOVIES_KEY);

  if (currentValue === nextValue) return;

  localStorage.setItem(CUSTOM_MOVIES_KEY, nextValue);
  window.dispatchEvent(
    new CustomEvent("baoflix-custom-movies-synced", {
      detail: {
        count: movies.length,
        syncedAt: new Date().toISOString(),
      },
    })
  );
}'''
    text = replace_region(text, "function writeCustomMoviesCache(", "async function getAuthenticatedUser", new_write, "writeCustomMoviesCache")

    new_merge = r'''function mergeMovies(
  localMovies: StoredCustomMovie[],
  remoteRows: RemoteMovieRow[]
) {
  const merged = new Map<string, StoredCustomMovie>();
  const remoteTimes = new Map<string, number>();
  const localSlugs = new Set(localMovies.map((item) => item.movie.slug));
  const moviesToUpload: StoredCustomMovie[] = [];
  let downloadedCount = 0;
  let uploadedCount = 0;

  remoteRows.forEach((row) => {
    const movie = normalizeRemoteMovie(row);
    if (!movie) return;
    merged.set(movie.movie.slug, movie);
    remoteTimes.set(
      movie.movie.slug,
      Math.max(getTimestamp(row.updated_at), getTimestamp(movie.updatedAt))
    );
  });

  localMovies.forEach((localMovie) => {
    const slug = localMovie.movie.slug;
    const remoteMovie = merged.get(slug);

    if (!remoteMovie) {
      merged.set(slug, localMovie);
      moviesToUpload.push(localMovie);
      uploadedCount += 1;
      return;
    }

    const localTime = getTimestamp(localMovie.updatedAt);
    const remoteTime = remoteTimes.get(slug) ?? 0;

    if (localTime >= remoteTime) {
      merged.set(slug, localMovie);
      if (localTime > remoteTime) {
        moviesToUpload.push(localMovie);
        uploadedCount += 1;
      }
    } else {
      downloadedCount += 1;
    }
  });

  remoteRows.forEach((row) => {
    if (!localSlugs.has(row.slug)) downloadedCount += 1;
  });

  return {
    movies: Array.from(merged.values()).sort(
      (a, b) => getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt)
    ),
    moviesToUpload,
    uploadedCount,
    downloadedCount,
  };
}'''
    text = replace_region(text, "function mergeMovies(", "async function upsertRemoteMovies", new_merge, "mergeMovies")

    old_sync = '''  const { movies, uploadedCount, downloadedCount } = mergeMovies(
    localMovies,
    remoteRows
  );

  await upsertRemoteMovies(user.id, movies);
  writeCustomMoviesCache(movies);'''
    new_sync = '''  const {
    movies,
    moviesToUpload,
    uploadedCount,
    downloadedCount,
  } = mergeMovies(localMovies, remoteRows);

  // BAOFLIX_PERF_PHASE1: chỉ upload bản local thực sự mới hơn/không tồn tại.
  await upsertRemoteMovies(user.id, moviesToUpload);
  writeCustomMoviesCache(movies);'''
    text = replace_once(text, old_sync, new_sync, "chỉ upsert phim riêng thay đổi")
    return text, [
        "Không upsert lại toàn bộ thư viện Supabase mỗi lần sync.",
        "Không ghi lại localStorage nếu dữ liệu merge không đổi.",
    ]


OPTIMIZED_MULTI_FILTER = r'''async function getAggregatedMultiFilterMovies(
  filters: FilterValues = {}
): Promise<MovieListResult> {
  const page = Number(filters.page || 1);
  const limit = Number(filters.limit || 36);

  const type = filters.type || "tat-ca";
  const subtype = filters.subtype || "tat-ca";
  const year = filters.year || "tat-ca";

  const categorySlugs = parseMultiFilterValue(filters.category);
  const countrySlugs = parseMultiFilterValue(filters.country);

  // BAOFLIX_PERF_PHASE1: query từng nhóm độc lập, không nhân category × country.
  const sourcePageCount = Math.max(
    2,
    Math.min(MULTI_FILTER_SOURCE_PAGES, page + 1)
  );
  const sourcePages = Array.from(
    { length: sourcePageCount },
    (_, index) => index + 1
  );
  const sourceLimit = Math.max(limit, MULTI_FILTER_SOURCE_LIMIT);

  const baseFilters: Partial<FilterValues> = {
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    sort_lang: filters.sort_lang,
    year: year !== "tat-ca" ? year : undefined,
  };

  const tasks: Promise<MovieListResult>[] = [];

  if (type && type !== "tat-ca") {
    categorySlugs.forEach((categorySlug) => {
      sourcePages.forEach((sourcePage) => {
        tasks.push(
          getMoviesByList(type, sourcePage, sourceLimit, {
            ...baseFilters,
            category: categorySlug,
          })
        );
      });
    });

    countrySlugs.forEach((countrySlug) => {
      sourcePages.forEach((sourcePage) => {
        tasks.push(
          getMoviesByList(type, sourcePage, sourceLimit, {
            ...baseFilters,
            country: countrySlug,
          })
        );
      });
    });
  } else {
    categorySlugs.forEach((categorySlug) => {
      sourcePages.forEach((sourcePage) => {
        tasks.push(
          getMoviesByGenre(categorySlug, sourcePage, sourceLimit, baseFilters)
        );
      });
    });

    countrySlugs.forEach((countrySlug) => {
      sourcePages.forEach((sourcePage) => {
        tasks.push(
          getMoviesByCountry(countrySlug, sourcePage, sourceLimit, baseFilters)
        );
      });
    });
  }

  if (!tasks.length) return getLatestMovieListResult(page, limit);

  const results = await Promise.allSettled(tasks);
  const mergedItems = uniqueMovies(
    results.flatMap((result) => {
      if (result.status !== "fulfilled") return [];
      return result.value.items || [];
    })
  );

  const locallyFilteredItems = applyLocalMultiTagFilter(
    mergedItems,
    categorySlugs,
    countrySlugs
  );

  const subtypeFilteredItems =
    type === "hoat-hinh" && subtype !== "tat-ca"
      ? filterAnimationSubtype(
          {
            title: "Hoạt hình",
            items: locallyFilteredItems,
            pagination: {},
          },
          subtype
        ).items
      : locallyFilteredItems;

  const sortedItems = sortLocalMoviesByFilter(subtypeFilteredItems, filters);
  const paginated = paginateLocalMovies(sortedItems, page, limit);

  return {
    title: getMultiFilterTitle(categorySlugs, countrySlugs, type),
    items: paginated.items,
    pagination: paginated.pagination,
  };
}'''


def patch_kkphim(text: str) -> tuple[str, list[str]]:
    if PHASE_MARKER in text:
        return text, ["kkphim.ts đã có Phase 1; bỏ qua."]
    text = replace_once(
        text,
        "const ANIMATION_AGGREGATE_SOURCE_PAGES = 12;\nconst ANIMATION_SOURCE_LIMIT = 64;",
        "const ANIMATION_AGGREGATE_SOURCE_PAGES = 5;\nconst ANIMATION_SOURCE_LIMIT = 48;",
        "giảm aggregation hoạt hình",
    )
    text = replace_once(
        text,
        "const MULTI_FILTER_SOURCE_PAGES = 6;\nconst MULTI_FILTER_SOURCE_LIMIT = 48;",
        "const MULTI_FILTER_SOURCE_PAGES = 3;\nconst MULTI_FILTER_SOURCE_LIMIT = 40;",
        "giảm nguồn multi-filter",
    )
    text = replace_region(
        text,
        "async function getAggregatedMultiFilterMovies(",
        "export const DEFAULT_GENRES",
        OPTIMIZED_MULTI_FILTER,
        "getAggregatedMultiFilterMovies",
    )
    return text, [
        "Hoạt hình subtype: tối đa 5 trang × 48 thay vì 12 × 64.",
        "Multi-filter bỏ tích Descartes thể loại × quốc gia.",
        "Trang đầu dùng 2 trang nguồn; trang sau tối đa 3 trang nguồn.",
    ]


NEW_SEARCH_EFFECT = r'''  // BAOFLIX_PERF_PHASE1: debounce + abort search suggestion.
  useEffect(() => {
    const q = keyword.trim();

    if (!focused || q.length < 3) {
      setSuggestions([]);
      setLoadingSuggest(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function fetchSuggestions() {
      try {
        setLoadingSuggest(true);
        const res = await fetch(
          `/api/search-suggest?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Không lấy được gợi ý");

        const data = await res.json();
        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : [];

        if (!cancelled) setSuggestions(items.slice(0, 5));
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoadingSuggest(false);
      }
    }

    const timer = window.setTimeout(fetchSuggestions, 450);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [keyword, focused]);'''


def patch_header(text: str) -> tuple[str, list[str]]:
    notes: list[str] = []
    if PHASE_MARKER not in text:
        pattern = re.compile(
            r'  useEffect\(\(\) => \{\n    const q = keyword\.trim\(\);\n    if \(q\.length < 2\).*?  \}, \[keyword\]\);',
            re.S,
        )
        matches = list(pattern.finditer(text))
        if len(matches) != 1:
            raise PatchError(
                f"Không xác định duy nhất effect search suggestion trong Header (tìm thấy {len(matches)})."
            )
        m = matches[0]
        text = text[:m.start()] + NEW_SEARCH_EFFECT + text[m.end():]
        notes.append("Search suggestion: 3 ký tự, 450ms, AbortController.")

    nav_start = (
        "function NavButton({ item, onClick }: { item: NavItem; onClick?: () => void }) {\n"
        "  return <Link href={item.href} onClick={onClick} prefetch={false}"
    )
    if "function prefetchRoute()" not in text:
        nav_new = (
            "function NavButton({ item, onClick }: { item: NavItem; onClick?: () => void }) {\n"
            "  const router = useRouter();\n"
            "  function prefetchRoute() { router.prefetch(item.href); }\n"
            "  return <Link href={item.href} onClick={onClick} prefetch={false} "
            "onMouseEnter={prefetchRoute} onFocus={prefetchRoute}"
        )
        text = replace_once(text, nav_start, nav_new, "prefetch menu khi hover/focus")
        notes.append("Menu header prefetch khi hover/focus, không prefetch hàng loạt.")
    return text, notes


OPTIMIZED_SEARCH_ROUTE = r'''import { NextResponse } from "next/server";
import { searchMovies } from "@/lib/kkphim";

const CDN_HEADERS = {
  // BAOFLIX_PERF_PHASE1: chỉ cache ở CDN Vercel, không ép browser giữ kết quả.
  "CDN-Cache-Control": "max-age=60, stale-while-revalidate=300",
};

function json(items: unknown[]) {
  return NextResponse.json({ items }, { headers: CDN_HEADERS });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("q")?.trim() || "";

  if (keyword.length < 3) return json([]);

  try {
    const result = await searchMovies(keyword, 1, 8);
    const items = (result.items || []).slice(0, 8).map((movie) => ({
      _id: movie._id,
      name: movie.name,
      slug: movie.slug,
      origin_name: movie.origin_name,
      thumb_url: movie.thumb_url,
      poster_url: movie.poster_url,
      year: movie.year,
      episode_current: movie.episode_current,
      lang: movie.lang,
      quality: movie.quality,
    }));
    return json(items);
  } catch {
    return json([]);
  }
}
'''


def patch_search_route(text: str) -> tuple[str, list[str]]:
    if PHASE_MARKER in text:
        return text, ["Search API đã có Phase 1; bỏ qua."]
    if 'const keyword = searchParams.get("q")?.trim() || "";' not in text:
        raise PatchError("search-suggest route khác bản đã kiểm tra.")
    return OPTIMIZED_SEARCH_ROUTE, [
        "Search API cache 60s ở CDN + stale 300s.",
        "Ngưỡng server đồng bộ với client: tối thiểu 3 ký tự.",
    ]


def patch_drive_player(text: str) -> tuple[str, list[str]]:
    if "DRIVE_RELAY_COOLDOWN_MS" in text:
        return text, ["Drive probe đã có Phase 1; bỏ qua."]

    text = replace_once(
        text,
        'const PROBE_TIMEOUT_MS = 8000;\nconst SAVE_INTERVAL_SECONDS = 5;',
        'const PROBE_TIMEOUT_MS = 3500;\nconst DRIVE_RELAY_COOLDOWN_MS = 5 * 60 * 1000;\nconst DRIVE_RELAY_FAIL_UNTIL_KEY = "baoflix_drive_relay_fail_until";\nconst SAVE_INTERVAL_SECONDS = 5;',
        "giảm Drive probe timeout",
    )

    save_end = r'''function saveEstimate(storageKey: string, seconds: number) {
  try {
    const payload: StoredDriveEstimate = {
      seconds: Math.max(0, Math.floor(seconds)),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      `${storageKey}:iframe-estimate`,
      JSON.stringify(payload)
    );
  } catch {
    // Bỏ qua lỗi storage trên WebView hạn chế.
  }
}'''
    helpers = save_end + r'''

function isDriveRelayCoolingDown() {
  try {
    const failUntil = Number(
      sessionStorage.getItem(DRIVE_RELAY_FAIL_UNTIL_KEY) || 0
    );
    if (!Number.isFinite(failUntil) || failUntil <= Date.now()) {
      sessionStorage.removeItem(DRIVE_RELAY_FAIL_UNTIL_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function rememberDriveRelayTimeout() {
  try {
    sessionStorage.setItem(
      DRIVE_RELAY_FAIL_UNTIL_KEY,
      String(Date.now() + DRIVE_RELAY_COOLDOWN_MS)
    );
  } catch {
    // Bỏ qua storage bị chặn.
  }
}

function clearDriveRelayTimeout() {
  try {
    sessionStorage.removeItem(DRIVE_RELAY_FAIL_UNTIL_KEY);
  } catch {
    // Bỏ qua storage bị chặn.
  }
}'''
    text = replace_once(text, save_end, helpers, "thêm Drive relay cooldown helper")

    text = replace_once(
        text,
        '''    if (!fileId || directCandidates.length === 0) {
      setMode("iframe");
      setFallbackReason(
        "Không lấy được file ID từ link Drive, đang dùng player Drive dự phòng."
      );
      return;
    }

    setMode("probing");''',
        '''    if (!fileId || directCandidates.length === 0) {
      setMode("iframe");
      setFallbackReason(
        "Không lấy được file ID từ link Drive, đang dùng player Drive dự phòng."
      );
      return;
    }

    // BAOFLIX_PERF_PHASE1: relay vừa timeout thì đừng bắt tập kế tiếp chờ lại.
    if (isDriveRelayCoolingDown()) {
      setMode("iframe");
      setFallbackReason(
        "Drive Relay vừa phản hồi chậm, tạm dùng iframe để vào phim nhanh hơn."
      );
      return;
    }

    setMode("probing");''',
        "bỏ probe khi relay đang cooldown",
    )

    text = replace_once(
        text,
        '''    const timeout = window.setTimeout(() => {
      tryNextCandidate("Nguồn direct tải quá lâu.");
    }, PROBE_TIMEOUT_MS);''',
        '''    const timeout = window.setTimeout(() => {
      tryNextCandidate("Nguồn direct tải quá lâu.", true);
    }, PROBE_TIMEOUT_MS);''',
        "ghi nhớ Drive relay timeout",
    )

    text = replace_once(
        text,
        '''  function tryNextCandidate(reason: string) {
    const nextIndex = candidateIndex + 1;

    if (nextIndex < directCandidates.length) {
      setCandidateIndex(nextIndex);
      setFallbackReason(reason);
      return;
    }

    setMode("iframe");
    setFallbackReason(
      "Drive Relay không trả về video native. Đã chuyển sang iframe dự phòng."
    );
  }

  function handleProbeReady() {
    if (!activeCandidate) return;

    setNativeSrc(activeCandidate);
    setMode("native");
    setFallbackReason("");
  }''',
        '''  function tryNextCandidate(
    reason: string,
    rememberTimeout = false
  ) {
    const nextIndex = candidateIndex + 1;

    if (nextIndex < directCandidates.length) {
      setCandidateIndex(nextIndex);
      setFallbackReason(reason);
      return;
    }

    if (rememberTimeout) rememberDriveRelayTimeout();

    setMode("iframe");
    setFallbackReason(
      "Drive Relay không trả về video native. Đã chuyển sang iframe dự phòng."
    );
  }

  function handleProbeReady() {
    if (!activeCandidate) return;

    clearDriveRelayTimeout();
    setNativeSrc(activeCandidate);
    setMode("native");
    setFallbackReason("");
  }''',
        "Drive fallback/cooldown",
    )

    return text, [
        "Drive native probe giảm 8s → 3.5s.",
        "Chỉ timeout mới kích hoạt cooldown 5 phút; lỗi codec/file không khóa relay.",
        "Probe thành công tự xóa cooldown.",
    ]


def patch_vercelignore(text: str) -> tuple[str, list[str]]:
    lines = text.splitlines()
    additions = ["*.bak", "*.py", ".patch-backups", "scripts", "tools", "docs", "android"]
    missing = [line for line in additions if line not in lines]
    if not missing:
        return text if text.endswith("\n") else text + "\n", [".vercelignore đã đủ Phase 1."]
    result = text.rstrip() + "\n\n# BAOFLIX_PERF_PHASE1: không gửi file dev/backup vào Vercel\n"
    result += "\n".join(missing) + "\n"
    return result, ["Loại .bak/.py/scripts/tools/docs/android khỏi deployment context."]


LOADING_TSX = r'''export default function Loading() {
  return (
    <div aria-live="polite" aria-busy="true" className="space-y-5 py-2">
      <div className="h-8 w-48 rounded-xl bg-white/10" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
        {Array.from({ length: 16 }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.035]"
          >
            <div className="aspect-[2/3] bg-white/[0.07]" />
            <div className="space-y-2 p-2">
              <div className="h-3 w-4/5 rounded bg-white/10" />
              <div className="h-2.5 w-1/2 rounded bg-white/[0.07]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
'''


def patch_loading(existing: str | None) -> tuple[str, list[str]]:
    if existing is not None:
        return existing, ["app/loading.tsx đã tồn tại; không ghi đè."]
    return LOADING_TSX, ["Tạo loading skeleton dùng chung cho chuyển route."]


def apply_patch(root: Path) -> tuple[dict[Path, str], list[str]]:
    outputs: dict[Path, str] = {}
    report: list[str] = []

    def load(path: Path) -> str:
        full = root / path
        if not full.is_file():
            raise PatchError(f"Thiếu file bắt buộc: {path}")
        return full.read_text(encoding="utf-8")

    patches = [
        (Path("package.json"), patch_package_json),
        (Path("components/CustomMoviesCloudSync.tsx"), patch_cloud_sync),
        (Path("lib/customMoviesRemote.ts"), patch_custom_movies_remote),
        (Path("lib/kkphim.ts"), patch_kkphim),
        (Path("components/Header.tsx"), patch_header),
        (Path("app/api/search-suggest/route.ts"), patch_search_route),
        (Path("components/CustomDrivePlayer.tsx"), patch_drive_player),
        (Path(".vercelignore"), patch_vercelignore),
    ]

    for path, patcher in patches:
        patched, notes = patcher(load(path))
        outputs[path] = patched
        report.append(f"\n[{path}]")
        report.extend(f"- {note}" for note in notes)

    loading_path = Path("app/loading.tsx")
    existing = (root / loading_path).read_text(encoding="utf-8") if (root / loading_path).is_file() else None
    patched_loading, notes = patch_loading(existing)
    outputs[loading_path] = patched_loading
    report.append(f"\n[{loading_path}]")
    report.extend(f"- {note}" for note in notes)
    return outputs, report


def make_backup(root: Path, changed: list[Path]) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = root / "backup" / f"performance-phase1-{stamp}"
    for relative in changed:
        source = root / relative
        if not source.is_file():
            continue
        destination = backup_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    return backup_root


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.phase1.tmp")
    temp.write_text(content, encoding="utf-8", newline="\n")
    os.replace(temp, path)


def run_command(command: list[str], cwd: Path) -> bool:
    print(f"\n$ {' '.join(command)}")
    completed = subprocess.run(command, cwd=cwd, check=False)
    return completed.returncode == 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Tối ưu hiệu năng BảoFlix Phase 1, không đụng overlay/navigator.")
    parser.add_argument("--repo", type=Path, default=Path.cwd(), help="Đường dẫn repo; mặc định thư mục hiện tại.")
    parser.add_argument("--dry-run", action="store_true", help="Kiểm tra patch nhưng không ghi file.")
    parser.add_argument("--verify", action="store_true", help="Sau khi vá chạy npm run lint và npm run build.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        root = find_repo_root(args.repo)
        for protected in PROTECTED:
            if protected in TARGETS:
                raise PatchError(f"Lỗi nội bộ: protected path nằm trong target: {protected}")

        outputs, report = apply_patch(root)
        changed: list[Path] = []
        for path, patched in outputs.items():
            full = root / path
            original = full.read_text(encoding="utf-8") if full.is_file() else None
            if original != patched:
                changed.append(path)

        print(f"Repo: {root}")
        print("\n".join(report))
        print("\nProtected (không sửa):")
        for path in PROTECTED:
            print(f"- {path}")

        if not changed:
            print("\nPhase 1 đã được áp dụng; không có file nào cần ghi.")
            return 0

        print("\nFile sẽ thay đổi:")
        for path in changed:
            print(f"- {path}")

        if args.dry_run:
            print("\nDry-run hoàn tất. Chưa ghi file.")
            return 0

        backup_root = make_backup(root, changed)
        for path in changed:
            atomic_write(root / path, outputs[path])

        print(f"\nBackup: {backup_root}")
        print("Đã áp dụng BảoFlix Performance Phase 1.")

        if args.verify:
            lint_ok = run_command(["npm", "run", "lint"], root)
            build_ok = run_command(["npm", "run", "build"], root)
            if not lint_ok or not build_ok:
                print("\nLint hoặc build chưa đạt. Bản cũ nằm trong thư mục backup.", file=sys.stderr)
                return 2
        return 0

    except PatchError as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1
    except (OSError, subprocess.SubprocessError) as error:
        print(f"LỖI HỆ THỐNG: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
