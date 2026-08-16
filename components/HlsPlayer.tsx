"use client";

// BAOFLIX_CUSTOM_HLS_PERSONAL_PROGRESS

import Hls from "hls.js";
import { useEffect, useRef } from "react";

type HlsPlayerProps = {
  src: string;
  storageKey?: string;
  autoResume?: boolean;
};

type StoredVideoProgress = {
  currentTime: number;
  duration: number;
  updatedAt: string;
};

type ProgressMap = Record<string, StoredVideoProgress>;

const VIDEO_PROGRESS_KEY = "baoflix_video_progress_v1";
const PLAYBACK_PROGRESS_CHANGE_EVENT =
  "baoflix-playback-progress-change";
const PLAYBACK_PROGRESS_URGENT_EVENT =
  "baoflix-playback-progress-urgent";
const PLAYBACK_PROGRESS_SYNCED_EVENT =
  "baoflix-playback-progress-synced";

function emitPlaybackEvent(type: "playing" | "paused") {
  try {
    window.dispatchEvent(new Event(`baoflix-tv-player-${type}`));
    window.dispatchEvent(
      new CustomEvent("baoflix-tv-player-state", {
        detail: {
          playing: type === "playing",
          paused: type === "paused",
        },
      })
    );
  } catch {
    // Ignore if the runtime blocks CustomEvent for any reason.
  }
}

