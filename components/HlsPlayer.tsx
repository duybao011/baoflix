"use client";

// BAOFLIX_CUSTOM_HLS_PERSONAL_PROGRESS

import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";
import { isTvModeActive } from "@/lib/tvMode";

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
const LOCAL_PROGRESS_SAVE_INTERVAL_MS = 10_000;
// BAOFLIX_CUSTOM_MOVIE_LAG_FIX

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
      .slice(0, 400);

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
          currentTime,
          duration,
          ended: duration > 0 && currentTime >= duration - 1,
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
  const captureNoticeTimerRef = useRef<number | null>(null);
  const [captureNotice, setCaptureNotice] = useState("");
  const [tvMode, setTvMode] = useState(false);

  useEffect(() => {
    function refreshTvMode() {
      setTvMode(isTvModeActive({ allowSessionOnDesktop: false }));
    }

    refreshTvMode();
    window.addEventListener("baoflix-tv-mode-change", refreshTvMode);
    window.addEventListener("storage", refreshTvMode);
    window.addEventListener("focus", refreshTvMode);

    return () => {
      window.removeEventListener("baoflix-tv-mode-change", refreshTvMode);
      window.removeEventListener("storage", refreshTvMode);
      window.removeEventListener("focus", refreshTvMode);
      if (captureNoticeTimerRef.current !== null) {
        window.clearTimeout(captureNoticeTimerRef.current);
      }
    };
  }, []);

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

      if (
        now - lastSaveRef.current <
        LOCAL_PROGRESS_SAVE_INTERVAL_MS
      ) {
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

  // BAOFLIX_PERSONAL_SCREENSHOT_V2_HLS
  function showCaptureNotice(message: string) {
    setCaptureNotice(message);
    if (captureNoticeTimerRef.current !== null) {
      window.clearTimeout(captureNoticeTimerRef.current);
    }
    captureNoticeTimerRef.current = window.setTimeout(() => {
      setCaptureNotice("");
      captureNoticeTimerRef.current = null;
    }, 2600);
  }

  function captureVideoFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      showCaptureNotice("Phim chưa sẵn sàng để chụp.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      showCaptureNotice("Trình duyệt không hỗ trợ chụp ảnh.");
      return;
    }

    try {
      // Chỉ xuất pixel của video; không vẽ sub hoặc nút điều khiển.
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          showCaptureNotice("Không thể tạo ảnh từ nguồn phim này.");
          return;
        }

        const capturedAt = new Date()
          .toISOString()
          .replace(/\.\d{3}Z$/, "")
          .replace(/[T:]/g, "-");
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `baoflix-phim-rieng-${capturedAt}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        showCaptureNotice("Đã lưu ảnh khung hình.");
      }, "image/png");
    } catch {
      showCaptureNotice("Nguồn phim này không cho phép chụp ảnh.");
    }
  }

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        controls
        playsInline
        tabIndex={0}
        data-tv-player="video"
        data-tv-skip
        className="h-full w-full bg-black object-contain outline-none"
      />

      {!tvMode && (
        <button
          type="button"
          onClick={captureVideoFrame}
          className="absolute right-3 top-3 z-30 rounded-xl border border-white/15 bg-black/65 p-2 text-white shadow-xl backdrop-blur hover:bg-black/85"
          aria-label="Chụp khung hình phim"
          title="Chụp khung hình phim"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3h5Z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </button>
      )}

      {captureNotice && !tvMode && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute left-3 top-3 z-40 max-w-[70vw] rounded-xl bg-black/75 px-3 py-2 text-sm font-bold text-white shadow-2xl backdrop-blur"
        >
          {captureNotice}
        </div>
      )}
    </div>
  );
}
