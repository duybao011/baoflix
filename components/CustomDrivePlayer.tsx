"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NativeVideoPlayer from "@/components/NativeVideoPlayer";
import TvWatchOverlay from "@/components/TvWatchOverlay";
import type { EpisodeServer, EpisodeSubtitle, MovieDetail } from "@/lib/kkphim";
import {
  buildSubtitleFetchUrl,
  convertSubtitleTextToVtt,
  type ResolvedSubtitleTrack,
} from "@/lib/subtitleTools";
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
  subtitles?: EpisodeSubtitle[];
  onOpenEpisodes: () => void;
};

type PlayerMode = "probing" | "native" | "iframe";

type StoredDriveEstimate = {
  seconds: number;
  updatedAt: string;
};

// BAOFLIX_V13_NATIVE_FIRST
// Relay/Drive có thể cold-start hoặc phản hồi metadata không đều.
// 1.8s trước đây quá gắt và làm file hợp lệ rơi iframe ngẫu nhiên.
const PROBE_TIMEOUT_MS = 6000;
const PERSONAL_PROBE_TIMEOUT_MS = 4500;
const SUBTITLE_DESKTOP_PROBE_TIMEOUT_MS = 7000;
const SUBTITLE_TV_PROBE_TIMEOUT_MS = 9000;
const DRIVE_NATIVE_RETRY_COUNT = 3;
const SAVE_INTERVAL_SECONDS = 5;
const EMPTY_SUBTITLES: EpisodeSubtitle[] = [];
// BAOFLIX_CUSTOM_DRIVE_PERSONAL_PROGRESS

