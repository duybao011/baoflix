"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";

type PlayerCommandAction = "seek" | "toggle-play" | "play" | "pause" | "focus-player";

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
};

const DEFAULT_SEEK_SECONDS = 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function emitHud(detail: {
  type: "seek" | "play" | "pause";
  delta?: number;
  currentTime?: number;
  duration?: number;
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
}: NativeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const userPausedRef = useRef(false);
  const autoplayDoneRef = useRef(false);
  const [error, setError] = useState<string>("");

  const attemptPlay = useCallback(
    async ({
      showError = false,
      forced = false,
    }: {
      showError?: boolean;
      forced?: boolean;
    } = {}) => {
      const video = videoRef.current;

      if (!video) return false;

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
    []
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

    if (!video) return;

    userPausedRef.current = true;
    video.pause();
    focusRemoteSurface();
    emitHud({ type: "pause" });
  }, []);

  const seekVideo = useCallback((seconds: number) => {
    const video = videoRef.current;

    if (!video) return;

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
  }, []);

  const handleCommand = useCallback(
    (detail: PlayerCommandDetail) => {
      detail.handled = true;

      if (detail.action === "focus-player") {
        // Chỉ trả focus về bề mặt remote. Không được tự play lại khi user đã pause.
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
    [pauseVideo, playVideo, seekVideo]
  );

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !src) return;

    setError("");
    userPausedRef.current = false;
    autoplayDoneRef.current = false;
    video.removeAttribute("controls");
    video.controls = false;
    video.autoplay = true;
    video.preload = "auto";

    function autoplayQuietly() {
      if (userPausedRef.current || autoplayDoneRef.current) return;

      void attemptPlay({ showError: false, forced: false });
    }

    video.addEventListener("loadedmetadata", autoplayQuietly);
    video.addEventListener("canplay", autoplayQuietly, { once: true });

    if (Hls.isSupported()) {
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
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError("Không phát được HLS bằng player native. Hãy thử đổi nguồn.");
        }
      });

      return () => {
        video.removeEventListener("loadedmetadata", autoplayQuietly);
        video.removeEventListener("canplay", autoplayQuietly);
        hls.destroy();
      };
    }

    video.src = src;
    video.load();
    autoplayQuietly();

    return () => {
      video.removeEventListener("loadedmetadata", autoplayQuietly);
      video.removeEventListener("canplay", autoplayQuietly);
      video.removeAttribute("src");
      video.load();
    };
  }, [attemptPlay, src]);

  useEffect(() => {
    function onPlayerCommand(event: Event) {
      const detail = (event as CustomEvent<PlayerCommandDetail>).detail;

      if (!detail || detail.handled) return;

      handleCommand(detail);
    }

    window.addEventListener("baoflix-tv-player-command", onPlayerCommand as EventListener);

    return () => {
      window.removeEventListener("baoflix-tv-player-command", onPlayerCommand as EventListener);
    };
  }, [handleCommand]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !("mediaSession" in navigator)) return;

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
  }, [pauseVideo, playVideo, poster, seekVideo, subtitle, title]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;

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
  }, []);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        data-tv-player="native-video"
        data-tv-player-native="true"
        data-tv-skip
        tabIndex={-1}
        autoPlay
        playsInline
        preload="auto"
        poster={poster}
        controlsList="nodownload nofullscreen noremoteplayback"
        className="pointer-events-none h-full w-full bg-black object-contain outline-none"
        onPlay={() => {
          userPausedRef.current = false;
          autoplayDoneRef.current = true;
          setError("");
        }}
        onPause={() => {
          userPausedRef.current = true;
        }}
      />

      {error && (
        <div className="pointer-events-none absolute left-1/2 top-[12%] max-w-[70vw] -translate-x-1/2 rounded-2xl bg-black/72 px-4 py-3 text-center text-sm font-bold text-yellow-100 shadow-2xl backdrop-blur">
          {error}
        </div>
      )}
    </div>
  );
}
