#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BảoFlix - đồng bộ playback progress PC local <-> điện thoại Vercel.

Mục tiêu:
- Dùng cùng hàng public.watch_history_sync đã có.
- Thêm playback_progress JSONB, merge từng progressKey theo updatedAt.
- PC/điện thoại đồng bộ; TV Mode vẫn bị loại hoàn toàn.
- NativeVideoPlayer phát event khi progress local đổi.
- Khi cloud progress mới về sau khi player đã mount, player có thể seek lại trong
  cửa sổ khởi động ngắn để resume đúng vị trí.
- Trên PC/điện thoại, ưu tiên HLS native nếu episode có link_m3u8 để đọc currentTime.
  Nếu episode không có link_m3u8 thì vẫn dùng iframe như cũ.

KHÔNG sửa:
- components/TvRemoteNavigator.tsx
- components/TvWatchOverlay.tsx
- components/TvRemoteKeyBridge.tsx
- components/TvPlayerCommandBridge.tsx

Trước khi chạy:
1. Chạy BaoFlix_Playback_Progress_Supabase.sql trong Supabase SQL Editor.
2. Chạy dry-run.

Lệnh:
    python BaoFlix_Playback_Progress_Sync.py --dry-run
    python BaoFlix_Playback_Progress_Sync.py
    python BaoFlix_Playback_Progress_Sync.py --verify
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

MARKER = "BAOFLIX_PLAYBACK_PROGRESS_SYNC"

PROTECTED = {
    Path("components/TvRemoteNavigator.tsx"),
    Path("components/TvWatchOverlay.tsx"),
    Path("components/TvRemoteKeyBridge.tsx"),
    Path("components/TvPlayerCommandBridge.tsx"),
}

TARGETS = {
    Path("components/WatchHistoryCloudSync.tsx"),
    Path("components/NativeVideoPlayer.tsx"),
    Path("components/WatchClient.tsx"),
}


class PatchError(RuntimeError):
    pass


def find_root(start: Path) -> Path:
    start = start.expanduser().resolve()
    for candidate in (start, *start.parents):
        if (
            (candidate / "package.json").is_file()
            and (candidate / "components/WatchHistoryCloudSync.tsx").is_file()
            and (candidate / "components/NativeVideoPlayer.tsx").is_file()
            and (candidate / "components/WatchClient.tsx").is_file()
        ):
            return candidate
    raise PatchError("Không tìm thấy root repo BảoFlix.")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise PatchError(
            f"Anchor '{label}' xuất hiện {count} lần; dừng để tránh sửa nhầm."
        )
    return text.replace(old, new, 1)


