"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ResolvedSubtitleTrack } from "@/lib/subtitleTools";

type PlayerCommandAction = "seek" | "toggle-play" | "play" | "pause" | "focus-player" | "cycle-subtitle";

type PlayerCommandDetail = {
  action: PlayerCommandAction;
  seconds?: number;
  handled?: boolean;
};

type NativeVideoPlayerProps = {
  src: string;
  title: string;
  subtitle?: string;
  poster?: string;
  progressKey?: string;
  subtitleTracks?: ResolvedSubtitleTrack[];
  /**
   * true: TV remote overlay điều khiển video, không hiện browser controls.
   * false: desktop/mobile dùng browser controls bình thường.
   */
  tvMode?: boolean;
};

const VIDEO_PROGRESS_KEY = "baoflix_video_progress_v1";
const PLAYBACK_PROGRESS_CHANGE_EVENT = "baoflix-playback-progress-change";
const PLAYBACK_PROGRESS_URGENT_EVENT = "baoflix-playback-progress-urgent";
const PLAYBACK_PROGRESS_SYNCED_EVENT = "baoflix-playback-progress-synced";
const NATIVE_PLAYER_FATAL_EVENT = "baoflix-native-player-fatal";
// BAOFLIX_PLAYBACK_PROGRESS_SYNC
const EMPTY_SUBTITLE_TRACKS: ResolvedSubtitleTrack[] = [];

type StoredVideoProgress = {
  currentTime: number;
  duration: number;
  updatedAt: string;
  title?: string;
  subtitle?: string;
};

function readProgressMap() {
  try {
    const raw = localStorage.getItem(VIDEO_PROGRESS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data as Record<string, StoredVideoProgress> : {};
  } catch {
    return {};
  }
}

function readVideoProgress(progressKey?: string) {
  if (!progressKey) return null;
  return readProgressMap()[progressKey] || null;
}

function saveVideoProgress(progressKey: string | undefined, progress: StoredVideoProgress) {
  if (!progressKey) return;
  if (!Number.isFinite(progress.currentTime) || progress.currentTime < 1) return;

  try {
    const map = readProgressMap();
    map[progressKey] = progress;

    const trimmedEntries = Object.entries(map)
      .sort(([, a], [, b]) => {
        return Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || "");
      })
      .slice(0, 400);

    localStorage.setItem(
      VIDEO_PROGRESS_KEY,
      JSON.stringify(Object.fromEntries(trimmedEntries))
    );

    window.dispatchEvent(
      new CustomEvent(PLAYBACK_PROGRESS_CHANGE_EVENT, {
        detail: {
          progressKey,
          updatedAt: progress.updatedAt,
          currentTime: progress.currentTime,
          duration: progress.duration,
          ended:
            progress.duration > 0 &&
            progress.currentTime >= progress.duration - 1,
        },
      })
    );
  } catch {
    // Ignore storage errors in restricted TV WebViews.
  }
}

const DEFAULT_SEEK_SECONDS = 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function emitHud(detail: {
  type: "seek" | "play" | "pause" | "subtitle";
  delta?: number;
  currentTime?: number;
  duration?: number;
  label?: string;
}) {
  window.dispatchEvent(
    new CustomEvent("baoflix-tv-player-hud", {
      detail,
    })
  );
}

function focusRemoteSurface() {
  window.dispatchEvent(new Event("baoflix-focus-tv-player-surface"));
}

function safeSetMediaSessionHandler(
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null
) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Một số TV WebView chỉ hỗ trợ một phần Media Session.
  }
}