function readProgressMap(): ProgressMap {
  try {
    const raw = localStorage.getItem(VIDEO_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    return parsed && typeof parsed === "object"
      ? (parsed as ProgressMap)
      : {};
  } catch {
    return {};
  }
}

function readCloudProgress(storageKey?: string) {
  if (!storageKey) return null;

  const item = readProgressMap()[storageKey];
  if (!item || typeof item !== "object") return null;

  const currentTime = Number(item.currentTime || 0);
  const duration = Number(item.duration || 0);
  const updatedAt = String(item.updatedAt || "");

  if (
    !Number.isFinite(currentTime) ||
    currentTime < 0 ||
    !updatedAt ||
    !Number.isFinite(Date.parse(updatedAt))
  ) {
    return null;
  }

  return {
    currentTime,
    duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
    updatedAt,
  };
}

function saveCloudProgress(
  storageKey: string | undefined,
  currentTime: number,
  duration: number
) {
  if (!storageKey) return;
  if (!Number.isFinite(currentTime) || currentTime < 1) return;

  try {
    const map = readProgressMap();

    map[storageKey] = {
      currentTime,
      duration:
        Number.isFinite(duration) && duration > 0
          ? duration
          : 0,
      updatedAt: new Date().toISOString(),
    };

    const trimmed = Object.entries(map)
      .sort(([, a], [, b]) => {
        return (
          Date.parse(b.updatedAt || "") -
          Date.parse(a.updatedAt || "")
        );
      })
      .slice(0, 120);

    const nextMap = Object.fromEntries(trimmed);

    localStorage.setItem(
      VIDEO_PROGRESS_KEY,
      JSON.stringify(nextMap)
    );

    window.dispatchEvent(
      new CustomEvent(PLAYBACK_PROGRESS_CHANGE_EVENT, {
        detail: {
          progressKey: storageKey,
          updatedAt: nextMap[storageKey]?.updatedAt,
        },
      })
    );
  } catch {
    // Bỏ qua lỗi storage.
  }
}

export default function HlsPlayer({
  src,
  storageKey,
  autoResume = true,
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasSeekedRef = useRef(false);
  const lastSaveRef = useRef(0);
  const sourceStartedAtRef = useRef(0);
  const lastAppliedUpdatedAtRef = useRef("");

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement || !src) return;

    const video = videoElement;

    hasSeekedRef.current = false;
    lastSaveRef.current = 0;
    sourceStartedAtRef.current = Date.now();
    lastAppliedUpdatedAtRef.current = "";

    function getLegacySavedTime() {
      if (!storageKey || !autoResume) return 0;

      try {
        const raw = localStorage.getItem(storageKey);
        const value = raw ? Number(raw) : 0;

        return Number.isFinite(value) && value > 5
          ? value
          : 0;
      } catch {
        return 0;
      }
    }

    function applySavedTime(
      seconds: number,
      updatedAt = ""
    ) {
      if (!Number.isFinite(seconds) || seconds <= 5) {
        return false;
      }

      const duration = Number.isFinite(video.duration)
        ? video.duration
        : 0;

      if (duration > 0 && seconds >= duration - 3) {
        return false;
      }

      try {
        video.currentTime =
          duration > 0
            ? Math.min(seconds, Math.max(duration - 3, 0))
            : seconds;

        hasSeekedRef.current = true;

        if (updatedAt) {
          lastAppliedUpdatedAtRef.current = updatedAt;
        }

        return true;
      } catch {
        return false;
      }
    }

    function seekToSavedTime() {
      if (hasSeekedRef.current || !autoResume) return;

      const cloud = readCloudProgress(storageKey);

      if (
        cloud &&
        applySavedTime(cloud.currentTime, cloud.updatedAt)
      ) {
        return;
      }

      applySavedTime(getLegacySavedTime());
    }

    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;

      video.addEventListener(
        "loadedmetadata",
        seekToSavedTime
      );
      video.addEventListener("canplay", seekToSavedTime);
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        seekToSavedTime();
      });

      video.addEventListener(
        "loadedmetadata",
        seekToSavedTime
      );
      video.addEventListener("canplay", seekToSavedTime);
    } else {
      video.src = src;
    }

    function saveTimeNow(urgent = false) {
      if (!storageKey) return;
      if (!video.currentTime || video.currentTime < 1) return;

      const currentTime = video.currentTime;
      const duration = Number.isFinite(video.duration)
        ? video.duration
        : 0;

      try {
        // Giữ key raw cũ để không làm mất resume local đời trước.
        localStorage.setItem(
          storageKey,
          String(Math.floor(currentTime))
        );
      } catch {
        // bỏ qua lỗi localStorage
      }

      saveCloudProgress(
        storageKey,
        currentTime,
        duration
      );

      const cloud = readCloudProgress(storageKey);
      lastAppliedUpdatedAtRef.current =
        cloud?.updatedAt || lastAppliedUpdatedAtRef.current;

      if (urgent) {
        window.dispatchEvent(
          new Event(PLAYBACK_PROGRESS_URGENT_EVENT)
        );
      }
    }

    function saveTimeThrottled() {
      const now = Date.now();

      if (now - lastSaveRef.current < 3000) {
        return;
      }

      lastSaveRef.current = now;
      saveTimeNow(false);
    }

    function saveTimeUrgent() {
      saveTimeNow(true);
    }

    function handleSyncedProgress(event: Event) {
      if (!storageKey || !autoResume) return;

      const detail = (
        event as CustomEvent<{ keys?: string[] }>
      ).detail;

      if (
        Array.isArray(detail?.keys) &&
        !detail.keys.includes(storageKey)
      ) {
        return;
      }

      // Chỉ auto-reseek trong cửa sổ khởi động.
      // Tránh đang xem giữa chừng lại bị thiết bị khác kéo timeline.
      if (
        Date.now() - sourceStartedAtRef.current >
        15000
      ) {
        return;
      }

      const cloud = readCloudProgress(storageKey);
      if (!cloud) return;

      const incomingStamp = Date.parse(
        cloud.updatedAt || ""
      );
      const appliedStamp = Date.parse(
        lastAppliedUpdatedAtRef.current || ""
      );

      if (!Number.isFinite(incomingStamp)) return;

      if (
        Number.isFinite(appliedStamp) &&
        incomingStamp <= appliedStamp
      ) {
        return;
      }

      applySavedTime(
        cloud.currentTime,
        cloud.updatedAt
      );
    }

    function handlePlay() {
      emitPlaybackEvent("playing");
    }

    function handlePause() {
      if (video.ended) return;
      emitPlaybackEvent("paused");
      saveTimeUrgent();
    }

    function handleEnded() {
      saveTimeUrgent();
    }

    video.addEventListener(
      "timeupdate",
      saveTimeThrottled
    );
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("play", handlePlay);

    window.addEventListener(
      PLAYBACK_PROGRESS_SYNCED_EVENT,
      handleSyncedProgress as EventListener
    );

    return () => {
      saveTimeUrgent();

      video.removeEventListener(
        "timeupdate",
        saveTimeThrottled
      );
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener(
        "loadedmetadata",
        seekToSavedTime
      );
      video.removeEventListener(
        "canplay",
        seekToSavedTime
      );

      window.removeEventListener(
        PLAYBACK_PROGRESS_SYNCED_EVENT,
        handleSyncedProgress as EventListener
      );

      if (hls) {
        hls.destroy();
      }
    };
  }, [src, storageKey, autoResume]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      tabIndex={0}
      data-tv-player="video"
      data-tv-skip
      className="h-full w-full bg-black object-contain outline-none"
    />
  );
}
