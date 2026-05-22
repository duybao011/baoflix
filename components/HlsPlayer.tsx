"use client";

import Hls from "hls.js";
import { useEffect, useRef } from "react";

type HlsPlayerProps = {
  src: string;
  storageKey?: string;
  autoResume?: boolean;
};

export default function HlsPlayer({
  src,
  storageKey,
  autoResume = true,
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasSeekedRef = useRef(false);

  useEffect(() => {
const videoElement = videoRef.current;

if (!videoElement || !src) return;

const video = videoElement;

    hasSeekedRef.current = false;

    function getSavedTime() {
      if (!storageKey || !autoResume) return 0;

      try {
        const raw = localStorage.getItem(storageKey);
        const value = raw ? Number(raw) : 0;

        if (Number.isFinite(value) && value > 5) {
          return value;
        }

        return 0;
      } catch {
        return 0;
      }
    }

    function seekToSavedTime() {
      if (hasSeekedRef.current) return;

      const savedTime = getSavedTime();

      if (savedTime > 0 && Number.isFinite(video.duration)) {
        const safeTime = Math.min(savedTime, Math.max(video.duration - 3, 0));
        video.currentTime = safeTime;
        hasSeekedRef.current = true;
      } else if (savedTime > 0) {
        video.currentTime = savedTime;
        hasSeekedRef.current = true;
      }
    }

    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;

      video.addEventListener("loadedmetadata", seekToSavedTime);
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

      video.addEventListener("loadedmetadata", seekToSavedTime);
      video.addEventListener("canplay", seekToSavedTime);
    } else {
      video.src = src;
    }

    function saveTime() {
      if (!storageKey) return;
      if (!video.currentTime || video.currentTime < 1) return;

      try {
        localStorage.setItem(storageKey, String(Math.floor(video.currentTime)));
      } catch {
        // bỏ qua lỗi localStorage
      }
    }

    video.addEventListener("timeupdate", saveTime);
    video.addEventListener("pause", saveTime);
    video.addEventListener("ended", saveTime);

    return () => {
      saveTime();

      video.removeEventListener("timeupdate", saveTime);
      video.removeEventListener("pause", saveTime);
      video.removeEventListener("ended", saveTime);
      video.removeEventListener("loadedmetadata", seekToSavedTime);
      video.removeEventListener("canplay", seekToSavedTime);

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
      className="h-full w-full bg-black object-contain"
    />
  );
}