function extractDriveFileId(url: string) {
  const value = String(url || "").trim();

  const fileMatch = value.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (fileMatch?.[1]) return fileMatch[1];

  const idMatch = value.match(/[?&]id=([^&#]+)/i);
  if (idMatch?.[1]) return decodeURIComponent(idMatch[1]);

  return "";
}

function buildDirectCandidates(fileId: string) {
  const relayBase = String(
    process.env.NEXT_PUBLIC_DRIVE_RELAY_URL || ""
  )
    .trim()
    .replace(/\/+$/, "");

  if (!fileId || !relayBase) return [];

  const baseUrl =
    `${relayBase}/video/${encodeURIComponent(fileId)}`;

  return Array.from(
    { length: DRIVE_NATIVE_RETRY_COUNT },
    (_, index) => {
      if (index === 0) return baseUrl;

      try {
        const parsed = new URL(baseUrl);
        parsed.searchParams.set(
          "baoflix_native_retry",
          String(index)
        );
        return parsed.toString();
      } catch {
        return `${baseUrl}?baoflix_native_retry=${index}`;
      }
    }
  );
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
  subtitles = EMPTY_SUBTITLES,
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
  const [resolvedSubtitleTracks, setResolvedSubtitleTracks] = useState<
    ResolvedSubtitleTrack[]
  >([]);
  const [subtitleLoadError, setSubtitleLoadError] = useState("");

  const fileId = useMemo(() => extractDriveFileId(src), [src]);
  const directCandidates = useMemo(
    () => buildDirectCandidates(fileId),
    [fileId]
  );
  const activeCandidate = directCandidates[candidateIndex] || "";
  const hasExternalSubtitles = useMemo(
    () =>
      subtitles.some((track) =>
        Boolean(String(track?.url || "").trim())
      ),
    [subtitles]
  );

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    async function loadSubtitleTracks() {
      setResolvedSubtitleTracks([]);
      setSubtitleLoadError("");

      if (subtitles.length === 0) return;

      if (mode !== "native") {
        if (mode === "iframe") {
          setSubtitleLoadError(
            "Phụ đề đã lưu nhưng video đang chạy bằng Google Drive iframe. " +
              "Iframe Drive không nhận track phụ đề từ BảoFlix; cần Drive Relay/native player."
          );
        }
        return;
      }

      const relayBase = String(
        process.env.NEXT_PUBLIC_DRIVE_RELAY_URL || ""
      )
        .trim()
        .replace(/\/+$/, "");

      const results = await Promise.allSettled(
        subtitles
          .filter((track) => String(track?.url || "").trim())
          .map(async (track) => {
            const fetchUrl = buildSubtitleFetchUrl(track, relayBase);
            if (!fetchUrl) throw new Error("Không tạo được link phụ đề.");

            const response = await fetch(fetchUrl, {
              cache: "force-cache",
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const vttText = convertSubtitleTextToVtt(
              await response.text(),
              track.url
            );
            const objectUrl = URL.createObjectURL(
              new Blob([vttText], {
                type: "text/vtt;charset=utf-8",
              })
            );

            objectUrls.push(objectUrl);

            return {
              label: track.label || "Phụ đề",
              lang: track.lang || "vi",
              url: objectUrl,
              default: Boolean(track.default),
            } satisfies ResolvedSubtitleTrack;
          })
      );

      if (cancelled) return;

      const loaded = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      );

      setResolvedSubtitleTracks(loaded);

      if (results.some((result) => result.status === "rejected")) {
        setSubtitleLoadError(
          loaded.length
            ? "Một số track phụ đề không tải được."
            : "Không tải được phụ đề ASS/SRT/VTT."
        );
      }
    }

    void loadSubtitleTracks();

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mode, subtitles]);

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

    if (!fileId) {
      setMode("iframe");
      setFallbackReason(
        "Không lấy được file ID từ link Drive, đang dùng player Drive dự phòng."
      );
      return;
    }

    if (directCandidates.length === 0) {
      setMode("iframe");
      setFallbackReason(
        hasExternalSubtitles
          ? "Thiếu NEXT_PUBLIC_DRIVE_RELAY_URL nên Drive đang chạy iframe. Phụ đề ngoài cần Native/Drive Relay."
          : "Không có Drive Relay, đang dùng player Drive dự phòng."
      );
      return;
    }

    // Luôn thử Native cho chính file hiện tại.
    // Timeout của phim/tập trước không được làm phim này rơi iframe.
    setMode("probing");
  }, [
    directCandidates.length,
    fileId,
    hasExternalSubtitles,
    src,
    tvMode,
  ]);

  useEffect(() => {
    if (mode !== "probing" || !activeCandidate) return;

    const baseTimeoutMs = hasExternalSubtitles
      ? tvMode
        ? SUBTITLE_TV_PROBE_TIMEOUT_MS
        : SUBTITLE_DESKTOP_PROBE_TIMEOUT_MS
      : tvMode
        ? PROBE_TIMEOUT_MS
        : PERSONAL_PROBE_TIMEOUT_MS;

    const timeoutMs =
      baseTimeoutMs + candidateIndex * 1000;

    const timeout = window.setTimeout(() => {
      tryNextCandidate(
        hasExternalSubtitles
          ? "Drive Relay đang chậm; thử lại Native trước khi dùng iframe."
          : "Nguồn Drive phản hồi chậm; đang thử lại Native."
      );
    }, timeoutMs);

    return () => window.clearTimeout(timeout);
  }, [
    activeCandidate,
    candidateIndex,
    hasExternalSubtitles,
    mode,
    tvMode,
  ]);

  useEffect(() => {
    function handleNativeFatal(event: Event) {
      if (mode !== "native") return;

      const detail = (
        event as CustomEvent<{
          progressKey?: string;
          src?: string;
        }>
      ).detail;

      if (
        detail?.progressKey &&
        detail.progressKey !== progressKey
      ) {
        return;
      }

      if (
        detail?.src &&
        nativeSrc &&
        detail.src !== nativeSrc
      ) {
        return;
      }

      const nextIndex = candidateIndex + 1;

      if (nextIndex < directCandidates.length) {
        setCandidateIndex(nextIndex);
        setNativeSrc("");
        setFallbackReason(
          "Native gặp lỗi khi phát; đang thử lại nguồn Drive."
        );
        setMode("probing");
        return;
      }

      setNativeSrc("");
      setFallbackReason(
        "Native gặp lỗi sau nhiều lần thử. Đã chuyển sang Drive iframe dự phòng."
      );
      setMode("iframe");
    }

    window.addEventListener(
      "baoflix-native-player-fatal",
      handleNativeFatal as EventListener
    );

    return () => {
      window.removeEventListener(
        "baoflix-native-player-fatal",
        handleNativeFatal as EventListener
      );
    };
  }, [
    candidateIndex,
    directCandidates.length,
    mode,
    nativeSrc,
    progressKey,
  ]);

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
      setNativeSrc("");
      setMode("probing");
      setFallbackReason(reason);
      return;
    }

    setMode("iframe");
    setFallbackReason(
      hasExternalSubtitles
        ? "Đã thử Native nhiều lần nhưng nguồn Drive vẫn không ổn định. Chuyển sang iframe; phụ đề ngoài sẽ không hoạt động."
        : "Đã thử Native nhiều lần nhưng nguồn Drive vẫn không ổn định. Chuyển sang iframe dự phòng."
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
      {mode === "probing" && activeCandidate && (
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
          subtitleTracks={resolvedSubtitleTracks}
        />
      ) : mode === "iframe" ? (
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
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black text-sm text-slate-400">
          Đang kiểm tra nguồn phát...
        </div>
      )}

      {subtitleLoadError && (
        <div className="pointer-events-none absolute left-1/2 top-[18%] z-20 max-w-[88vw] -translate-x-1/2 rounded-xl border border-yellow-300/20 bg-black/80 px-4 py-2 text-center text-xs font-bold text-yellow-100 shadow-xl backdrop-blur">
          {subtitleLoadError}
        </div>
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
          hasSubtitles={resolvedSubtitleTracks.length > 0}
        />
      )}
    </div>
  );
}
