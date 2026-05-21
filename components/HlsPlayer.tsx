"use client";

import { useEffect, useRef, useState } from "react";

export default function HlsPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!src) return;

    let hls: any;
    let cancelled = false;

    async function setupPlayer() {
      const video = videoRef.current;

      if (!video) return;

      setError("");

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        return;
      }

      const HlsModule = await import("hls.js");

      if (cancelled) return;

      const Hls = HlsModule.default;

      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
          if (data?.fatal) {
            setError("Không phát được link m3u8 này.");
          }
        });
      } else {
        setError("Trình duyệt này không hỗ trợ HLS.");
      }
    }

    setupPlayer();

    return () => {
      cancelled = true;

      if (hls) {
        hls.destroy();
      }
    };
  }, [src]);

  return (
    <div className="relative bg-black">
      <video
        ref={videoRef}
        controls
        playsInline
        className="h-full w-full bg-black object-contain"
      />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}