SYNC_COMPONENT = r'''"use client";

// BAOFLIX_PERSONAL_HISTORY_SYNC
// BAOFLIX_PLAYBACK_PROGRESS_SYNC

import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { isTvModeActive } from "@/lib/tvMode";
import {
  applySyncedWatchState,
  normalizeWatchHistory,
  readWatchHistory,
  readWatchedEpisodes,
  WATCH_STORE_CHANGE_EVENT,
  type WatchHistoryItem,
} from "@/lib/watchStore";

const TABLE = "watch_history_sync";
const SYNC_GROUP = "personal";
const VIDEO_PROGRESS_KEY = "baoflix_video_progress_v1";
const PLAYBACK_PROGRESS_CHANGE_EVENT =
  "baoflix-playback-progress-change";
const PLAYBACK_PROGRESS_URGENT_EVENT =
  "baoflix-playback-progress-urgent";
const PLAYBACK_PROGRESS_SYNCED_EVENT =
  "baoflix-playback-progress-synced";

const MIN_SYNC_INTERVAL_MS = 5000;
const PERIODIC_SYNC_MS = 60000;
const PROGRESS_SYNC_DELAY_MS = 12000;

type StoredVideoProgress = {
  currentTime: number;
  duration: number;
  updatedAt: string;
  title?: string;
  subtitle?: string;
};

type ProgressMap = Record<string, StoredVideoProgress>;

function isTvSession() {
  if (typeof window === "undefined") return false;

  return (
    window.location.pathname === "/tv" ||
    isTvModeActive({ allowSessionOnDesktop: true })
  );
}

function normalizeRemoteHistory(value: unknown): WatchHistoryItem[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is WatchHistoryItem =>
      Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as WatchHistoryItem).slug === "string"
      )
  );
}

function normalizeRemoteWatched(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === "string" && Boolean(item)
  );
}

function normalizeProgressMap(value: unknown): ProgressMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: ProgressMap = {};

  Object.entries(value as Record<string, unknown>).forEach(
    ([key, raw]) => {
      if (!raw || typeof raw !== "object") return;

      const item = raw as Partial<StoredVideoProgress>;
      const currentTime = Number(item.currentTime || 0);
      const duration = Number(item.duration || 0);
      const updatedAt = String(item.updatedAt || "");

      if (!key || !Number.isFinite(currentTime) || currentTime < 0) {
        return;
      }

      if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) {
        return;
      }

      result[key] = {
        currentTime,
        duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
        updatedAt,
        title:
          typeof item.title === "string" ? item.title : undefined,
        subtitle:
          typeof item.subtitle === "string"
            ? item.subtitle
            : undefined,
      };
    }
  );

  return result;
}

function readLocalProgressMap() {
  try {
    const raw = localStorage.getItem(VIDEO_PROGRESS_KEY);
    return normalizeProgressMap(raw ? JSON.parse(raw) : {});
  } catch {
    return {};
  }
}

function progressTimestamp(item?: StoredVideoProgress) {
  const value = Date.parse(item?.updatedAt || "");
  return Number.isFinite(value) ? value : 0;
}

function mergeProgressMaps(
  local: ProgressMap,
  remote: ProgressMap
): ProgressMap {
  const keys = new Set([
    ...Object.keys(local),
    ...Object.keys(remote),
  ]);

  const mergedEntries: [string, StoredVideoProgress][] = [];

  keys.forEach((key) => {
    const localItem = local[key];
    const remoteItem = remote[key];

    if (!localItem) {
      if (remoteItem) mergedEntries.push([key, remoteItem]);
      return;
    }

    if (!remoteItem) {
      mergedEntries.push([key, localItem]);
      return;
    }

    mergedEntries.push([
      key,
      progressTimestamp(localItem) >= progressTimestamp(remoteItem)
        ? localItem
        : remoteItem,
    ]);
  });

  return Object.fromEntries(
    mergedEntries
      .sort(
        ([, a], [, b]) =>
          progressTimestamp(b) - progressTimestamp(a)
      )
      .slice(0, 120)
  );
}

function stableProgressJson(map: ProgressMap) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
    )
  );
}

function applySyncedProgressMap(map: ProgressMap) {
  const current = readLocalProgressMap();

  if (stableProgressJson(current) === stableProgressJson(map)) {
    return false;
  }

  localStorage.setItem(
    VIDEO_PROGRESS_KEY,
    JSON.stringify(map)
  );

  window.dispatchEvent(
    new CustomEvent(PLAYBACK_PROGRESS_SYNCED_EVENT, {
      detail: {
        keys: Object.keys(map),
        at: new Date().toISOString(),
      },
    })
  );

  return true;
}

function mergeWatched(local: string[], remote: string[]) {
  return Array.from(new Set([...local, ...remote])).slice(0, 5000);
}

export default function WatchHistoryCloudSync() {
  const timerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const queuedRef = useRef(false);
  const lastCompletedRef = useRef(0);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();

    function schedule(delay = 800, force = false) {
      if (!active) return;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void sync(force);
      }, delay);
    }

    function scheduleProgressSync() {
      if (!active || isTvSession()) return;
      if (progressTimerRef.current !== null) return;

      progressTimerRef.current = window.setTimeout(() => {
        progressTimerRef.current = null;
        void sync(true);
      }, PROGRESS_SYNC_DELAY_MS);
    }

    async function sync(force = false) {
      if (!active || isTvSession()) return;

      if (
        !force &&
        lastCompletedRef.current &&
        Date.now() - lastCompletedRef.current < MIN_SYNC_INTERVAL_MS
      ) {
        return;
      }

      if (runningRef.current) {
        queuedRef.current = true;
        return;
      }

      runningRef.current = true;

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) return;

        const { data, error } = await supabase
          .from(TABLE)
          .select(
            "history,watched_episodes,playback_progress"
          )
          .eq("user_id", user.id)
          .eq("sync_group", SYNC_GROUP)
          .maybeSingle();

        if (error) throw error;

        const remoteHistory = normalizeRemoteHistory(data?.history);
        const remoteWatched = normalizeRemoteWatched(
          data?.watched_episodes
        );
        const remoteProgress = normalizeProgressMap(
          data?.playback_progress
        );

        const localHistory = readWatchHistory();
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
        applySyncedProgressMap(mergedProgress);

        const remoteChanged =
          !data ||
          JSON.stringify(remoteHistory) !==
            JSON.stringify(mergedHistory) ||
          JSON.stringify(remoteWatched) !==
            JSON.stringify(mergedWatched) ||
          stableProgressJson(remoteProgress) !==
            stableProgressJson(mergedProgress);

        if (remoteChanged) {
          const { error: upsertError } = await supabase
            .from(TABLE)
            .upsert(
              {
                user_id: user.id,
                sync_group: SYNC_GROUP,
                history: mergedHistory,
                watched_episodes: mergedWatched,
                playback_progress: mergedProgress,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id,sync_group" }
            );

          if (upsertError) throw upsertError;
        }

        lastCompletedRef.current = Date.now();
      } catch (error) {
        console.warn(
          "[BảoFlix] History/progress sync thất bại:",
          error
        );
      } finally {
        runningRef.current = false;

        if (queuedRef.current && active) {
          queuedRef.current = false;
          schedule(500, true);
        }
      }
    }

    function handleLocalChange() {
      schedule(900, false);
    }

    function handleProgressChange() {
      scheduleProgressSync();
    }

    function handleProgressUrgent() {
      if (progressTimerRef.current !== null) {
        window.clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      schedule(0, true);
    }

    function handleFocus() {
      schedule(300, true);
    }

    function handleOnline() {
      schedule(150, true);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        schedule(0, true);
      }
    }

    function handleTvModeChange() {
      schedule(400, true);
    }

    window.addEventListener(
      WATCH_STORE_CHANGE_EVENT,
      handleLocalChange
    );
    window.addEventListener(
      PLAYBACK_PROGRESS_CHANGE_EVENT,
      handleProgressChange
    );
    window.addEventListener(
      PLAYBACK_PROGRESS_URGENT_EVENT,
      handleProgressUrgent
    );
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    window.addEventListener(
      "baoflix-tv-mode-change",
      handleTvModeChange
    );

    const interval = window.setInterval(() => {
      void sync(false);
    }, PERIODIC_SYNC_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        schedule(100, true);
      } else if (event === "TOKEN_REFRESHED") {
        schedule(500, false);
      }
    });

    const onWatchPage =
      window.location.pathname.startsWith("/xem/") ||
      /\/ca-nhan\/[^/]+\/xem/.test(window.location.pathname);

    schedule(onWatchPage ? 50 : 1600, onWatchPage);

    return () => {
      active = false;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      if (progressTimerRef.current !== null) {
        window.clearTimeout(progressTimerRef.current);
      }

      window.clearInterval(interval);
      subscription.unsubscribe();

      window.removeEventListener(
        WATCH_STORE_CHANGE_EVENT,
        handleLocalChange
      );
      window.removeEventListener(
        PLAYBACK_PROGRESS_CHANGE_EVENT,
        handleProgressChange
      );
      window.removeEventListener(
        PLAYBACK_PROGRESS_URGENT_EVENT,
        handleProgressUrgent
      );
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener(
        "baoflix-tv-mode-change",
        handleTvModeChange
      );
    };
  }, []);

  return null;
}
'''


