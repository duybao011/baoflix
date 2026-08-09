"use client";

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