export default function NativeVideoPlayer({
  src,
  title,
  subtitle,
  poster,
  progressKey,
  subtitleTracks = EMPTY_SUBTITLE_TRACKS,
  tvMode = false,
}: NativeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const userPausedRef = useRef(false);
  const autoplayDoneRef = useRef(false);
  const restoreDoneRef = useRef(false);
  const lastProgressSaveRef = useRef(0);
  const playerSourceStartedAtRef = useRef(0);
  const lastRestoredProgressUpdatedAtRef = useRef("");
  const [error, setError] = useState<string>("");
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState(-1);

  const attemptPlay = useCallback(
    async ({
      showError = false,
      forced = false,
    }: {
      showError?: boolean;
      forced?: boolean;
    } = {}) => {
      const video = videoRef.current;

      if (!video || !tvMode) return false;

      if (userPausedRef.current && !forced) {
        focusRemoteSurface();
        return false;
      }

      try {
        video.autoplay = true;
        await video.play();
        userPausedRef.current = false;
        autoplayDoneRef.current = true;
        setError("");
        focusRemoteSurface();
        return true;
      } catch {
        if (showError) {
          setError("TV chặn tự phát. Bấm OK một lần để phát video.");
        }

        focusRemoteSurface();
        return false;
      }
    },
    [tvMode]
  );

  const playVideo = useCallback(
    async ({ showError = true, showHud = true }: { showError?: boolean; showHud?: boolean } = {}) => {
      const played = await attemptPlay({ showError, forced: true });

      if (played && showHud) {
        emitHud({ type: "play" });
      }
    },
    [attemptPlay]
  );

  const pauseVideo = useCallback(() => {
    const video = videoRef.current;

    if (!video || !tvMode) return;

    userPausedRef.current = true;
    video.pause();
    focusRemoteSurface();
    emitHud({ type: "pause" });
  }, [tvMode]);

  const seekVideo = useCallback((seconds: number) => {
    const video = videoRef.current;

    if (!video || !tvMode) return;

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const maxTime = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    const nextTime = clamp(video.currentTime + seconds, 0, maxTime);

    video.currentTime = nextTime;
    focusRemoteSurface();

    emitHud({
      type: "seek",
      delta: seconds,
      currentTime: nextTime,
      duration,
    });
  }, [tvMode]);

  const applySubtitleMode = useCallback((index: number) => {
    const video = videoRef.current;
    if (!video) return;

    Array.from(video.textTracks).forEach((track, trackIndex) => {
      track.mode = trackIndex === index ? "showing" : "disabled";
    });
  }, []);

  const cycleSubtitle = useCallback(() => {
    if (!subtitleTracks.length) {
      emitHud({ type: "subtitle", label: "Không có phụ đề" });
      return;
    }

    const nextIndex =
      activeSubtitleIndex >= subtitleTracks.length - 1
        ? -1
        : activeSubtitleIndex + 1;

    setActiveSubtitleIndex(nextIndex);
    window.setTimeout(() => applySubtitleMode(nextIndex), 0);

    if (progressKey) {
      try {
        localStorage.setItem(
          `${progressKey}:subtitle-choice`,
          String(nextIndex)
        );
      } catch {}
    }

    emitHud({
      type: "subtitle",
      label:
        nextIndex < 0
          ? "Phụ đề: Tắt"
          : `Phụ đề: ${subtitleTracks[nextIndex]?.label || "Bật"}`,
    });
  }, [
    activeSubtitleIndex,
    applySubtitleMode,
    progressKey,
    subtitleTracks,
  ]);

  useEffect(() => {
    let nextIndex = subtitleTracks.findIndex((track) => track.default);
    if (nextIndex < 0 && subtitleTracks.length) nextIndex = 0;

    if (progressKey) {
      try {
        const stored = localStorage.getItem(
          `${progressKey}:subtitle-choice`
        );
        if (stored !== null) {
          const parsed = Number(stored);
          if (
            Number.isInteger(parsed) &&
            parsed >= -1 &&
            parsed < subtitleTracks.length
          ) {
            nextIndex = parsed;
          }
        }
      } catch {}
    }

    setActiveSubtitleIndex(nextIndex);

    const sync = () => applySubtitleMode(nextIndex);
    const video = videoRef.current;
    sync();

    const timers = [
      window.setTimeout(sync, 50),
      window.setTimeout(sync, 250),
      window.setTimeout(sync, 800),
    ];

    video?.addEventListener("loadedmetadata", sync);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      video?.removeEventListener("loadedmetadata", sync);
    };
  }, [applySubtitleMode, progressKey, subtitleTracks]);

  const handleCommand = useCallback(
    (detail: PlayerCommandDetail) => {
      if (!tvMode) return;

      detail.handled = true;

      if (detail.action === "focus-player") {
        // Chỉ trả focus về bề mặt remote. Không được tự play lại khi user đã pause.
        focusRemoteSurface();
        return;
      }

      if (detail.action === "cycle-subtitle") {
        cycleSubtitle();
        focusRemoteSurface();
        return;
      }

      if (detail.action === "seek") {
        seekVideo(detail.seconds || DEFAULT_SEEK_SECONDS);
        return;
      }

      if (detail.action === "toggle-play") {
        const video = videoRef.current;

        if (!video) return;

        if (video.paused) {
          void playVideo({ showError: true, showHud: true });
        } else {
          pauseVideo();
        }

        return;
      }

      if (detail.action === "play") {
        void playVideo({ showError: true, showHud: true });
        return;
      }

      if (detail.action === "pause") {
        pauseVideo();
      }
    },
    [cycleSubtitle, pauseVideo, playVideo, seekVideo, tvMode]
  );

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !src) return;

    setError("");
    userPausedRef.current = false;
    autoplayDoneRef.current = false;
    restoreDoneRef.current = false;
    lastProgressSaveRef.current = 0;
    playerSourceStartedAtRef.current = Date.now();
    lastRestoredProgressUpdatedAtRef.current = "";

    video.controls = !tvMode;
    video.autoplay = tvMode;
    video.preload = tvMode ? "auto" : "metadata";

    if (tvMode) {
      video.removeAttribute("controls");
    } else {
      video.setAttribute("controls", "");
    }

    function restoreProgressIfNeeded() {
      const currentVideo = videoRef.current;

      if (!currentVideo) return;
      if (restoreDoneRef.current) return;

      restoreDoneRef.current = true;

      const saved = readVideoProgress(progressKey);
      const duration = Number.isFinite(currentVideo.duration)
        ? currentVideo.duration
        : 0;
      const savedTime = Number(saved?.currentTime || 0);
      lastRestoredProgressUpdatedAtRef.current =
        String(saved?.updatedAt || "");

      if (savedTime > 8 && (!duration || savedTime < duration - 8)) {
        try {
          currentVideo.currentTime = savedTime;
        } catch {
          // Some streams reject seek before enough data is buffered.
        }
      }
    }

    function saveProgressNow() {
      const currentVideo = videoRef.current;

      if (!progressKey || !currentVideo) return;

      const currentTime = currentVideo.currentTime || 0;
      const duration = Number.isFinite(currentVideo.duration)
        ? currentVideo.duration
        : 0;

      saveVideoProgress(progressKey, {
        currentTime,
        duration,
        updatedAt: new Date().toISOString(),
        title,
        subtitle,
      });
    }

    function saveProgressThrottled() {
      const now = Date.now();
      if (now - lastProgressSaveRef.current < 3000) return;
      lastProgressSaveRef.current = now;
      saveProgressNow();
    }

    function handleLoadedMetadata() {
      restoreProgressIfNeeded();
      autoplayQuietly();
    }

    function autoplayQuietly() {
      if (!tvMode) return;
      if (userPausedRef.current || autoplayDoneRef.current) return;

      void attemptPlay({ showError: false, forced: false });
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    function saveProgressUrgent() {
      saveProgressNow();
      window.dispatchEvent(
        new Event(PLAYBACK_PROGRESS_URGENT_EVENT)
      );
    }

    video.addEventListener("timeupdate", saveProgressThrottled);
    video.addEventListener("pause", saveProgressUrgent);
    video.addEventListener("ended", saveProgressUrgent);
    video.addEventListener("canplay", autoplayQuietly, { once: true });

    const isHlsSource = /\.m3u8(?:$|[?#])/i.test(src);

    if (isHlsSource && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(src);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        autoplayQuietly();
      });
      let networkRecoveryCount = 0;
      let mediaRecoveryCount = 0;

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveryCount < 2) {
          networkRecoveryCount += 1;
          setError("Mạng chập chờn, đang thử tải lại nguồn...");
          window.setTimeout(() => {
            try {
              hls.startLoad();
            } catch {}
          }, 900 * networkRecoveryCount);
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveryCount < 2) {
          mediaRecoveryCount += 1;
          setError("Luồng phát gặp lỗi, đang phục hồi player...");
          window.setTimeout(() => {
            try {
              hls.recoverMediaError();
            } catch {}
          }, 500 * mediaRecoveryCount);
          return;
        }

        setError("Không phát được HLS bằng player native. Đang thử player dự phòng...");
        window.dispatchEvent(
          new CustomEvent(NATIVE_PLAYER_FATAL_EVENT, {
            detail: {
              progressKey,
              src,
            },
          })
        );
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        networkRecoveryCount = 0;
        mediaRecoveryCount = 0;
        setError("");
      });

      return () => {
        saveProgressNow();
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("timeupdate", saveProgressThrottled);
        video.removeEventListener("pause", saveProgressUrgent);
        video.removeEventListener("ended", saveProgressUrgent);
        video.removeEventListener("canplay", autoplayQuietly);
        hls.destroy();
      };
    }

    video.src = src;
    video.load();
    autoplayQuietly();

    return () => {
      saveProgressNow();
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", saveProgressThrottled);
      video.removeEventListener("pause", saveProgressUrgent);
      video.removeEventListener("ended", saveProgressUrgent);
      video.removeEventListener("canplay", autoplayQuietly);
      video.removeAttribute("src");
      video.load();
    };
  }, [attemptPlay, progressKey, src, subtitle, title, tvMode]);

  useEffect(() => {
    if (!progressKey) return;

    // Giữ một string đã được narrow ổn định cho callback chạy về sau.
    const activeProgressKey = progressKey;

    function handleSyncedProgress(event: Event) {
      const video = videoRef.current;
      if (!video) return;

      const detail = (
        event as CustomEvent<{ keys?: string[] }>
      ).detail;

      if (
        Array.isArray(detail?.keys) &&
        !detail.keys.includes(activeProgressKey)
      ) {
        return;
      }

      const saved = readVideoProgress(activeProgressKey);
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

  useEffect(() => {
    if (!tvMode) return;

    function onPlayerCommand(event: Event) {
      const detail = (event as CustomEvent<PlayerCommandDetail>).detail;

      if (!detail || detail.handled) return;

      handleCommand(detail);
    }

    window.addEventListener("baoflix-tv-player-command", onPlayerCommand as EventListener);

    return () => {
      window.removeEventListener("baoflix-tv-player-command", onPlayerCommand as EventListener);
    };
  }, [handleCommand, tvMode]);

  useEffect(() => {
    const video = videoRef.current;

    if (!tvMode || !video || !("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: subtitle || "BảoFlix",
        artwork: poster
          ? [
              { src: poster, sizes: "512x512", type: "image/png" },
            ]
          : undefined,
      });
    } catch {
      // Metadata artwork có thể lỗi với URL tương đối trong vài WebView TV.
    }

    safeSetMediaSessionHandler("play", () => {
      void playVideo({ showError: true, showHud: true });
    });
    safeSetMediaSessionHandler("pause", () => {
      pauseVideo();
    });
    safeSetMediaSessionHandler("seekbackward", (details) => {
      seekVideo(-((details as MediaSessionActionDetails).seekOffset || DEFAULT_SEEK_SECONDS));
    });
    safeSetMediaSessionHandler("seekforward", (details) => {
      seekVideo((details as MediaSessionActionDetails).seekOffset || DEFAULT_SEEK_SECONDS);
    });
    safeSetMediaSessionHandler("seekto", (details) => {
      const seekTo = (details as MediaSessionActionDetails).seekTime;

      if (typeof seekTo === "number") {
        video.currentTime = seekTo;
        focusRemoteSurface();
      }
    });

    return () => {
      safeSetMediaSessionHandler("play", null);
      safeSetMediaSessionHandler("pause", null);
      safeSetMediaSessionHandler("seekbackward", null);
      safeSetMediaSessionHandler("seekforward", null);
      safeSetMediaSessionHandler("seekto", null);
    };
  }, [pauseVideo, playVideo, poster, seekVideo, subtitle, title, tvMode]);

  useEffect(() => {
    const video = videoRef.current;

    if (!tvMode || !video || !("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;

    function updatePositionState() {
      const currentVideo = videoRef.current;

      if (!currentVideo || !Number.isFinite(currentVideo.duration)) return;

      try {
        navigator.mediaSession.setPositionState({
          duration: currentVideo.duration,
          playbackRate: currentVideo.playbackRate || 1,
          position: currentVideo.currentTime,
        });
      } catch {
        // Ignore unsupported position state in older WebViews.
      }
    }

    video.addEventListener("timeupdate", updatePositionState);
    video.addEventListener("loadedmetadata", updatePositionState);

    return () => {
      video.removeEventListener("timeupdate", updatePositionState);
      video.removeEventListener("loadedmetadata", updatePositionState);
    };
  }, [tvMode]);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        data-tv-player={tvMode ? "native-video" : undefined}
        data-tv-player-native={tvMode ? "true" : undefined}
        data-tv-skip={tvMode ? true : undefined}
        tabIndex={tvMode ? -1 : 0}
        autoPlay={tvMode}
        playsInline
        preload={tvMode ? "auto" : "metadata"}
        poster={poster}
        controls={!tvMode}
        controlsList={tvMode ? "nodownload nofullscreen noremoteplayback" : "nodownload"}
        className={[
          tvMode ? "pointer-events-none" : "",
          "h-full w-full bg-black object-contain outline-none",
        ].join(" ")}
        onPlay={() => {
          if (!tvMode) return;
          userPausedRef.current = false;
          autoplayDoneRef.current = true;
          setError("");
        }}
        onPause={() => {
          if (!tvMode) return;
          userPausedRef.current = true;
        }}
      >
        {subtitleTracks.map((track, index) => (
          <track
            key={`${track.lang}-${track.label}-${track.url}-${index}`}
            kind="subtitles"
            src={track.url}
            srcLang={track.lang || "vi"}
            label={track.label || `Phụ đề ${index + 1}`}
            default={Boolean(track.default && index === 0)}
            // BAOFLIX_V11_TRACK_ONLOAD_SYNC
            onLoad={() => {
              window.setTimeout(() => {
                applySubtitleMode(activeSubtitleIndex);
              }, 0);
            }}
          />
        ))}
      </video>

      {error && (
        <div className="pointer-events-none absolute left-1/2 top-[12%] max-w-[70vw] -translate-x-1/2 rounded-2xl bg-black/72 px-4 py-3 text-center text-sm font-bold text-yellow-100 shadow-2xl backdrop-blur">
          {error}
        </div>
      )}
    </div>
  );
}