def patch_sync_component(text: str) -> str:
    if MARKER in text:
        return text

    if "BAOFLIX_PERSONAL_HISTORY_SYNC" not in text:
        raise PatchError(
            "WatchHistoryCloudSync.tsx chưa có personal history sync."
        )

    required = [
        'const TABLE = "watch_history_sync";',
        'const SYNC_GROUP = "personal";',
        '.select("history,watched_episodes")',
    ]
    for needle in required:
        if needle not in text:
            raise PatchError(
                f"WatchHistoryCloudSync.tsx thiếu anchor: {needle}"
            )

    return SYNC_COMPONENT


def patch_native_player(text: str) -> str:
    if MARKER in text:
        return text

    text = replace_once(
        text,
        'const VIDEO_PROGRESS_KEY = "baoflix_video_progress_v1";',
        'const VIDEO_PROGRESS_KEY = "baoflix_video_progress_v1";\n'
        'const PLAYBACK_PROGRESS_CHANGE_EVENT = "baoflix-playback-progress-change";\n'
        'const PLAYBACK_PROGRESS_URGENT_EVENT = "baoflix-playback-progress-urgent";\n'
        'const PLAYBACK_PROGRESS_SYNCED_EVENT = "baoflix-playback-progress-synced";\n'
        'const NATIVE_PLAYER_FATAL_EVENT = "baoflix-native-player-fatal";\n'
        '// BAOFLIX_PLAYBACK_PROGRESS_SYNC',
        "progress event constants",
    )

    old_save = '''    localStorage.setItem(
      VIDEO_PROGRESS_KEY,
      JSON.stringify(Object.fromEntries(trimmedEntries))
    );'''

    new_save = '''    localStorage.setItem(
      VIDEO_PROGRESS_KEY,
      JSON.stringify(Object.fromEntries(trimmedEntries))
    );

    window.dispatchEvent(
      new CustomEvent(PLAYBACK_PROGRESS_CHANGE_EVENT, {
        detail: {
          progressKey,
          updatedAt: progress.updatedAt,
        },
      })
    );'''

    text = replace_once(
        text,
        old_save,
        new_save,
        "dispatch progress change",
    )

    text = replace_once(
        text,
        '  const lastProgressSaveRef = useRef(0);',
        '  const lastProgressSaveRef = useRef(0);\n'
        '  const playerSourceStartedAtRef = useRef(Date.now());\n'
        '  const lastRestoredProgressUpdatedAtRef = useRef("");',
        "progress restore refs",
    )

    text = replace_once(
        text,
        '    lastProgressSaveRef.current = 0;',
        '    lastProgressSaveRef.current = 0;\n'
        '    playerSourceStartedAtRef.current = Date.now();\n'
        '    lastRestoredProgressUpdatedAtRef.current = "";',
        "reset restore refs",
    )

    text = replace_once(
        text,
        '''      const savedTime = Number(saved?.currentTime || 0);

      if (savedTime > 8 && (!duration || savedTime < duration - 8)) {''',
        '''      const savedTime = Number(saved?.currentTime || 0);
      lastRestoredProgressUpdatedAtRef.current =
        String(saved?.updatedAt || "");

      if (savedTime > 8 && (!duration || savedTime < duration - 8)) {''',
        "remember restored updatedAt",
    )

    old_pause_listeners = '''    video.addEventListener("timeupdate", saveProgressThrottled);
    video.addEventListener("pause", saveProgressNow);
    video.addEventListener("ended", saveProgressNow);'''

    new_pause_listeners = '''    function saveProgressUrgent() {
      saveProgressNow();
      window.dispatchEvent(
        new Event(PLAYBACK_PROGRESS_URGENT_EVENT)
      );
    }

    video.addEventListener("timeupdate", saveProgressThrottled);
    video.addEventListener("pause", saveProgressUrgent);
    video.addEventListener("ended", saveProgressUrgent);'''

    text = replace_once(
        text,
        old_pause_listeners,
        new_pause_listeners,
        "urgent progress listeners",
    )

    text = text.replace(
        'video.removeEventListener("pause", saveProgressNow);',
        'video.removeEventListener("pause", saveProgressUrgent);',
    )
    text = text.replace(
        'video.removeEventListener("ended", saveProgressNow);',
        'video.removeEventListener("ended", saveProgressUrgent);',
    )

    text = replace_once(
        text,
        '        setError("Không phát được HLS bằng player native. Hãy thử đổi nguồn.");',
        '''        setError("Không phát được HLS bằng player native. Đang thử player dự phòng...");
        window.dispatchEvent(
          new CustomEvent(NATIVE_PLAYER_FATAL_EVENT, {
            detail: {
              progressKey,
              src,
            },
          })
        );''',
        "native fatal fallback event",
    )

    anchor = '''  useEffect(() => {
    if (!tvMode) return;

    function onPlayerCommand(event: Event) {'''

    listener = r'''  useEffect(() => {
    if (!progressKey) return;

    function handleSyncedProgress(event: Event) {
      const video = videoRef.current;
      if (!video) return;

      const detail = (
        event as CustomEvent<{ keys?: string[] }>
      ).detail;

      if (
        Array.isArray(detail?.keys) &&
        !detail.keys.includes(progressKey)
      ) {
        return;
      }

      const saved = readVideoProgress(progressKey);
      if (!saved) return;

      const savedUpdatedAt = String(saved.updatedAt || "");
      const savedStamp = Date.parse(savedUpdatedAt);
      const restoredStamp = Date.parse(
        lastRestoredProgressUpdatedAtRef.current || ""
      );

      if (!Number.isFinite(savedStamp)) return;
      if (
        Number.isFinite(restoredStamp) &&
        savedStamp <= restoredStamp
      ) {
        return;
      }

      const savedTime = Number(saved.currentTime || 0);
      const duration = Number.isFinite(video.duration)
        ? video.duration
        : Number(saved.duration || 0);

      if (
        savedTime <= 8 ||
        (duration > 0 && savedTime >= duration - 8)
      ) {
        lastRestoredProgressUpdatedAtRef.current = savedUpdatedAt;
        return;
      }

      const difference = Math.abs(video.currentTime - savedTime);
      if (difference < 4) {
        lastRestoredProgressUpdatedAtRef.current = savedUpdatedAt;
        return;
      }

      const withinStartupWindow =
        Date.now() - playerSourceStartedAtRef.current < 12000;

      if (!withinStartupWindow && !video.paused) {
        return;
      }

      try {
        video.currentTime = savedTime;
        lastRestoredProgressUpdatedAtRef.current = savedUpdatedAt;
      } catch {
        // Stream chưa seek được; loadedmetadata/local restore vẫn là fallback.
      }
    }

    window.addEventListener(
      PLAYBACK_PROGRESS_SYNCED_EVENT,
      handleSyncedProgress as EventListener
    );

    return () => {
      window.removeEventListener(
        PLAYBACK_PROGRESS_SYNCED_EVENT,
        handleSyncedProgress as EventListener
      );
    };
  }, [progressKey]);

'''

    text = replace_once(
        text,
        anchor,
        listener + anchor,
        "cloud progress listener insertion",
    )

    return text


