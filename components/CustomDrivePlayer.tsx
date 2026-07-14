"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { isTvModeActive } from "@/lib/tvMode";

type CustomDrivePlayerProps = {
  src: string;
  title: string;
  storageKey: string;
  previousHref?: string;
  nextHref?: string;
  detailHref: string;
  onOpenEpisodes: () => void;
};

type StoredDriveEstimate = {
  seconds: number;
  updatedAt: string;
};

const AUTO_ENTER_DELAY_MS = 1800;
const SAVE_INTERVAL_SECONDS = 5;

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readEstimate(storageKey: string) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return 0;

    const parsed = JSON.parse(raw) as Partial<StoredDriveEstimate>;
    const seconds = Number(parsed.seconds || 0);

    return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
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

    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Bỏ qua nếu WebView chặn localStorage.
  }
}

export default function CustomDrivePlayer({
  src,
  title,
  storageKey,
  previousHref,
  nextHref,
  detailHref,
  onOpenEpisodes,
}: CustomDrivePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const secondsRef = useRef(0);
  const saveTickRef = useRef(0);
  const autoEnterTimerRef = useRef<number | null>(null);

  const [tvMode, setTvMode] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [seconds, setSeconds] = useState(0);

  const oldMarkerLabel = useMemo(() => {
    return seconds > 0 ? formatTime(seconds) : "chưa có";
  }, [seconds]);

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
    const saved = readEstimate(storageKey);
    secondsRef.current = saved;
    setSeconds(saved);
    saveTickRef.current = saved;
  }, [storageKey]);

  useEffect(() => {
    if (!tvMode) {
      setTracking(false);
      setOverlayVisible(false);
      return;
    }

    setOverlayVisible(true);

    autoEnterTimerRef.current = window.setTimeout(() => {
      autoEnterTimerRef.current = null;
      setTracking(true);
      setOverlayVisible(false);

      window.setTimeout(() => {
        iframeRef.current?.focus({ preventScroll: true });
      }, 80);
    }, AUTO_ENTER_DELAY_MS);

    return () => {
      if (autoEnterTimerRef.current !== null) {
        window.clearTimeout(autoEnterTimerRef.current);
        autoEnterTimerRef.current = null;
      }
    };
  }, [src, tvMode]);

  useEffect(() => {
    if (!tracking) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;

      secondsRef.current += 1;
      const next = secondsRef.current;
      setSeconds(next);

      if (next - saveTickRef.current >= SAVE_INTERVAL_SECONDS) {
        saveTickRef.current = next;
        saveEstimate(storageKey, next);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [storageKey, tracking]);

  useEffect(() => {
    function flushEstimate() {
      saveEstimate(storageKey, secondsRef.current);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushEstimate();
      }
    }

    window.addEventListener("pagehide", flushEstimate);
    window.addEventListener("beforeunload", flushEstimate);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      flushEstimate();
      window.removeEventListener("pagehide", flushEstimate);
      window.removeEventListener("beforeunload", flushEstimate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [storageKey]);

  function clearAutoEnterTimer() {
    if (autoEnterTimerRef.current !== null) {
      window.clearTimeout(autoEnterTimerRef.current);
      autoEnterTimerRef.current = null;
    }
  }

  function enterDrivePlayer() {
    clearAutoEnterTimer();
    setTracking(true);
    setOverlayVisible(false);

    window.setTimeout(() => {
      iframeRef.current?.focus({ preventScroll: true });
    }, 50);
  }

  function openEpisodes() {
    clearAutoEnterTimer();
    setTracking(false);
    onOpenEpisodes();
  }

  function resetEstimate() {
    secondsRef.current = 0;
    saveTickRef.current = 0;
    setSeconds(0);
    saveEstimate(storageKey, 0);
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <iframe
        ref={iframeRef}
        src={src}
        allowFullScreen
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        tabIndex={0}
        data-tv-player="drive-iframe"
        className="h-full w-full border-0 bg-black outline-none"
        title={title}
      />

      {tvMode && !overlayVisible && (
        <div className="pointer-events-none absolute right-4 top-4 rounded-xl border border-white/10 bg-black/65 px-3 py-2 text-right shadow-xl backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-yellow-300">
            Mốc xem ước tính
          </p>
          <p className="mt-0.5 text-sm font-black text-white">{formatTime(seconds)}</p>
        </div>
      )}

      {tvMode && overlayVisible && (
        <div className="absolute inset-0 z-20 flex items-end bg-gradient-to-t from-black via-black/60 to-black/20 p-[4vw]">
          <div className="w-full rounded-3xl border border-white/10 bg-[#080c14]/95 p-5 shadow-2xl backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
              Google Drive trên TV
            </p>

            <h2 className="mt-2 line-clamp-1 text-xl font-black text-white">
              {title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              Đang phóng kín màn hình. BảoFlix sẽ tự chuyển focus vào Drive sau
              giây lát. Nếu video chưa tự chạy, bấm OK một lần.
            </p>

            <p className="mt-2 text-sm font-bold text-yellow-100">
              Lần trước bạn mở tới khoảng: {oldMarkerLabel}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Đây là thời gian ước tính khi trang đang mở; Drive không cho app
              đọc thời điểm phát thật bên trong iframe.
            </p>

            <div
              data-tv-row
              data-tv-row-wrap="true"
              className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-6"
            >
              <button
                type="button"
                data-tv-default
                onClick={enterDrivePlayer}
                className="rounded-2xl bg-yellow-300 px-4 py-3 text-sm font-black text-black hover:bg-yellow-200"
              >
                ▶ Vào trình phát
              </button>

              <button
                type="button"
                onClick={openEpisodes}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15"
              >
                Tập
              </button>

              {previousHref ? (
                <Link
                  href={previousHref}
                  onClick={clearAutoEnterTimer}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/15"
                >
                  ← Tập trước
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white opacity-35"
                >
                  ← Tập trước
                </button>
              )}

              {nextHref ? (
                <Link
                  href={nextHref}
                  onClick={clearAutoEnterTimer}
                  className="rounded-2xl bg-red-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-red-500"
                >
                  Tập sau →
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white opacity-35"
                >
                  Tập sau →
                </button>
              )}

              <Link
                href="/cai-dat?tv=1"
                onClick={clearAutoEnterTimer}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/15"
              >
                Cài đặt
              </Link>

              <Link
                href={detailHref}
                onClick={clearAutoEnterTimer}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/15"
              >
                Thoát phim
              </Link>
            </div>

            {seconds > 0 && (
              <button
                type="button"
                onClick={resetEstimate}
                className="mt-3 text-xs font-bold text-slate-400 underline underline-offset-4 hover:text-white"
              >
                Đặt lại mốc ước tính về 0
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
