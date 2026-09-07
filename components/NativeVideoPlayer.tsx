"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ResolvedSubtitleTrack } from "@/lib/subtitleTools";
import SubtitleAppearanceSettings from "@/components/SubtitleAppearanceSettings";
import {
  DEFAULT_SUBTITLE_APPEARANCE,
  getSubtitleBottom,
  getSubtitleTextStyle,
  readSubtitleAppearance,
  SUBTITLE_APPEARANCE_CHANGE_EVENT,
  SUBTITLE_APPEARANCE_KEY,
  type SubtitleAppearance,
} from "@/lib/subtitleAppearance";

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
// BAOFLIX_V14_DIRECT_NATIVE_STARTUP_WATCHDOG
const DIRECT_NATIVE_STARTUP_TIMEOUT_MS = 15000;
const DIRECT_NATIVE_TV_STARTUP_TIMEOUT_MS = 20000;
// BAOFLIX_PLAYBACK_PROGRESS_SYNC
const EMPTY_SUBTITLE_TRACKS: ResolvedSubtitleTrack[] = [];
// BAOFLIX_SUBTITLE_APPEARANCE_V1

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

type ExtendedVideoElement = HTMLVideoElement & {
  webkitDisplayingFullscreen?: boolean;
  webkitEnterFullscreen?: () => void;
};

function shouldUseNativeSubtitleLayer(video: HTMLVideoElement) {
  const extendedVideo = video as ExtendedVideoElement;
  const pictureInPictureElement = (
    document as Document & { pictureInPictureElement?: Element | null }
  ).pictureInPictureElement;

  return (
    document.fullscreenElement === video ||
    Boolean(extendedVideo.webkitDisplayingFullscreen) ||
    pictureInPictureElement === video
  );
}