def patch_watch_client(text: str) -> str:
    if MARKER in text:
        return text

    text = replace_once(
        text,
        '''  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState<string[]>([]);
  const [tvOverlayEnabled, setTvOverlayEnabled] = useState(false);''',
        '''  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState<string[]>([]);
  const [tvOverlayEnabled, setTvOverlayEnabled] = useState(false);
  const [personalNativeFailed, setPersonalNativeFailed] = useState(false);''',
        "personal native fallback state",
    )

    text = replace_once(
        text,
        '''  const currentWatchedKey = getNormalWatchedKey(
    movie.slug,
    safeServerIndex,
    safeEpisodeIndex
  );

  useEffect(() => {''',
        '''  const currentWatchedKey = getNormalWatchedKey(
    movie.slug,
    safeServerIndex,
    safeEpisodeIndex
  );

  useEffect(() => {
    setPersonalNativeFailed(false);

    function handleNativeFatal(event: Event) {
      const detail = (
        event as CustomEvent<{ progressKey?: string }>
      ).detail;

      if (detail?.progressKey !== currentWatchedKey) return;
      setPersonalNativeFailed(true);
    }

    window.addEventListener(
      "baoflix-native-player-fatal",
      handleNativeFatal as EventListener
    );

    return () => {
      window.removeEventListener(
        "baoflix-native-player-fatal",
        handleNativeFatal as EventListener
      );
    };
  }, [currentWatchedKey]);

  useEffect(() => {''',
        "personal native fallback listener",
    )

    text = replace_once(
        text,
        '''  const useNormalNativePlayer =
    !tvOverlayEnabled && Boolean(nativeVideoUrl) && !episode?.link_embed;''',
        '''  // BAOFLIX_PLAYBACK_PROGRESS_SYNC:
  // PC/điện thoại ưu tiên HLS native khi có để đọc/seek currentTime chính xác.
  const useNormalNativePlayer =
    !tvOverlayEnabled &&
    Boolean(nativeVideoUrl) &&
    !personalNativeFailed;''',
        "personal native HLS preference",
    )

    old_block = '''            {useTvNativePlayer && nativeVideoUrl ? (
              <NativeVideoPlayer
                src={nativeVideoUrl}
                title={`${movie.name} - ${episode?.name || `Tập ${safeEpisodeIndex + 1}`}`}
                subtitle={normalizeServerName(currentServer?.server_name)}
                poster={posterUrl}
                progressKey={currentWatchedKey}
                tvMode
              />
            ) : episode?.link_embed ? (
              <iframe
                src={playerIframeSrc}
                tabIndex={tvOverlayEnabled ? -1 : 0}
                data-tv-player="iframe"
                data-tv-skip={tvOverlayEnabled ? true : undefined}
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                className={[
                  "h-full w-full bg-black outline-none",
                  tvOverlayEnabled ? "pointer-events-none" : "",
                ].join(" ")}
                title={`${movie.name} - ${episode.name}`}
              />
            ) : useNormalNativePlayer && nativeVideoUrl ? (
              <NativeVideoPlayer
                src={nativeVideoUrl}
                title={`${movie.name} - ${episode?.name || `Tập ${safeEpisodeIndex + 1}`}`}
                subtitle={normalizeServerName(currentServer?.server_name)}
                poster={posterUrl}
                progressKey={currentWatchedKey}
              />
            ) : ('''

    new_block = '''            {useTvNativePlayer && nativeVideoUrl ? (
              <NativeVideoPlayer
                src={nativeVideoUrl}
                title={`${movie.name} - ${episode?.name || `Tập ${safeEpisodeIndex + 1}`}`}
                subtitle={normalizeServerName(currentServer?.server_name)}
                poster={posterUrl}
                progressKey={currentWatchedKey}
                tvMode
              />
            ) : useNormalNativePlayer && nativeVideoUrl ? (
              <NativeVideoPlayer
                src={nativeVideoUrl}
                title={`${movie.name} - ${episode?.name || `Tập ${safeEpisodeIndex + 1}`}`}
                subtitle={normalizeServerName(currentServer?.server_name)}
                poster={posterUrl}
                progressKey={currentWatchedKey}
              />
            ) : episode?.link_embed ? (
              <iframe
                src={playerIframeSrc}
                tabIndex={tvOverlayEnabled ? -1 : 0}
                data-tv-player="iframe"
                data-tv-skip={tvOverlayEnabled ? true : undefined}
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                className={[
                  "h-full w-full bg-black outline-none",
                  tvOverlayEnabled ? "pointer-events-none" : "",
                ].join(" ")}
                title={`${movie.name} - ${episode.name}`}
              />
            ) : ('''

    text = replace_once(
        text,
        old_block,
        new_block,
        "reorder personal native player before iframe",
    )

    return text


