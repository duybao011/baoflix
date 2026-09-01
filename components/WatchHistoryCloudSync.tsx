"use client";

// BAOFLIX_PERSONAL_HISTORY_SYNC
// BAOFLIX_PLAYBACK_PROGRESS_SYNC

import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { isTvModeActive } from "@/lib/tvMode";
import {
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
} from "@/lib/accountLocalState";

const TABLE = "watch_history_sync";
const SYNC_GROUP = "personal";
const VIDEO_PROGRESS_KEY = "baoflix_video_progress_v1";
const PLAYBACK_PROGRESS_CHANGE_EVENT =
  "baoflix-playback-progress-change";
const PLAYBACK_PROGRESS_URGENT_EVENT =
  "baoflix-playback-progress-urgent";
const PLAYBACK_PROGRESS_SYNCED_EVENT =
  "baoflix-playback-progress-synced";
const HISTORY_DELETE_PROGRESS_PREFIX =
  "__baoflix_history_deleted__:";

const MIN_SYNC_INTERVAL_MS = 5000;
const PERIODIC_SYNC_MS = 60000;
const PROGRESS_SYNC_DELAY_MS = 12000;

// BAOFLIX_JWT_FUTURE_RETRY
const JWT_FUTURE_RETRY_DELAYS_MS = [1500, 5000] as const;
const JWT_FUTURE_FINAL_RETRY_MS = 15000;

function isJwtIssuedAtFutureError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: unknown;
    message?: unknown;
  };

  return (
    String(candidate.code || "") === "PGRST303" &&
    String(candidate.message || "")
      .toLowerCase()
      .includes("jwt issued at future")
  );
}

function waitForJwtClockSkew(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

async function withJwtFutureRetry<
  T extends { error: unknown }
>(
  operation: () => PromiseLike<T>,
  label: string
): Promise<T> {
  let result = await operation();

  for (
    let attempt = 0;
    attempt < JWT_FUTURE_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    if (!isJwtIssuedAtFutureError(result.error)) {
      return result;
    }

    const delayMs =
      JWT_FUTURE_RETRY_DELAYS_MS[attempt];

    console.info(
      `[BảoFlix] Supabase JWT clock-skew tạm thời (${label}); ` +
        `thử lại sau ${delayMs}ms.`
    );

    await waitForJwtClockSkew(delayMs);
    result = await operation();
  }

  return result;
}

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
      .slice(0, 400)
  );
}

function mergeTombstones(a: WatchHistoryTombstones, b: WatchHistoryTombstones) {
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
        // BAOFLIX_PERF_PHASE2A_AUTH_SESSION_GATE
        // getSession() đọc session local trước. Guest không còn gọi getUser()
        // ra Auth server chỉ để nhận AuthSessionMissingError.
        // Data API phía dưới vẫn dùng JWT/RLS của Supabase như cũ.
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const user = session?.user;
        if (!user) {
          lastCompletedRef.current = Date.now();
          return;
        }

        ensureLocalStateForUser(user.id);

        const { data, error } = await withJwtFutureRetry(
          () =>
            supabase
              .from(TABLE)
              .select(
                "history,watched_episodes,playback_progress"
              )
              .eq("user_id", user.id)
              .eq("sync_group", SYNC_GROUP)
              .maybeSingle(),
          "history/progress select"
        );

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
          const { error: upsertError } =
            await withJwtFutureRetry(
              () =>
                supabase
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
                  ),
              "history/progress upsert"
            );

          if (upsertError) throw upsertError;
        }

        lastCompletedRef.current = Date.now();
      } catch (error) {
        if (isJwtIssuedAtFutureError(error)) {
          queuedRef.current = false;
          lastCompletedRef.current = Date.now();

          console.info(
            "[BảoFlix] Supabase JWT vẫn lệch clock sau retry; " +
              "hoãn cloud sync 15 giây. Local history/progress vẫn được giữ."
          );

          schedule(JWT_FUTURE_FINAL_RETRY_MS, true);
        } else {
          console.warn(
            "[BảoFlix] History/progress sync thất bại:",
            error
          );
        }
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        ensureLocalStateForUser(session.user.id);
        lastCompletedRef.current = 0;
        schedule(100, true);
      } else if (event === "SIGNED_OUT") {
        switchLocalStateToAnonymous();
        lastCompletedRef.current = 0;
      } else if (event === "TOKEN_REFRESHED") {
        // Tránh chọc Data API ngay sát thời điểm Auth vừa phát JWT mới.
        schedule(1800, false);
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
