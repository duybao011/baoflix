"use client";

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