def make_backup(root: Path, changed: list[Path]) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = root / "backup" / f"playback-progress-sync-{stamp}"

    for relative in changed:
        source = root / relative
        if not source.is_file():
            continue
        dest = target / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)

    return target


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.playback-sync.tmp")
    temp.write_text(content, encoding="utf-8", newline="\n")
    os.replace(temp, path)


def run(command: list[str], root: Path) -> bool:
    print(f"\n$ {' '.join(command)}")
    return subprocess.run(command, cwd=root, check=False).returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()

    try:
        root = find_root(args.repo)

        if TARGETS & PROTECTED:
            raise PatchError("Protected file nằm trong target.")

        outputs: dict[Path, str] = {}

        sync_path = Path("components/WatchHistoryCloudSync.tsx")
        native_path = Path("components/NativeVideoPlayer.tsx")
        watch_path = Path("components/WatchClient.tsx")

        outputs[sync_path] = patch_sync_component(
            (root / sync_path).read_text(encoding="utf-8")
        )
        outputs[native_path] = patch_native_player(
            (root / native_path).read_text(encoding="utf-8")
        )
        outputs[watch_path] = patch_watch_client(
            (root / watch_path).read_text(encoding="utf-8")
        )

        changed: list[Path] = []
        for relative, desired in outputs.items():
            current = (root / relative).read_text(encoding="utf-8")
            if current != desired:
                changed.append(relative)

        print(f"Repo: {root}")
        print("\nFile sẽ thay đổi:")
        for relative in changed:
            print(f"- {relative}")

        print("\nProtected - KHÔNG sửa:")
        for relative in sorted(PROTECTED, key=str):
            print(f"- {relative}")

        if not changed:
            print("\nPlayback progress sync đã được áp dụng.")
            return 0

        if args.dry_run:
            print("\nDry-run OK. Chưa ghi file.")
            return 0

        backup_dir = make_backup(root, changed)

        for relative in changed:
            atomic_write(root / relative, outputs[relative])

        print(f"\nBackup: {backup_dir}")
        print(
            "Đã áp dụng playback progress sync PC/điện thoại; TV vẫn tách riêng."
        )

        if args.verify:
            lint_ok = run(["npm", "run", "lint"], root)
            build_ok = run(["npm", "run", "build"], root)

            if not lint_ok or not build_ok:
                print(
                    "\nLint/build chưa đạt. Bản cũ nằm trong backup.",
                    file=sys.stderr,
                )
                return 2

        return 0

    except PatchError as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1
    except OSError as error:
        print(f"LỖI HỆ THỐNG: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
