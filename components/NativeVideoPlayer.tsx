"use client";

import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";

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

function safeSetMediaSessionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null) {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Some TV WebViews expose Media Session partially. Ignore unsupported actions.
  }
}

export default function NativeVideoPlayer({
  src,
  title,
  subtitle,
  poster,
}: NativeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string>("");

  function focusVideo() {
    const video = videoRef.current;

    if (!video) return;

    try {
      video.focus({ preventScroll: true });
    } catch {
      // Ignore focus errors in WebView.
    }
  }

  async function playVideo() {
    const video = videoRef.current;

    if (!video) return;

    focusVideo();

    try {
      await video.play();
      emitHud({ type: "play" });
    } catch {
      setError("TV cần bấm OK thêm một lần để phát video.");
    }
  }

  function pauseVideo() {
    const video = videoRef.current;

    if (!video) return;

    video.pause();
    emitHud({ type: "pause" });
  }

  function seekVideo(seconds: number) {
    const video = videoRef.current;

    if (!video) return;

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const maxTime = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    const nextTime = clamp(video.currentTime + seconds, 0, maxTime);

    video.currentTime = nextTime;
    focusVideo();

    emitHud({
      type: "seek",
      delta: seconds,
      currentTime: nextTime,
      duration,
    });
  }

  function handleCommand(detail: PlayerCommandDetail) {
    detail.handled = true;

    if (detail.action === "focus-player") {
      focusVideo();
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
        void playVideo();
      } else {
        pauseVideo();
      }

      return;
    }

    if (detail.action === "play") {
      void playVideo();
      return;
    }

    if (detail.action === "pause") {
      pauseVideo();
    }
  }

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !src) return;

    setError("");

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError("Không phát được HLS bằng player native. Hãy thử đổi nguồn.");
        }
      });

      return () => {
        hls.destroy();
      };
    }

    video.src = src;

    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

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
  }, []);

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
      // Metadata artwork can fail with relative URLs in some WebViews.
    }

    safeSetMediaSessionHandler("play", () => {
      void playVideo();
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
      }
    });

    return () => {
      safeSetMediaSessionHandler("play", null);
      safeSetMediaSessionHandler("pause", null);
      safeSetMediaSessionHandler("seekbackward", null);
      safeSetMediaSessionHandler("seekforward", null);
      safeSetMediaSessionHandler("seekto", null);
    };
  }, [poster, subtitle, title]);

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
        tabIndex={0}
        controls
        playsInline
        preload="metadata"
        poster={poster}
        className="h-full w-full bg-black outline-none"
        onPlay={() => setError("")}
      />

      {error && (
        <div className="pointer-events-none absolute left-1/2 top-[12%] max-w-[70vw] -translate-x-1/2 rounded-2xl bg-black/72 px-4 py-3 text-center text-sm font-bold text-yellow-100 shadow-2xl backdrop-blur">
          {error}
        </div>
      )}
    </div>
  );
}
