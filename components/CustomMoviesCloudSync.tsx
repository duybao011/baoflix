"use client";

import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  CUSTOM_MOVIES_CHANGE_EVENT,
  type CustomMoviesChangeDetail,
} from "@/lib/customMoviesClient";
import { syncCustomMoviesBidirectional } from "@/lib/customMoviesRemote";

export default function CustomMoviesCloudSync() {
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const queuedRef = useRef(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();

    async function runSync() {
      if (!active) return;

      if (runningRef.current) {
        queuedRef.current = true;
        return;
      }

      runningRef.current = true;

      try {
        await syncCustomMoviesBidirectional();
      } catch (error) {
        console.warn("[BảoFlix] Đồng bộ Supabase thất bại:", error);
      } finally {
        runningRef.current = false;

        if (queuedRef.current && active) {
          queuedRef.current = false;
          scheduleSync(250);
        }
      }
    }

    function scheduleSync(delay = 450) {
      if (!active) return;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void runSync();
      }, delay);
    }

    function handleLocalChange(event: Event) {
      const detail = (event as CustomEvent<CustomMoviesChangeDetail>).detail;
      scheduleSync(detail?.type === "delete" ? 80 : 350);
    }

    function handleStorage(event: StorageEvent) {
      if (
        event.key === "baoflix_custom_movies" ||
        event.key === "baoflix_custom_movies_pending_deletes"
      ) {
        scheduleSync(250);
      }
    }

    function handleFocus() {
      scheduleSync(200);
    }

    function handleOnline() {
      scheduleSync(50);
    }

    window.addEventListener(CUSTOM_MOVIES_CHANGE_EVENT, handleLocalChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        scheduleSync(50);
      }
    });

    scheduleSync(100);

    return () => {
      active = false;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      subscription.unsubscribe();
      window.removeEventListener(
        CUSTOM_MOVIES_CHANGE_EVENT,
        handleLocalChange
      );
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
