"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NativeVideoPlayer from "@/components/NativeVideoPlayer";
import TvWatchOverlay from "@/components/TvWatchOverlay";
import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";
import { isTvModeActive } from "@/lib/tvMode";

type CustomDrivePlayerProps = {
  src: string;
  title: string;
  progressKey: string;
  movie: MovieDetail;
  currentSeason?: EpisodeServer;
  seasonIndex: number;
  episodeIndex: number;
  watchedEpisodes: string[];
  previousHref?: string;
  nextHref?: string;
  detailHref: string;
  poster?: string;
  onOpenEpisodes: () => void;
};

type PlayerMode = "probing" | "native" | "iframe";

type StoredDriveEstimate = {
  seconds: number;
  updatedAt: string;
};

const PROBE_TIMEOUT_MS = 8000;
const SAVE_INTERVAL_SECONDS = 5;

function extractDriveFileId(url: string) {
  const value = String(url || "").trim();

  const fileMatch = value.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (fileMatch?.[1]) return fileMatch[1];

  const idMatch = value.match(/[?&]id=([^&#]+)/i);
  if (idMatch?.[1]) return decodeURIComponent(idMatch[1]);

  return "";
}

function buildDirectCandidates(fileId: string) {
  if (!fileId) return [];

  return [
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(
      fileId
    )}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
      fileId
    )}`,
  ];
}

function addAutoplayHint(url: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("autoplay", "1");
    return parsed.toString();
  } catch {
    return url;
  }
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readEstimate(storageKey: string) {
  try {
    const raw = localStorage.getItem(`${storageKey}:iframe-estimate`);
    if (!raw) return 0;

    const parsed = JSON.parse(raw) as Partial<StoredDriveEstimate>;
    const seconds = Number(parsed.seconds || 0);

    return Number.isFinite(seconds) && seconds > 0
      ? Math.floor(seconds)
      : 0;
  } catch {
    return 0;
  }
}

function saveEstimate(storageKey: string, seconds: number) {
  try {
    const payload: StoredDriveEstimate = {
      seconds: Math.max(0, Math.floor(seconds)),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      `${storageKey}:iframe-estimate`,
      JSON.stringify(payload)
    );
  } catch {
    // Bỏ qua lỗi storage trên WebView hạn chế.
  }
}

export default function CustomDrivePlayer({
  src,
  title,
  progressKey,
  movie,
  currentSeason,
  seasonIndex,
  episodeIndex,
  watchedEpisodes,
  previousHref = "",
  nextHref = "",
  detailHref,
  poster,
  onOpenEpisodes,
}: CustomDrivePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const estimateSecondsRef = useRef(0);
  const estimateSaveTickRef = useRef(0);

  const [tvMode, setTvMode] = useState(false);
  const [mode, setMode] = useState<PlayerMode>("probing");
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [nativeSrc, setNativeSrc] = useState("");
  const [iframeSrc, setIframeSrc] = useState(src);
  const [fallbackReason, setFallbackReason] = useState("");
  const [estimateSeconds, setEstimateSeconds] = useState(0);

  const fileId = useMemo(() => extractDriveFileId(src), [src]);
  const directCandidates = useMemo(
    () => buildDirectCandidates(fileId),
    [fileId]
  );
  const activeCandidate = directCandidates[candidateIndex] || "";

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
    };
  }, []);

  useEffect(() => {
    setIframeSrc(src);
    setCandidateIndex(0);
    setNativeSrc("");
    setFallbackReason("");

    if (!tvMode) {
      setMode("iframe");
      return;
    }

    if (!fileId || directCandidates.length === 0) {
      setMode("iframe");
      setFallbackReason(
        "Không lấy được file ID từ link Drive, đang dùng player Drive dự phòng."
      );
      return;
    }

    setMode("probing");
  }, [directCandidates.length, fileId, src, tvMode]);

  useEffect(() => {
    if (!tvMode || mode !== "probing" || !activeCandidate) return;

    const timeout = window.setTimeout(() => {
      tryNextCandidate("Nguồn direct tải quá lâu.");
    }, PROBE_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [activeCandidate, mode, tvMode]);

  useEffect(() => {
    const saved = readEstimate(progressKey);
    estimateSecondsRef.current = saved;
    estimateSaveTickRef.current = saved;
    setEstimateSeconds(saved);
  }, [progressKey]);

  useEffect(() => {
    if (!tvMode || mode !== "iframe") return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;

      estimateSecondsRef.current += 1;
      const next = estimateSecondsRef.current;
      setEstimateSeconds(next);

      if (
        next - estimateSaveTickRef.current >= SAVE_INTERVAL_SECONDS
      ) {
        estimateSaveTickRef.current = next;
        saveEstimate(progressKey, next);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [mode, progressKey, tvMode]);

  useEffect(() => {
    function flushEstimate() {
      if (mode !== "iframe") return;
      saveEstimate(progressKey, estimateSecondsRef.current);
    }

    window.addEventListener("pagehide", flushEstimate);
    window.addEventListener("beforeunload", flushEstimate);

    return () => {
      flushEstimate();
      window.removeEventListener("pagehide", flushEstimate);
      window.removeEventListener("beforeunload", flushEstimate);
    };
  }, [mode, progressKey]);

  useEffect(() => {
    if (!tvMode || mode !== "iframe") return;

    function handlePlayerCommand(event: Event) {
      const detail = (
        event as CustomEvent<{
          action?: string;
          handled?: boolean;
        }>
      ).detail;

      if (!detail || detail.handled) return;

      detail.handled = true;

      if (
        detail.action === "play" ||
        detail.action === "toggle-play"
      ) {
        setIframeSrc(addAutoplayHint(src));
      }

      if (
        detail.action === "play" ||
        detail.action === "toggle-play" ||
        detail.action === "focus-player"
      ) {
        window.setTimeout(() => {
          iframeRef.current?.focus({ preventScroll: true });
        }, 100);
      }

      window.dispatchEvent(new Event("baoflix-tv-native-missing"));
    }

    window.addEventListener(
      "baoflix-tv-player-command",
      handlePlayerCommand as EventListener
    );

    return () => {
      window.removeEventListener(
        "baoflix-tv-player-command",
        handlePlayerCommand as EventListener
      );
    };
  }, [mode, src, tvMode]);

  function tryNextCandidate(reason: string) {
    const nextIndex = candidateIndex + 1;

    if (nextIndex < directCandidates.length) {
      setCandidateIndex(nextIndex);
      setFallbackReason(reason);
      return;
    }

    setMode("iframe");
    setFallbackReason(
      "Drive không cho phát trực tiếp bằng video native. Đã chuyển sang iframe dự phòng."
    );
  }

  function handleProbeReady() {
    if (!activeCandidate) return;

    setNativeSrc(activeCandidate);
    setMode("native");
    setFallbackReason("");
  }

  const serverForOverlay: EpisodeServer =
    currentSeason || {
      server_name: `Mùa ${seasonIndex + 1}`,
      server_data: [],
    };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {tvMode && mode === "probing" && activeCandidate && (
        <video
          key={activeCandidate}
          src={activeCandidate}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={handleProbeReady}
          onCanPlay={handleProbeReady}
          onError={() =>
            tryNextCandidate("Nguồn direct hiện tại không phát được.")
          }
          className="pointer-events-none absolute h-px w-px opacity-0"
          aria-hidden="true"
        />
      )}

      {mode === "native" && nativeSrc ? (
        <NativeVideoPlayer
          src={nativeSrc}
          title={title}
          subtitle={serverForOverlay.server_name}
          poster={poster}
          progressKey={progressKey}
          tvMode={tvMode}
        />
      ) : (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          tabIndex={tvMode ? -1 : 0}
          data-tv-player="drive-iframe"
          data-tv-skip={tvMode ? true : undefined}
          className={[
            "h-full w-full border-0 bg-black outline-none",
            tvMode ? "pointer-events-none" : "",
          ].join(" ")}
          title={title}
        />
      )}

      {tvMode && mode === "probing" && (
        <div className="pointer-events-none absolute left-1/2 top-[12%] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/75 px-4 py-3 text-center text-sm font-bold text-white shadow-2xl backdrop-blur">
          Đang thử mở video Drive bằng player native...
        </div>
      )}

      {tvMode && mode === "iframe" && (
        <div className="pointer-events-none absolute right-4 top-4 max-w-[48vw] rounded-xl border border-yellow-300/20 bg-black/72 px-3 py-2 text-right shadow-xl backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-yellow-300">
            Drive iframe dự phòng
          </p>

          <p className="mt-1 text-xs font-bold text-white">
            Mốc ước tính: {formatTime(estimateSeconds)}
          </p>

          {fallbackReason && (
            <p className="mt-1 text-[10px] leading-4 text-slate-300">
              {fallbackReason}
            </p>
          )}
        </div>
      )}

      {tvMode && (
        <TvWatchOverlay
          movie={movie}
          currentServer={serverForOverlay}
          safeServerIndex={seasonIndex}
          safeEpisodeIndex={episodeIndex}
          episodeName={
            serverForOverlay.server_data?.[episodeIndex]?.name
          }
          previousHref={previousHref}
          nextHref={nextHref}
          watchedEpisodes={watchedEpisodes}
          sameEpisodeServerLinks={[]}
          onOpenEpisodePanel={onOpenEpisodes}
          routeMode="custom"
          customSeasonIndex={seasonIndex}
          detailHref={detailHref}
        />
      )}
    </div>
  );
}