function cleanCueText(value: string) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function readActiveCueTexts(track?: TextTrack | null) {
  if (!track?.activeCues) return [];

  return Array.from(track.activeCues)
    .map((cue) => cleanCueText(String((cue as VTTCue).text || "")))
    .filter(Boolean);
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
  const playerShellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const userPausedRef = useRef(false);
  const autoplayDoneRef = useRef(false);
  const restoreDoneRef = useRef(false);
  const lastProgressSaveRef = useRef(0);
  const playerSourceStartedAtRef = useRef(0);
  const lastRestoredProgressUpdatedAtRef = useRef("");
  const sourceReadyRef = useRef(false);
  const [error, setError] = useState<string>("");
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState(-1);
  const [activeCueTexts, setActiveCueTexts] = useState<string[]>([]);
  const [subtitleSettingsOpen, setSubtitleSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [subtitleAppearance, setSubtitleAppearance] =
    useState<SubtitleAppearance>(DEFAULT_SUBTITLE_APPEARANCE);

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

  const applySubtitleMode = useCallback((
    index: number,
    forceNativeLayer = false
  ) => {
    const video = videoRef.current;
    if (!video) return;

    const useNativeLayer =
      forceNativeLayer || shouldUseNativeSubtitleLayer(video);

    Array.from(video.textTracks).forEach((track, trackIndex) => {
      track.mode =
        trackIndex === index
          ? useNativeLayer
            ? "showing"
            : "hidden"
          : "disabled";
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

  useEffect(() => {
    const syncAppearance = () => {
      setSubtitleAppearance(readSubtitleAppearance());
    };

    function handleStorage(event: StorageEvent) {
      if (!event.key || event.key === SUBTITLE_APPEARANCE_KEY) {
        syncAppearance();
      }
    }

    syncAppearance();
    window.addEventListener(
      SUBTITLE_APPEARANCE_CHANGE_EVENT,
      syncAppearance
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        SUBTITLE_APPEARANCE_CHANGE_EVENT,
        syncAppearance
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const currentVideo = video;

    const tracks = Array.from(currentVideo.textTracks);

    function syncCueText() {
      if (activeSubtitleIndex < 0) {
        setActiveCueTexts([]);
        return;
      }

      const activeTrack = tracks[activeSubtitleIndex];
      if (!activeTrack) {
        setActiveCueTexts([]);
        return;
      }

      if (!shouldUseNativeSubtitleLayer(currentVideo)) {
        activeTrack.mode = "hidden";
      }

      setActiveCueTexts(readActiveCueTexts(activeTrack));
    }

    tracks.forEach((track) => {
      track.addEventListener("cuechange", syncCueText);
    });
    currentVideo.addEventListener("timeupdate", syncCueText);
    currentVideo.addEventListener("seeked", syncCueText);
    currentVideo.addEventListener("loadeddata", syncCueText);

    const timers = [
      window.setTimeout(syncCueText, 0),
      window.setTimeout(syncCueText, 250),
      window.setTimeout(syncCueText, 900),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      tracks.forEach((track) => {
        track.removeEventListener("cuechange", syncCueText);
      });
      currentVideo.removeEventListener("timeupdate", syncCueText);
      currentVideo.removeEventListener("seeked", syncCueText);
      currentVideo.removeEventListener("loadeddata", syncCueText);
    };
  }, [activeSubtitleIndex, subtitleTracks]);

  useEffect(() => {
    const shell = playerShellRef.current;
    const video = videoRef.current;
    if (!video) return;

    function syncFullscreenMode() {
      setIsFullscreen(document.fullscreenElement === shell);
      applySubtitleMode(activeSubtitleIndex);
    }

    function useNativeLayer() {
      applySubtitleMode(activeSubtitleIndex, true);
    }

    document.addEventListener("fullscreenchange", syncFullscreenMode);
    video.addEventListener("webkitbeginfullscreen", useNativeLayer);
    video.addEventListener("webkitendfullscreen", syncFullscreenMode);
    video.addEventListener("enterpictureinpicture", useNativeLayer);
    video.addEventListener("leavepictureinpicture", syncFullscreenMode);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenMode);
      video.removeEventListener("webkitbeginfullscreen", useNativeLayer);
      video.removeEventListener("webkitendfullscreen", syncFullscreenMode);
      video.removeEventListener("enterpictureinpicture", useNativeLayer);
      video.removeEventListener("leavepictureinpicture", syncFullscreenMode);
    };
  }, [activeSubtitleIndex, applySubtitleMode]);

  useEffect(() => {
    if (subtitleTracks.length) return;
    setActiveCueTexts([]);
    setSubtitleSettingsOpen(false);
  }, [subtitleTracks.length]);

  useEffect(() => {
    if (!subtitleSettingsOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSubtitleSettingsOpen(false);
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [subtitleSettingsOpen]);

  const togglePlayerFullscreen = useCallback(async () => {
    const shell = playerShellRef.current;
    const video = videoRef.current as ExtendedVideoElement | null;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (shell?.requestFullscreen) {
        await shell.requestFullscreen();
        return;
      }

      video?.webkitEnterFullscreen?.();
    } catch {
      video?.webkitEnterFullscreen?.();
    }
  }, []);

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
    sourceReadyRef.current = false;

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

    let startupTimer: number | null = null;

    function clearStartupTimer() {
      if (startupTimer !== null) {
        window.clearTimeout(startupTimer);
        startupTimer = null;
      }
    }

    function markSourceReady() {
      sourceReadyRef.current = true;
      clearStartupTimer();
      setError("");
    }

    function handleLoadedMetadata() {
      markSourceReady();
      restoreProgressIfNeeded();
      autoplayQuietly();
    }

    function autoplayQuietly() {
      if (!tvMode) return;
      if (userPausedRef.current || autoplayDoneRef.current) return;

      void attemptPlay({ showError: false, forced: false });
    }

    function handleCanPlay() {
      markSourceReady();
      autoplayQuietly();
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
    video.addEventListener("canplay", handleCanPlay, { once: true });

    startupTimer = window.setTimeout(() => {
      if (sourceReadyRef.current) return;

      setError(
        "Nguồn Native khởi động quá lâu. BảoFlix đang thử lại Drive..."
      );

      window.dispatchEvent(
        new CustomEvent(NATIVE_PLAYER_FATAL_EVENT, {
          detail: {
            progressKey,
            src,
            reason: "startup-timeout",
          },
        })
      );
    }, tvMode
      ? DIRECT_NATIVE_TV_STARTUP_TIMEOUT_MS
      : DIRECT_NATIVE_STARTUP_TIMEOUT_MS
    );

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
        video.removeEventListener("canplay", handleCanPlay);
        clearStartupTimer();
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
      video.removeEventListener("canplay", handleCanPlay);
      clearStartupTimer();
      video.removeAttribute("src");
      video.load();
    };
  }, [attemptPlay, progressKey, src, subtitle, title, tvMode]);

  // BAOFLIX_PC_SEEK_10S_ONLY_V3_CAPTURE
  // PC/điện thoại: ArrowLeft / ArrowRight = đúng ±10 giây.
  // Bắt ở document capture để chặn keyboard seek mặc định
  // của browser controls trước khi browser tự cộng thêm bước tua.
  // TV giữ nguyên hoàn toàn vì tvMode=true thoát ngay.
  useEffect(() => {
    if (tvMode) return;

    function isSeekKey(event: KeyboardEvent) {
      return (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      );
    }

    function belongsToCurrentVideo(event: KeyboardEvent) {
      const currentVideo = videoRef.current;
      if (!currentVideo) return false;

      if (event.target === currentVideo) return true;
      if (document.activeElement === currentVideo) return true;

      try {
        return event.composedPath().includes(currentVideo);
      } catch {
        return false;
      }
    }

    function blockBrowserSeek(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    function handleDesktopSeekKeyDown(event: KeyboardEvent) {
      if (!isSeekKey(event)) return;

      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      if (!belongsToCurrentVideo(event)) return;

      // Chặn default action của browser media controls trước.
      blockBrowserSeek(event);

      // Một lần nhấn vật lý = đúng một lần tua.
      // Giữ phím không cộng dồn thành 20/30/40 giây.
      if (event.repeat) return;

      const currentVideo = videoRef.current;
      if (!currentVideo) return;

      const duration =
        Number.isFinite(currentVideo.duration) &&
        currentVideo.duration > 0
          ? currentVideo.duration
          : Number.MAX_SAFE_INTEGER;

      const delta =
        event.key === "ArrowRight"
          ? DEFAULT_SEEK_SECONDS
          : -DEFAULT_SEEK_SECONDS;

      currentVideo.currentTime = clamp(
        currentVideo.currentTime + delta,
        0,
        duration
      );
    }

    function handleDesktopSeekKeyUp(event: KeyboardEvent) {
      if (!isSeekKey(event)) return;
      if (!belongsToCurrentVideo(event)) return;

      // Một số browser controls hoàn tất hành động keyboard ở keyup.
      // Chặn luôn để không phát sinh bước tua thứ hai.
      blockBrowserSeek(event);
    }

    document.addEventListener(
      "keydown",
      handleDesktopSeekKeyDown,
      true
    );
    document.addEventListener(
      "keyup",
      handleDesktopSeekKeyUp,
      true
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleDesktopSeekKeyDown,
        true
      );
      document.removeEventListener(
        "keyup",
        handleDesktopSeekKeyUp,
        true
      );
    };
  }, [tvMode]);

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
    <div
      ref={playerShellRef}
      data-baoflix-subtitle-layer="custom"
      className="relative h-full w-full overflow-hidden bg-black"
    >
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
        controlsList={tvMode ? "nodownload nofullscreen noremoteplayback" : "nodownload nofullscreen"}
        // BAOFLIX_V13_DIRECT_FATAL
        onError={() => {
          const currentVideo = videoRef.current;
          const currentSrc =
            currentVideo?.currentSrc || src;
          const mediaError = currentVideo?.error;

          setError(
            "Nguồn Native gặp lỗi. BảoFlix đang thử lại Drive..."
          );

          window.dispatchEvent(
            new CustomEvent(NATIVE_PLAYER_FATAL_EVENT, {
              detail: {
                progressKey,
                src: currentSrc || src,
                errorCode: mediaError?.code,
                errorMessage: mediaError?.message || "",
                reason: "media-error",
              },
            })
          );
        }}
        onStalled={() => {
          setError(
            "Nguồn Drive đang phản hồi chậm, tiếp tục chờ dữ liệu..."
          );
        }}
        onCanPlay={() => {
          sourceReadyRef.current = true;
          setError("");
        }}
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
            default={false}
            // BAOFLIX_V11_TRACK_ONLOAD_SYNC
            onLoad={() => {
              window.setTimeout(() => {
                applySubtitleMode(activeSubtitleIndex);
              }, 0);
            }}
          />
        ))}
      </video>

      {activeCueTexts.length > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 z-20 flex flex-col items-center gap-2 text-center"
          style={{ bottom: getSubtitleBottom(subtitleAppearance) }}
        >
          {activeCueTexts.map((cueText, index) => (
            <span
              key={`${index}:${cueText}`}
              className="inline-block max-w-full"
              style={getSubtitleTextStyle(subtitleAppearance)}
            >
              {cueText}
            </span>
          ))}
        </div>
      )}

      {!tvMode && (
        <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
          {subtitleTracks.length > 0 && (
            <>
              <button
                type="button"
                onClick={cycleSubtitle}
                className="rounded-xl border border-white/15 bg-black/65 px-3 py-2 text-xs font-black text-white shadow-xl backdrop-blur hover:bg-black/85"
                aria-label="Đổi hoặc tắt phụ đề"
                title="Đổi hoặc tắt phụ đề"
              >
                CC
              </button>
              <button
                type="button"
                onClick={() => setSubtitleSettingsOpen(true)}
                className="rounded-xl border border-white/15 bg-black/65 px-3 py-2 text-xs font-black text-white shadow-xl backdrop-blur hover:bg-black/85"
                aria-label="Mở giao diện phụ đề"
                title="Giao diện phụ đề"
              >
                Aa
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => void togglePlayerFullscreen()}
            className="rounded-xl border border-white/15 bg-black/65 px-3 py-2 text-xs font-black text-white shadow-xl backdrop-blur hover:bg-black/85"
            aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          >
            {isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
          </button>
        </div>
      )}

      {subtitleSettingsOpen && !tvMode && (
        <div
          data-tv-modal
          data-tv-scope="subtitle-style"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSubtitleSettingsOpen(false);
            }
          }}
        >
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto">
            <SubtitleAppearanceSettings
              embedded
              onClose={() => setSubtitleSettingsOpen(false)}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="pointer-events-none absolute left-1/2 top-[12%] z-20 max-w-[70vw] -translate-x-1/2 rounded-2xl bg-black/72 px-4 py-3 text-center text-sm font-bold text-yellow-100 shadow-2xl backdrop-blur">
          {error}
        </div>
      )}
    </div>
  );
}
