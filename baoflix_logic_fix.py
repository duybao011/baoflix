#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import subprocess
import sys
from pathlib import Path


def fail(msg: str) -> None:
    raise RuntimeError(msg)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"[{label}] expected 1 match, found {count}")
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    a = text.find(start)
    if a < 0:
        fail(f"[{label}] start marker not found")
    b = text.find(end, a + len(start))
    if b < 0:
        fail(f"[{label}] end marker not found")
    return text[:a] + replacement + text[b:]


def find_root(start: Path) -> Path:
    start = start.resolve()
    for p in (start, *start.parents):
        if (p / "package.json").exists() and (p / "lib").exists() and (p / "components").exists():
            return p
    fail("Không tìm thấy root repo BảoFlix.")


def read(root: Path, rel: str) -> str:
    path = root / rel
    if not path.exists():
        fail(f"Thiếu file: {rel}")
    return path.read_text(encoding="utf-8")


def write(root: Path, rel: str, data: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(data, encoding="utf-8", newline="\n")


ACCOUNT_LOCAL_STATE = r'''"use client";

const ACTIVE_USER_KEY = "baoflix_active_sync_user_v1";
const SNAPSHOT_PREFIX = "baoflix_account_snapshot_v1:";
const ANONYMOUS_SCOPE = "anonymous";

const PERSONAL_KEYS = [
  "baoflix_history",
  "baoflix_history_tombstones_v1",
  "baoflix_watched_episodes",
  "baoflix_video_progress_v1",
  "baoflix_custom_movies",
  "baoflix_custom_movies_pending_deletes",
] as const;

type Snapshot = Record<string, string>;

function snapshotKey(scopeId: string) {
  return `${SNAPSHOT_PREFIX}${scopeId}`;
}

function readSnapshot(scopeId: string): Snapshot {
  try {
    const raw = localStorage.getItem(snapshotKey(scopeId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Snapshot)
      : {};
  } catch {
    return {};
  }
}

function isPersonalKey(key: string) {
  return (
    (PERSONAL_KEYS as readonly string[]).includes(key) ||
    key.startsWith("baoflix_custom_watch_time_") ||
    key.endsWith(":subtitle-choice") ||
    key.endsWith(":iframe-estimate")
  );
}

function getPersonalKeysInStorage() {
  const keys = new Set<string>(PERSONAL_KEYS as readonly string[]);

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && isPersonalKey(key)) keys.add(key);
  }

  return Array.from(keys);
}

function saveCurrentScope(scopeId: string) {
  const snapshot: Snapshot = {};

  getPersonalKeysInStorage().forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) snapshot[key] = value;
  });

  localStorage.setItem(snapshotKey(scopeId), JSON.stringify(snapshot));
}

function clearPersonalKeys() {
  getPersonalKeysInStorage().forEach((key) => localStorage.removeItem(key));
}

function restoreScope(scopeId: string) {
  const snapshot = readSnapshot(scopeId);
  clearPersonalKeys();

  Object.entries(snapshot).forEach(([key, value]) => {
    if (isPersonalKey(key)) localStorage.setItem(key, value);
  });
}

function notifyScopeChanged() {
  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new Event("baoflix-watch-store-change"));
  window.dispatchEvent(new Event("baoflix-custom-movies-synced"));
}

export function ensureLocalStateForUser(userId: string) {
  const cleanUserId = String(userId || "").trim();
  if (!cleanUserId) return false;

  const activeUser = localStorage.getItem(ACTIVE_USER_KEY);

  // Lần đầu sau khi nâng cấp: giữ nguyên dữ liệu local hiện tại và gán cho user đang đăng nhập.
  if (!activeUser) {
    localStorage.setItem(ACTIVE_USER_KEY, cleanUserId);
    saveCurrentScope(cleanUserId);
    return false;
  }

  if (activeUser === cleanUserId) return false;

  saveCurrentScope(activeUser);
  restoreScope(cleanUserId);
  localStorage.setItem(ACTIVE_USER_KEY, cleanUserId);
  notifyScopeChanged();
  return true;
}

export function switchLocalStateToAnonymous() {
  const activeUser = localStorage.getItem(ACTIVE_USER_KEY);
  if (!activeUser) return false;

  saveCurrentScope(activeUser);
  restoreScope(ANONYMOUS_SCOPE);
  localStorage.setItem(ACTIVE_USER_KEY, ANONYMOUS_SCOPE);
  notifyScopeChanged();
  return true;
}
'''


def patch_watch_store(text: str) -> str:
    text = replace_once(
        text,
        'export const HISTORY_KEY = "baoflix_history";\nexport const WATCHED_KEY = "baoflix_watched_episodes";',
        'export const HISTORY_KEY = "baoflix_history";\nexport const HISTORY_TOMBSTONES_KEY = "baoflix_history_tombstones_v1";\nexport const WATCHED_KEY = "baoflix_watched_episodes";',
        "watchStore constants",
    )

    text = replace_once(
        text,
        '  if (key === HISTORY_KEY || key === WATCHED_KEY) {',
        '  if (\n    key === HISTORY_KEY ||\n    key === HISTORY_TOMBSTONES_KEY ||\n    key === WATCHED_KEY\n  ) {',
        "watchStore event keys",
    )

    marker = 'function getHistoryGroupKey(item: WatchHistoryItem) {'
    insert = r'''export type WatchHistoryTombstones = Record<string, string>;

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

'''
    if marker not in text:
        fail("[watchStore tombstones] marker not found")
    text = text.replace(marker, insert + marker, 1)

    text = replace_once(
        text,
        '''export function applySyncedWatchState(
  history: WatchHistoryItem[],
  watchedEpisodes: string[]
) {''',
        '''export function applySyncedWatchState(
  history: WatchHistoryItem[],
  watchedEpisodes: string[],
  tombstones: WatchHistoryTombstones = readWatchHistoryTombstones()
) {''',
        "watchStore apply signature",
    )

    text = replace_once(
        text,
        '''  const oldWatched = readJson<string[]>(
    WATCHED_KEY,
    []
  );

  let changed = false;''',
        '''  const oldWatched = readJson<string[]>(
    WATCHED_KEY,
    []
  );
  const oldTombstones = readWatchHistoryTombstones();

  let changed = false;''',
        "watchStore old tombstones",
    )

    text = replace_once(
        text,
        '''  if (
    JSON.stringify(oldWatched) !== JSON.stringify(nextWatched)
  ) {
    localStorage.setItem(
      WATCHED_KEY,
      JSON.stringify(nextWatched)
    );
    changed = true;
  }

  if (changed) {''',
        '''  if (
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

  if (changed) {''',
        "watchStore apply tombstones",
    )

    text = replace_once(
        text,
        '''export function clearWatchHistory() {
  writeJson(HISTORY_KEY, []);
}''',
        '''export function clearWatchHistory() {
  const history = readWatchHistory();
  const deletedAt = new Date().toISOString();
  const tombstones = { ...readWatchHistoryTombstones() };

  history.forEach((item) => {
    tombstones[item.slug] = deletedAt;
  });

  writeWatchHistoryTombstones(tombstones);
  writeJson(HISTORY_KEY, []);
}''',
        "watchStore clear",
    )

    text = replace_once(
        text,
        '''  // Vì lịch sử đã gộp theo slug, xóa 1 phim là xóa luôn mọi biến thể normal/custom cùng slug.
  const next = history.filter((item) => item.slug !== input.slug);

  writeJson(HISTORY_KEY, next);''',
        '''  // Vì lịch sử đã gộp theo slug, xóa 1 phim là xóa luôn mọi biến thể normal/custom cùng slug.
  const next = history.filter((item) => item.slug !== input.slug);

  rememberWatchHistoryDeletion(input.slug);
  writeJson(HISTORY_KEY, next);''',
        "watchStore remove",
    )

    save_old = '''  const next = normalizeWatchHistory([
    item,
    ...history.filter((old) => old.slug !== item.slug),
  ]).slice(0, 200);

  writeJson(HISTORY_KEY, next);'''
    save_new = '''  const next = normalizeWatchHistory([
    item,
    ...history.filter((old) => old.slug !== item.slug),
  ]).slice(0, 200);

  clearWatchHistoryDeletion(item.slug);
  writeJson(HISTORY_KEY, next);'''
    text = replace_once(text, save_old, save_new, "watchStore save normal")
    text = replace_once(text, save_old, save_new, "watchStore save custom")
    return text


def patch_cloud_sync(text: str) -> str:
    text = replace_once(
        text,
        '''import {
  applySyncedWatchState,
  normalizeWatchHistory,
  readWatchHistory,
  readWatchedEpisodes,
  WATCH_STORE_CHANGE_EVENT,
  type WatchHistoryItem,
} from "@/lib/watchStore";''',
        '''import {
  applySyncedWatchState,
  readWatchHistory,
  readWatchHistoryTombstones,
  readWatchedEpisodes,
  resolveWatchHistoryWithTombstones,
  WATCH_STORE_CHANGE_EVENT,
  type WatchHistoryItem,
  type WatchHistoryTombstones,
} from "@/lib/watchStore";
import {
  ensureLocalStateForUser,
  switchLocalStateToAnonymous,
} from "@/lib/accountLocalState";''',
        "cloud imports",
    )

    text = replace_once(
        text,
        '''const PLAYBACK_PROGRESS_SYNCED_EVENT =
  "baoflix-playback-progress-synced";''',
        '''const PLAYBACK_PROGRESS_SYNCED_EVENT =
  "baoflix-playback-progress-synced";
const HISTORY_DELETE_PROGRESS_PREFIX =
  "__baoflix_history_deleted__:";''',
        "cloud prefix",
    )

    text = replace_once(text, ".slice(0, 120)\n  );", ".slice(0, 400)\n  );", "cloud progress cap")

    marker = 'function stableProgressJson(map: ProgressMap) {'
    helpers = r'''function mergeTombstones(a: WatchHistoryTombstones, b: WatchHistoryTombstones) {
  const merged: WatchHistoryTombstones = { ...a };

  Object.entries(b).forEach(([slug, deletedAt]) => {
    const oldTime = Date.parse(merged[slug] || "");
    const nextTime = Date.parse(deletedAt || "");
    if (!Number.isFinite(nextTime)) return;
    if (!Number.isFinite(oldTime) || nextTime > oldTime) merged[slug] = deletedAt;
  });

  return merged;
}

function tombstonesToProgressMap(tombstones: WatchHistoryTombstones): ProgressMap {
  return Object.fromEntries(
    Object.entries(tombstones).map(([slug, deletedAt]) => [
      `${HISTORY_DELETE_PROGRESS_PREFIX}${encodeURIComponent(slug)}`,
      {
        currentTime: 0,
        duration: 0,
        updatedAt: deletedAt,
        title: "BảoFlix history tombstone",
        subtitle: slug,
      } satisfies StoredVideoProgress,
    ])
  );
}

function tombstonesFromProgressMap(map: ProgressMap): WatchHistoryTombstones {
  const result: WatchHistoryTombstones = {};

  Object.entries(map).forEach(([key, value]) => {
    if (!key.startsWith(HISTORY_DELETE_PROGRESS_PREFIX)) return;
    try {
      const slug = decodeURIComponent(key.slice(HISTORY_DELETE_PROGRESS_PREFIX.length));
      if (slug) result[slug] = value.updatedAt;
    } catch {}
  });

  return result;
}

function withoutHistoryDeleteMarkers(map: ProgressMap): ProgressMap {
  return Object.fromEntries(
    Object.entries(map).filter(([key]) => !key.startsWith(HISTORY_DELETE_PROGRESS_PREFIX))
  );
}

'''
    if marker not in text:
        fail("[cloud helpers] marker not found")
    text = text.replace(marker, helpers + marker, 1)

    text = replace_once(
        text,
        '''        if (userError) throw userError;
        if (!user) return;

        const { data, error } = await supabase''',
        '''        if (userError) throw userError;
        if (!user) return;

        ensureLocalStateForUser(user.id);

        const { data, error } = await supabase''',
        "cloud user scope",
    )

    old = '''        const localHistory = readWatchHistory();
        const localWatched = readWatchedEpisodes();
        const localProgress = readLocalProgressMap();

        const mergedHistory = normalizeWatchHistory([
          ...localHistory,
          ...remoteHistory,
        ]).slice(0, 200);

        const mergedWatched = mergeWatched(
          localWatched,
          remoteWatched
        );

        const mergedProgress = mergeProgressMaps(
          localProgress,
          remoteProgress
        );

        applySyncedWatchState(
          mergedHistory,
          mergedWatched
        );
        applySyncedProgressMap(mergedProgress);'''

    new = '''        const localHistory = readWatchHistory();
        const localWatched = readWatchedEpisodes();
        const localTombstones = readWatchHistoryTombstones();
        const localProgress = mergeProgressMaps(
          readLocalProgressMap(),
          tombstonesToProgressMap(localTombstones)
        );

        const mergedWatched = mergeWatched(localWatched, remoteWatched);
        let mergedProgress = mergeProgressMaps(localProgress, remoteProgress);

        const mergedTombstones = mergeTombstones(
          localTombstones,
          tombstonesFromProgressMap(mergedProgress)
        );

        const resolvedHistory = resolveWatchHistoryWithTombstones(
          [...localHistory, ...remoteHistory],
          mergedTombstones
        );
        const mergedHistory = resolvedHistory.history.slice(0, 200);

        mergedProgress = mergeProgressMaps(
          withoutHistoryDeleteMarkers(mergedProgress),
          tombstonesToProgressMap(resolvedHistory.tombstones)
        );

        applySyncedWatchState(
          mergedHistory,
          mergedWatched,
          resolvedHistory.tombstones
        );
        applySyncedProgressMap(mergedProgress);'''
    text = replace_once(text, old, new, "cloud merge")

    text = replace_once(
        text,
        '''    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        schedule(100, true);
      } else if (event === "TOKEN_REFRESHED") {
        schedule(500, false);
      }
    });''',
        '''    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        ensureLocalStateForUser(session.user.id);
        lastCompletedRef.current = 0;
        schedule(100, true);
      } else if (event === "SIGNED_OUT") {
        switchLocalStateToAnonymous();
        lastCompletedRef.current = 0;
      } else if (event === "TOKEN_REFRESHED") {
        schedule(500, false);
      }
    });''',
        "cloud auth change",
    )
    return text


def patch_custom_remote(text: str) -> str:
    text = replace_once(
        text,
        'import { getSupabaseClient } from "@/lib/supabaseClient";',
        'import { getSupabaseClient } from "@/lib/supabaseClient";\nimport { ensureLocalStateForUser } from "@/lib/accountLocalState";',
        "custom remote import",
    )
    return replace_once(
        text,
        '''  if (!user) {
    return null;
  }

  const localMovies = readCustomMovies();''',
        '''  if (!user) {
    return null;
  }

  ensureLocalStateForUser(user.id);

  const localMovies = readCustomMovies();''',
        "custom remote scope",
    )


def patch_account_panel(text: str) -> str:
    text = replace_once(
        text,
        'import { syncCustomMoviesBidirectional } from "@/lib/customMoviesRemote";',
        'import { syncCustomMoviesBidirectional } from "@/lib/customMoviesRemote";\nimport { switchLocalStateToAnonymous } from "@/lib/accountLocalState";',
        "account import",
    )
    return replace_once(
        text,
        '''      if (error) {
        setStatus(`Không đăng xuất được: ${error.message}`);
        return;
      }

      setUser(null);''',
        '''      if (error) {
        setStatus(`Không đăng xuất được: ${error.message}`);
        return;
      }

      switchLocalStateToAnonymous();
      setUser(null);''',
        "account signout",
    )


def patch_drive_url(text: str) -> str:
    replacement = r'''export function driveToPreviewUrl(url: string) {
  const raw = url.trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname.toLowerCase();
    const isGoogleDrive =
      hostname === "drive.google.com" || hostname.endsWith(".drive.google.com");

    if (!isGoogleDrive) return raw;

    const fileMatch = parsed.pathname.match(/\/file\/d\/([^/?#]+)/i);
    if (fileMatch?.[1]) {
      return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }

    const id = parsed.searchParams.get("id")?.trim();
    if (id) {
      return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
    }
  } catch {
    return raw;
  }

  return raw;
}

'''
    return replace_between(
        text,
        'export function driveToPreviewUrl(url: string) {',
        'export type EpisodeLinkCheck = {',
        replacement,
        "drive url",
    )


def patch_native_player(text: str) -> str:
    text = replace_once(
        text,
        '''        detail: {
          progressKey,
          updatedAt: progress.updatedAt,
        },''',
        '''        detail: {
          progressKey,
          updatedAt: progress.updatedAt,
          currentTime: progress.currentTime,
          duration: progress.duration,
          ended:
            progress.duration > 0 &&
            progress.currentTime >= progress.duration - 1,
        },''',
        "native progress detail",
    )
    return replace_once(text, ".slice(0, 120);", ".slice(0, 400);", "native cap")


def patch_hls_player(text: str) -> str:
    text = replace_once(
        text,
        '''        detail: {
          progressKey: storageKey,
          updatedAt: nextMap[storageKey]?.updatedAt,
        },''',
        '''        detail: {
          progressKey: storageKey,
          updatedAt: nextMap[storageKey]?.updatedAt,
          currentTime,
          duration,
          ended: duration > 0 && currentTime >= duration - 1,
        },''',
        "hls progress detail",
    )
    return replace_once(text, ".slice(0, 120);", ".slice(0, 400);", "hls cap")


NORMAL_OLD = r'''  useEffect(() => {
    const next = saveWatchedEpisode(currentWatchedKey);
    setWatchedEpisodes(next);

    saveNormalWatchHistory({
      movie,
      serverIndex: safeServerIndex,
      episodeIndex: safeEpisodeIndex,
      serverName: currentServer?.server_name,
      episodeName: episode?.name,
    });
  }, [
    currentWatchedKey,
    movie,
    safeServerIndex,
    safeEpisodeIndex,
    currentServer?.server_name,
    episode?.name,
  ]);'''

NORMAL_NEW = r'''  useEffect(() => {
    let historySaved = false;
    let watchedSaved = readWatchedEpisodes().includes(currentWatchedKey);
    let visibleSeconds = 0;

    function saveHistoryOnce() {
      if (historySaved) return;
      historySaved = true;
      saveNormalWatchHistory({
        movie,
        serverIndex: safeServerIndex,
        episodeIndex: safeEpisodeIndex,
        serverName: currentServer?.server_name,
        episodeName: episode?.name,
      });
    }

    function markWatchedOnce() {
      if (watchedSaved) return;
      watchedSaved = true;
      setWatchedEpisodes(saveWatchedEpisode(currentWatchedKey));
    }

    function handleProgress(event: Event) {
      const detail = (
        event as CustomEvent<{
          progressKey?: string;
          currentTime?: number;
          duration?: number;
          ended?: boolean;
        }>
      ).detail;

      if (detail?.progressKey !== currentWatchedKey) return;
      const currentTime = Number(detail.currentTime || 0);
      const duration = Number(detail.duration || 0);

      if (currentTime >= 5) saveHistoryOnce();
      if (detail.ended || (duration > 0 && currentTime / duration >= 0.9)) {
        saveHistoryOnce();
        markWatchedOnce();
      }
    }

    const fallbackTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      visibleSeconds += 3;
      if (visibleSeconds >= 12) saveHistoryOnce();
    }, 3000);

    window.addEventListener(
      "baoflix-playback-progress-change",
      handleProgress as EventListener
    );

    return () => {
      window.clearInterval(fallbackTimer);
      window.removeEventListener(
        "baoflix-playback-progress-change",
        handleProgress as EventListener
      );
    };
  }, [
    currentWatchedKey,
    movie,
    safeServerIndex,
    safeEpisodeIndex,
    currentServer?.server_name,
    episode?.name,
  ]);'''

CUSTOM_OLD = r'''  useEffect(() => {
    const next = saveWatchedEpisode(currentWatchedKey);
    setWatchedEpisodes(next);

    saveCustomWatchHistory({
      movie,
      seasonIndex: safeSeasonIndex,
      episodeIndex: safeIndex,
      seasonName: currentSeason?.server_name,
      episodeName: episode?.name,
    });
  }, [
    currentWatchedKey,
    movie,
    safeSeasonIndex,
    safeIndex,
    currentSeason?.server_name,
    episode?.name,
  ]);'''

CUSTOM_NEW = r'''  useEffect(() => {
    let historySaved = false;
    let watchedSaved = readWatchedEpisodes().includes(currentWatchedKey);
    let visibleSeconds = 0;

    function saveHistoryOnce() {
      if (historySaved) return;
      historySaved = true;
      saveCustomWatchHistory({
        movie,
        seasonIndex: safeSeasonIndex,
        episodeIndex: safeIndex,
        seasonName: currentSeason?.server_name,
        episodeName: episode?.name,
      });
    }

    function markWatchedOnce() {
      if (watchedSaved) return;
      watchedSaved = true;
      setWatchedEpisodes(saveWatchedEpisode(currentWatchedKey));
    }

    function handleProgress(event: Event) {
      const detail = (
        event as CustomEvent<{
          progressKey?: string;
          currentTime?: number;
          duration?: number;
          ended?: boolean;
        }>
      ).detail;

      const customProgressBaseKey =
        `baoflix_custom_watch_time_${movie.slug}_season_${safeSeasonIndex}_episode_${safeIndex}`;
      const progressKey = String(detail?.progressKey || "");

      if (
        progressKey !== currentWatchedKey &&
        progressKey !== customProgressBaseKey &&
        progressKey !== `${customProgressBaseKey}_drive_native`
      ) {
        return;
      }

      const currentTime = Number(detail.currentTime || 0);
      const duration = Number(detail.duration || 0);

      if (currentTime >= 5) saveHistoryOnce();
      if (detail.ended || (duration > 0 && currentTime / duration >= 0.9)) {
        saveHistoryOnce();
        markWatchedOnce();
      }
    }

    const fallbackTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      visibleSeconds += 3;
      if (visibleSeconds >= 12) saveHistoryOnce();
    }, 3000);

    window.addEventListener(
      "baoflix-playback-progress-change",
      handleProgress as EventListener
    );

    return () => {
      window.clearInterval(fallbackTimer);
      window.removeEventListener(
        "baoflix-playback-progress-change",
        handleProgress as EventListener
      );
    };
  }, [
    currentWatchedKey,
    movie,
    safeSeasonIndex,
    safeIndex,
    currentSeason?.server_name,
    episode?.name,
  ]);'''


def patch_watch_client(text: str) -> str:
    return replace_once(text, NORMAL_OLD, NORMAL_NEW, "normal watch behavior")


def patch_custom_watch(text: str) -> str:
    return replace_once(text, CUSTOM_OLD, CUSTOM_NEW, "custom watch behavior")


def patch_kkphim(text: str) -> str:
    text = replace_once(text, '  if (!list.length) return true;', '  if (!list.length) return false;', "taxonomy missing")

    old_animation = '''async function getAggregatedAnimationBySubtype(
  page: number,
  limit: number,
  filters: Partial<FilterValues>,
  subtype?: string
): Promise<MovieListResult> {
  const firstResult = await getMoviesByList(
    "hoat-hinh",
    1,
    ANIMATION_SOURCE_LIMIT,
    filters
  );

  const totalSourcePages = Number(firstResult.pagination?.totalPages || 1);

  const sourcePagesToFetch = Math.min(
    totalSourcePages,
    ANIMATION_AGGREGATE_SOURCE_PAGES
  );

  const otherResults = await Promise.allSettled(
    Array.from({ length: Math.max(0, sourcePagesToFetch - 1) }, (_, index) => {
      const sourcePage = index + 2;

      return getMoviesByList(
        "hoat-hinh",
        sourcePage,
        ANIMATION_SOURCE_LIMIT,
        filters
      );
    })
  );

  const allItems = uniqueMovies([
    ...(firstResult.items || []),
    ...otherResults.flatMap((result) => {
      if (result.status !== "fulfilled") return [];
      return result.value.items || [];
    }),
  ]);

  const filteredResult = filterAnimationSubtype(
    {
      ...firstResult,
      items: allItems,
    },
    subtype
  );

  const paginated = paginateLocalMovies(filteredResult.items, page, limit);

  return {
    ...filteredResult,
    items: paginated.items,
    pagination: paginated.pagination,
  };
}

'''

    new_animation = '''async function getAggregatedAnimationBySubtype(
  page: number,
  limit: number,
  filters: Partial<FilterValues>,
  subtype?: string
): Promise<MovieListResult> {
  const firstResult = await getMoviesByList(
    "hoat-hinh",
    1,
    ANIMATION_SOURCE_LIMIT,
    filters
  );

  const totalSourcePages = Number(firstResult.pagination?.totalPages || 1);
  const targetCount = Math.max(1, page) * Math.max(1, limit);

  let sourcePage = 2;
  let allItems = uniqueMovies(firstResult.items || []);
  let filteredResult = filterAnimationSubtype(
    { ...firstResult, items: allItems },
    subtype
  );

  while (
    sourcePage <= totalSourcePages &&
    (sourcePage <= ANIMATION_AGGREGATE_SOURCE_PAGES ||
      filteredResult.items.length < targetCount)
  ) {
    const batchPages = Array.from(
      { length: Math.min(3, totalSourcePages - sourcePage + 1) },
      (_, index) => sourcePage + index
    );

    const batch = await Promise.allSettled(
      batchPages.map((sourcePageNumber) =>
        getMoviesByList(
          "hoat-hinh",
          sourcePageNumber,
          ANIMATION_SOURCE_LIMIT,
          filters
        )
      )
    );

    allItems = uniqueMovies([
      ...allItems,
      ...batch.flatMap((result) =>
        result.status === "fulfilled" ? result.value.items || [] : []
      ),
    ]);

    filteredResult = filterAnimationSubtype(
      { ...firstResult, items: allItems },
      subtype
    );

    sourcePage += batchPages.length;
  }

  const paginated = paginateLocalMovies(filteredResult.items, page, limit);
  const hasMoreSourcePages = sourcePage <= totalSourcePages;

  return {
    ...filteredResult,
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
    text = replace_once(text, old_animation, new_animation, "animation pagination")

    text = replace_once(
        text,
        '''  // BAOFLIX_PERF_PHASE1: query từng nhóm độc lập, không nhân category × country.
  const sourcePageCount = Math.max(
    2,
    Math.min(MULTI_FILTER_SOURCE_PAGES, page + 1)
  );''',
        '''  // Fetch ít nhất tới page hiện tại; fixed 3 pages làm page 4+ bị sai.
  const sourcePageCount = Math.max(2, page + 1);''',
        "multi-filter pages",
    )
    text = replace_once(
        text,
        'const MULTI_FILTER_SOURCE_PAGES = 3;\nconst MULTI_FILTER_SOURCE_LIMIT = 40;',
        'const MULTI_FILTER_SOURCE_LIMIT = 40;',
        "multi-filter cap const",
    )

    old_tasks = '''  if (type && type !== "tat-ca") {
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
  }'''

    new_tasks = '''  if (categorySlugs.length && countrySlugs.length) {
    categorySlugs.forEach((categorySlug) => {
      countrySlugs.forEach((countrySlug) => {
        sourcePages.forEach((sourcePage) => {
          if (type && type !== "tat-ca") {
            tasks.push(
              getMoviesByList(type, sourcePage, sourceLimit, {
                ...baseFilters,
                category: categorySlug,
                country: countrySlug,
              })
            );
          } else {
            tasks.push(
              getMoviesByGenre(categorySlug, sourcePage, sourceLimit, {
                ...baseFilters,
                country: countrySlug,
              })
            );
          }
        });
      });
    });
  } else if (type && type !== "tat-ca") {
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
  }'''
    text = replace_once(text, old_tasks, new_tasks, "multi-filter paired queries")

    old_return = '''  const sortedItems = sortLocalMoviesByFilter(subtypeFilteredItems, filters);
  const paginated = paginateLocalMovies(sortedItems, page, limit);

  return {
    title: getMultiFilterTitle(categorySlugs, countrySlugs, type),
    items: paginated.items,
    pagination: paginated.pagination,
  };'''
    new_return = '''  const sortedItems = sortLocalMoviesByFilter(subtypeFilteredItems, filters);
  const paginated = paginateLocalMovies(sortedItems, page, limit);
  const hasMoreSourcePages = results.some((result) => {
    if (result.status !== "fulfilled") return false;
    return Number(result.value.pagination?.totalPages || 0) > sourcePageCount;
  });

  return {
    title: getMultiFilterTitle(categorySlugs, countrySlugs, type),
    items: paginated.items,
    pagination: {
      ...paginated.pagination,
      totalPages: hasMoreSourcePages
        ? Math.max(paginated.pagination.totalPages || 1, page + 1)
        : paginated.pagination.totalPages,
    },
  };'''
    return replace_once(text, old_return, new_return, "multi-filter pagination result")


def patch_my_taste(text: str) -> str:
    old = '''  try {
    if (country) {
      const countryResult = await getMoviesByCountry(country, 1, 24);
      results.push(...(countryResult.items || []));
    }

    if (category) {
      const categoryResult = await getMoviesByGenre(category, 1, 24);
      results.push(...(categoryResult.items || []));
    }

    return NextResponse.json({
      items: uniqueMovies(results).slice(0, 24),
    });'''
    new = '''  try {
    if (country && category) {
      const combinedResult = await getMoviesByCountry(country, 1, 24, {
        category,
      });
      results.push(...(combinedResult.items || []));
    } else if (country) {
      const countryResult = await getMoviesByCountry(country, 1, 24);
      results.push(...(countryResult.items || []));
    } else if (category) {
      const categoryResult = await getMoviesByGenre(category, 1, 24);
      results.push(...(categoryResult.items || []));
    }

    return NextResponse.json({
      items: uniqueMovies(results).slice(0, 24),
    });'''
    return replace_once(text, old, new, "my taste")


def build(root: Path) -> dict[str, str]:
    return {
        "lib/accountLocalState.ts": ACCOUNT_LOCAL_STATE,
        "lib/watchStore.ts": patch_watch_store(read(root, "lib/watchStore.ts")),
        "lib/customMoviesClient.ts": patch_drive_url(read(root, "lib/customMoviesClient.ts")),
        "lib/customMoviesRemote.ts": patch_custom_remote(read(root, "lib/customMoviesRemote.ts")),
        "components/WatchHistoryCloudSync.tsx": patch_cloud_sync(read(root, "components/WatchHistoryCloudSync.tsx")),
        "components/SupabaseAccountPanel.tsx": patch_account_panel(read(root, "components/SupabaseAccountPanel.tsx")),
        "components/NativeVideoPlayer.tsx": patch_native_player(read(root, "components/NativeVideoPlayer.tsx")),
        "components/HlsPlayer.tsx": patch_hls_player(read(root, "components/HlsPlayer.tsx")),
        "components/WatchClient.tsx": patch_watch_client(read(root, "components/WatchClient.tsx")),
        "app/ca-nhan/[slug]/xem/page.tsx": patch_custom_watch(read(root, "app/ca-nhan/[slug]/xem/page.tsx")),
        "lib/kkphim.ts": patch_kkphim(read(root, "lib/kkphim.ts")),
        "app/api/my-taste/route.ts": patch_my_taste(read(root, "app/api/my-taste/route.ts")),
    }


def backup(root: Path, rels: list[str], backup_dir: Path) -> None:
    for rel in rels:
        src = root / rel
        if not src.exists():
            continue
        dst = backup_dir / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def restore(root: Path, rels: list[str], backup_dir: Path) -> None:
    for rel in rels:
        src = backup_dir / rel
        dst = root / rel
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        elif rel == "lib/accountLocalState.ts" and dst.exists():
            dst.unlink()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check", action="store_true", help="run npm lint + build after patch")
    args = parser.parse_args()

    root = find_root(args.root)
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    print(f"Repo: {root}")
    if package.get("name") != "baoflix":
        print(f"Cảnh báo package name: {package.get('name')}")

    patched = build(root)  # all marker validation happens before writing
    changed = [rel for rel, data in patched.items() if not (root / rel).exists() or (root / rel).read_text(encoding="utf-8") != data]

    print("Files sẽ đổi:")
    for rel in changed:
        print(" -", rel)

    if args.dry_run:
        print("Dry-run OK. Không ghi file.")
        return 0
    if not changed:
        print("Không có gì để patch.")
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = root / f".baoflix_patch_backup_{stamp}"
    backup(root, changed, backup_dir)
    print("Backup:", backup_dir)

    try:
        for rel in changed:
            write(root, rel, patched[rel])

        if args.check:
            for cmd in (["npm", "run", "lint"], ["npm", "run", "build"]):
                print("$", " ".join(cmd))
                code = subprocess.run(cmd, cwd=root).returncode
                if code != 0:
                    fail(f"Command failed: {' '.join(cmd)}")
        else:
            print("Patch xong. Nên chạy: npm run lint && npm run build")

        print("OK.")
        return 0
    except Exception as exc:
        print("Patch lỗi, rollback:", exc, file=sys.stderr)
        restore(root, changed, backup_dir)
        print("Đã rollback.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print("PATCH ABORTED:", exc, file=sys.stderr)
        raise SystemExit(2)
