\"use client\";

// BAOFLIX_PERSONAL_HISTORY_SYNC

import { useEffect, useRef } from \"react\";
import { getSupabaseClient } from \"@/lib/supabaseClient\";
import { isTvModeActive } from \"@/lib/tvMode\";
import {
  applySyncedWatchState,
  normalizeWatchHistory,
  readWatchHistory,
  readWatchedEpisodes,
  WATCH_STORE_CHANGE_EVENT,
  type WatchHistoryItem,
} from \"@/lib/watchStore\";

const TABLE = \"watch_history_sync\";
const SYNC_GROUP = \"personal\";
const MIN_SYNC_INTERVAL_MS = 5000;
const PERIODIC_SYNC_MS = 60000;

function isTvSession() {
  if (typeof window === \"undefined\") return false;

  return (
    window.location.pathname === \"/tv\" ||
    isTvModeActive({ allowSessionOnDesktop: true })
  );
}

function normalizeRemoteHistory(value: unknown): WatchHistoryItem[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is WatchHistoryItem =>
      Boolean(
        item &&
          typeof item === \"object\" &&
          typeof (item as WatchHistoryItem).slug === \"string\"
      )
  );
}

function normalizeRemoteWatched(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === \"string\" && Boolean(item)
  );
}

function mergeWatched(local: string[], remote: string[]) {
  return Array.from(new Set([...local, ...remote])).slice(0, 5000);
}

export default function WatchHistoryCloudSync() {
  const timerRef = useRef<number | null>(null);
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
          .select(\"history,watched_episodes\")
          .eq(\"user_id\", user.id)
          .eq(\"sync_group\", SYNC_GROUP)
          .maybeSingle();

        if (error) throw error;

        const remoteHistory = normalizeRemoteHistory(data?.history);
        const remoteWatched = normalizeRemoteWatched(
          data?.watched_episodes
        );

        const localHistory = readWatchHistory();
        const localWatched = readWatchedEpisodes();

        const mergedHistory = normalizeWatchHistory([
          ...localHistory,
          ...remoteHistory,
        ]).slice(0, 200);

        const mergedWatched = mergeWatched(
          localWatched,
          remoteWatched
        );

        applySyncedWatchState(
          mergedHistory,
          mergedWatched
        );

        const remoteChanged =
          !data ||
          JSON.stringify(remoteHistory) !==
            JSON.stringify(mergedHistory) ||
          JSON.stringify(remoteWatched) !==
            JSON.stringify(mergedWatched);

        if (remoteChanged) {
          const { error: upsertError } = await supabase
            .from(TABLE)
            .upsert(
              {
                user_id: user.id,
                sync_group: SYNC_GROUP,
                history: mergedHistory,
                watched_episodes: mergedWatched,
                updated_at: new Date().toISOString(),
              },
              { onConflict: \"user_id,sync_group\" }
            );

          if (upsertError) throw upsertError;
        }

        lastCompletedRef.current = Date.now();
      } catch (error) {
        console.warn(
          \"[BảoFlix] History sync thất bại:\",
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

    function handleFocus() {
      schedule(400, false);
    }

    function handleOnline() {
      schedule(150, true);
    }

    function handleTvModeChange() {
      schedule(400, true);
    }

    window.addEventListener(
      WATCH_STORE_CHANGE_EVENT,
      handleLocalChange
    );
    window.addEventListener(\"focus\", handleFocus);
    window.addEventListener(\"online\", handleOnline);
    window.addEventListener(
      \"baoflix-tv-mode-change\",
      handleTvModeChange
    );

    const interval = window.setInterval(() => {
      void sync(false);
    }, PERIODIC_SYNC_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === \"SIGNED_IN\") {
        schedule(100, true);
      } else if (event === \"TOKEN_REFRESHED\") {
        schedule(500, false);
      }
    });

    schedule(1600, false);

    return () => {
      active = false;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      window.clearInterval(interval);
      subscription.unsubscribe();

      window.removeEventListener(
        WATCH_STORE_CHANGE_EVENT,
        handleLocalChange
      );
      window.removeEventListener(\"focus\", handleFocus);
      window.removeEventListener(\"online\", handleOnline);
      window.removeEventListener(
        \"baoflix-tv-mode-change\",
        handleTvModeChange
      );
    };
  }, []);

  return null;
}
