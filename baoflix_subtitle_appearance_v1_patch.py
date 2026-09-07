from __future__ import annotations

import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


PATCH_ID = "BAOFLIX_SUBTITLE_APPEARANCE_V1"


SUBTITLE_APPEARANCE_TS = r'''"use client";

import type { CSSProperties } from "react";

// BAOFLIX_SUBTITLE_APPEARANCE_V1
export const SUBTITLE_APPEARANCE_KEY = "baoflix_subtitle_appearance_v1";
export const SUBTITLE_APPEARANCE_CHANGE_EVENT =
  "baoflix-subtitle-appearance-change";

export type SubtitleSize = "small" | "medium" | "large" | "xlarge";
export type SubtitleFont = "sans" | "rounded" | "serif" | "mono";
export type SubtitleColor = "white" | "yellow" | "cyan" | "lime";
export type SubtitleBackground = "none" | "soft" | "solid";
export type SubtitleOutline = "none" | "soft" | "strong";
export type SubtitlePosition = "low" | "middle" | "high";

export type SubtitleAppearance = {
  size: SubtitleSize;
  font: SubtitleFont;
  color: SubtitleColor;
  background: SubtitleBackground;
  outline: SubtitleOutline;
  position: SubtitlePosition;
};

export const DEFAULT_SUBTITLE_APPEARANCE: SubtitleAppearance = {
  size: "medium",
  font: "rounded",
  color: "white",
  background: "soft",
  outline: "strong",
  position: "low",
};

export const SUBTITLE_SIZE_OPTIONS: ReadonlyArray<{
  value: SubtitleSize;
  label: string;
}> = [
  { value: "small", label: "Nhỏ" },
  { value: "medium", label: "Vừa" },
  { value: "large", label: "Lớn" },
  { value: "xlarge", label: "Rất lớn" },
];

export const SUBTITLE_FONT_OPTIONS: ReadonlyArray<{
  value: SubtitleFont;
  label: string;
}> = [
  { value: "sans", label: "Gọn" },
  { value: "rounded", label: "Bo tròn" },
  { value: "serif", label: "Có chân" },
  { value: "mono", label: "Mono" },
];

export const SUBTITLE_COLOR_OPTIONS: ReadonlyArray<{
  value: SubtitleColor;
  label: string;
  swatch: string;
}> = [
  { value: "white", label: "Trắng", swatch: "#ffffff" },
  { value: "yellow", label: "Vàng", swatch: "#fde047" },
  { value: "cyan", label: "Xanh lam", swatch: "#67e8f9" },
  { value: "lime", label: "Xanh lá", swatch: "#bef264" },
];

export const SUBTITLE_BACKGROUND_OPTIONS: ReadonlyArray<{
  value: SubtitleBackground;
  label: string;
}> = [
  { value: "none", label: "Không nền" },
  { value: "soft", label: "Nền mờ" },
  { value: "solid", label: "Nền đậm" },
];

export const SUBTITLE_OUTLINE_OPTIONS: ReadonlyArray<{
  value: SubtitleOutline;
  label: string;
}> = [
  { value: "none", label: "Không viền" },
  { value: "soft", label: "Viền nhẹ" },
  { value: "strong", label: "Viền đậm" },
];

export const SUBTITLE_POSITION_OPTIONS: ReadonlyArray<{
  value: SubtitlePosition;
  label: string;
}> = [
  { value: "low", label: "Thấp" },
  { value: "middle", label: "Vừa" },
  { value: "high", label: "Cao" },
];

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && options.includes(value as T);
}

export function normalizeSubtitleAppearance(
  input: unknown
): SubtitleAppearance {
  const raw =
    input && typeof input === "object"
      ? (input as Partial<SubtitleAppearance>)
      : {};

  return {
    size: isOneOf(raw.size, ["small", "medium", "large", "xlarge"])
      ? raw.size
      : DEFAULT_SUBTITLE_APPEARANCE.size,
    font: isOneOf(raw.font, ["sans", "rounded", "serif", "mono"])
      ? raw.font
      : DEFAULT_SUBTITLE_APPEARANCE.font,
    color: isOneOf(raw.color, ["white", "yellow", "cyan", "lime"])
      ? raw.color
      : DEFAULT_SUBTITLE_APPEARANCE.color,
    background: isOneOf(raw.background, ["none", "soft", "solid"])
      ? raw.background
      : DEFAULT_SUBTITLE_APPEARANCE.background,
    outline: isOneOf(raw.outline, ["none", "soft", "strong"])
      ? raw.outline
      : DEFAULT_SUBTITLE_APPEARANCE.outline,
    position: isOneOf(raw.position, ["low", "middle", "high"])
      ? raw.position
      : DEFAULT_SUBTITLE_APPEARANCE.position,
  };
}

export function readSubtitleAppearance(): SubtitleAppearance {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SUBTITLE_APPEARANCE };
  }

  try {
    const raw = localStorage.getItem(SUBTITLE_APPEARANCE_KEY);
    return normalizeSubtitleAppearance(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SUBTITLE_APPEARANCE };
  }
}

export function saveSubtitleAppearance(
  appearance: SubtitleAppearance
): SubtitleAppearance {
  const normalized = normalizeSubtitleAppearance(appearance);

  if (typeof window === "undefined") return normalized;

  try {
    localStorage.setItem(
      SUBTITLE_APPEARANCE_KEY,
      JSON.stringify(normalized)
    );
  } catch {
    // Một số TV WebView có thể chặn localStorage.
  }

  window.dispatchEvent(
    new CustomEvent(SUBTITLE_APPEARANCE_CHANGE_EVENT, {
      detail: normalized,
    })
  );

  return normalized;
}

const SIZE_MAP: Record<SubtitleSize, string> = {
  small: "clamp(14px, 1.8vw, 24px)",
  medium: "clamp(18px, 2.4vw, 34px)",
  large: "clamp(22px, 3vw, 46px)",
  xlarge: "clamp(28px, 3.8vw, 58px)",
};

const FONT_MAP: Record<SubtitleFont, string> = {
  sans: "Arial, Helvetica, sans-serif",
  rounded: '"Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Courier New", Consolas, monospace',
};

const COLOR_MAP: Record<SubtitleColor, string> = {
  white: "#ffffff",
  yellow: "#fde047",
  cyan: "#67e8f9",
  lime: "#bef264",
};

const BACKGROUND_MAP: Record<SubtitleBackground, string> = {
  none: "transparent",
  soft: "rgba(0, 0, 0, 0.48)",
  solid: "rgba(0, 0, 0, 0.82)",
};

const OUTLINE_MAP: Record<SubtitleOutline, string> = {
  none: "0 1px 2px rgba(0, 0, 0, 0.8)",
  soft:
    "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 4px rgba(0,0,0,.9)",
  strong:
    "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px #000",
};

const POSITION_MAP: Record<SubtitlePosition, string> = {
  low: "10%",
  middle: "20%",
  high: "31%",
};

export function getSubtitleTextStyle(
  appearance: SubtitleAppearance
): CSSProperties {
  const normalized = normalizeSubtitleAppearance(appearance);

  return {
    color: COLOR_MAP[normalized.color],
    fontFamily: FONT_MAP[normalized.font],
    fontSize: SIZE_MAP[normalized.size],
    fontWeight: 800,
    lineHeight: 1.35,
    letterSpacing: "0.01em",
    textShadow: OUTLINE_MAP[normalized.outline],
    backgroundColor: BACKGROUND_MAP[normalized.background],
    borderRadius: "0.28em",
    padding:
      normalized.background === "none" ? "0.02em 0.08em" : "0.12em 0.34em",
    whiteSpace: "pre-line",
    overflowWrap: "anywhere",
  };
}

export function getSubtitleBottom(
  appearance: SubtitleAppearance
): string {
  return POSITION_MAP[normalizeSubtitleAppearance(appearance).position];
}
'''


SUBTITLE_SETTINGS_TSX = r'''"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_SUBTITLE_APPEARANCE,
  getSubtitleTextStyle,
  readSubtitleAppearance,
  saveSubtitleAppearance,
  SUBTITLE_APPEARANCE_CHANGE_EVENT,
  SUBTITLE_APPEARANCE_KEY,
  SUBTITLE_BACKGROUND_OPTIONS,
  SUBTITLE_COLOR_OPTIONS,
  SUBTITLE_FONT_OPTIONS,
  SUBTITLE_OUTLINE_OPTIONS,
  SUBTITLE_POSITION_OPTIONS,
  SUBTITLE_SIZE_OPTIONS,
  type SubtitleAppearance,
} from "@/lib/subtitleAppearance";

type SubtitleAppearanceSettingsProps = {
  embedded?: boolean;
  onClose?: () => void;
};

function optionClass(active: boolean) {
  return [
    "min-h-11 rounded-2xl border px-3 py-2 text-sm font-black transition",
    active
      ? "border-yellow-300 bg-yellow-300 text-black"
      : "border-white/10 bg-white/[0.06] text-white hover:bg-white/10",
  ].join(" ");
}

export default function SubtitleAppearanceSettings({
  embedded = false,
  onClose,
}: SubtitleAppearanceSettingsProps) {
  // BAOFLIX_SUBTITLE_APPEARANCE_V1
  const [appearance, setAppearance] = useState<SubtitleAppearance>(
    DEFAULT_SUBTITLE_APPEARANCE
  );

  useEffect(() => {
    const sync = () => setAppearance(readSubtitleAppearance());
    sync();

    function handleStorage(event: StorageEvent) {
      if (!event.key || event.key === SUBTITLE_APPEARANCE_KEY) sync();
    }

    window.addEventListener(SUBTITLE_APPEARANCE_CHANGE_EVENT, sync);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(SUBTITLE_APPEARANCE_CHANGE_EVENT, sync);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function update(patch: Partial<SubtitleAppearance>) {
    const next = saveSubtitleAppearance({ ...appearance, ...patch });
    setAppearance(next);
  }

  function reset() {
    const next = saveSubtitleAppearance(DEFAULT_SUBTITLE_APPEARANCE);
    setAppearance(next);
  }

  return (
    <section
      id="subtitle-appearance"
      className={
        embedded
          ? "rounded-3xl border border-white/15 bg-[#080c14]/95 p-4 shadow-2xl backdrop-blur-xl sm:p-5"
          : "mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5"
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
            Netflix-style
          </p>
          <h2 className="mt-1 text-2xl font-black">Giao diện phụ đề</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Tùy chỉnh áp dụng ngay cho native player và được nhớ trên thiết bị này.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            data-tv-default
            data-tv-focus-key="subtitle-style:close"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black text-white hover:bg-white/10"
          >
            Đóng
          </button>
        )}
      </div>

      <div className="relative mt-5 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-700 to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.14),transparent_52%)]" />
        <div className="absolute inset-x-3 bottom-[18%] text-center">
          <span style={getSubtitleTextStyle(appearance)}>
            Phụ đề mẫu hiển thị như thế này
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-5">
        <div>
          <p className="mb-2 text-sm font-black text-white">Cỡ chữ</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SUBTITLE_SIZE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-tv-focus-key={`subtitle-style:size:${option.value}`}
                onClick={() => update({ size: option.value })}
                className={optionClass(appearance.size === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-black text-white">Font chữ</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SUBTITLE_FONT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-tv-focus-key={`subtitle-style:font:${option.value}`}
                onClick={() => update({ font: option.value })}
                className={optionClass(appearance.font === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-black text-white">Màu chữ</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SUBTITLE_COLOR_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-tv-focus-key={`subtitle-style:color:${option.value}`}
                onClick={() => update({ color: option.value })}
                className={optionClass(appearance.color === option.value)}
              >
                <span
                  className="mr-2 inline-block h-3 w-3 rounded-full border border-black/40"
                  style={{ backgroundColor: option.swatch }}
                />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-black text-white">Nền chữ</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-3 gap-2">
            {SUBTITLE_BACKGROUND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-tv-focus-key={`subtitle-style:background:${option.value}`}
                onClick={() => update({ background: option.value })}
                className={optionClass(appearance.background === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-black text-white">Viền chữ</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-3 gap-2">
            {SUBTITLE_OUTLINE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-tv-focus-key={`subtitle-style:outline:${option.value}`}
                onClick={() => update({ outline: option.value })}
                className={optionClass(appearance.outline === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-black text-white">Vị trí</p>
          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-3 gap-2">
            {SUBTITLE_POSITION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-tv-focus-key={`subtitle-style:position:${option.value}`}
                onClick={() => update({ position: option.value })}
                className={optionClass(appearance.position === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="max-w-xl text-xs leading-5 text-slate-400">
          Google Drive iframe dự phòng không cho BảoFlix vẽ phụ đề. Hãy dùng Drive Relay/native player để có giao diện này.
        </p>
        <button
          type="button"
          data-tv-focus-key="subtitle-style:reset"
          onClick={reset}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
        >
          Khôi phục mặc định
        </button>
      </div>
    </section>
  );
}
'''


def detect_newline(raw: bytes) -> str:
    return "\r\n" if b"\r\n" in raw else "\n"


def read_source(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    newline = detect_newline(raw)
    return raw.decode("utf-8").replace("\r\n", "\n"), newline


def encode_source(text: str, newline: str) -> bytes:
    normalized = text.replace("\r\n", "\n")
    if newline == "\r\n":
        normalized = normalized.replace("\n", "\r\n")
    return normalized.encode("utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"Không tìm thấy đúng 1 điểm vá cho {label} (tìm thấy {count}). "
            "Có thể source đã khác phiên bản được hỗ trợ."
        )
    return text.replace(old, new, 1)


def patch_native_player(text: str) -> str:
    text = replace_once(
        text,
        'import type { ResolvedSubtitleTrack } from "@/lib/subtitleTools";\n',
        'import type { ResolvedSubtitleTrack } from "@/lib/subtitleTools";\n'
        'import SubtitleAppearanceSettings from "@/components/SubtitleAppearanceSettings";\n'
        'import {\n'
        '  DEFAULT_SUBTITLE_APPEARANCE,\n'
        '  getSubtitleBottom,\n'
        '  getSubtitleTextStyle,\n'
        '  readSubtitleAppearance,\n'
        '  SUBTITLE_APPEARANCE_CHANGE_EVENT,\n'
        '  SUBTITLE_APPEARANCE_KEY,\n'
        '  type SubtitleAppearance,\n'
        '} from "@/lib/subtitleAppearance";\n',
        "NativeVideoPlayer imports",
    )

    text = replace_once(
        text,
        'const EMPTY_SUBTITLE_TRACKS: ResolvedSubtitleTrack[] = [];\n',
        'const EMPTY_SUBTITLE_TRACKS: ResolvedSubtitleTrack[] = [];\n'
        '// BAOFLIX_SUBTITLE_APPEARANCE_V1\n',
        "NativeVideoPlayer marker",
    )

    helper_anchor = '''function focusRemoteSurface() {
  window.dispatchEvent(new Event("baoflix-focus-tv-player-surface"));
}
'''
    helper_code = helper_anchor + r'''
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
'''
    text = replace_once(
        text,
        helper_anchor,
        helper_code,
        "NativeVideoPlayer subtitle helpers",
    )

    text = replace_once(
        text,
        '  const videoRef = useRef<HTMLVideoElement | null>(null);\n',
        '  const playerShellRef = useRef<HTMLDivElement | null>(null);\n'
        '  const videoRef = useRef<HTMLVideoElement | null>(null);\n',
        "NativeVideoPlayer shell ref",
    )

    text = replace_once(
        text,
        '  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState(-1);\n',
        '  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState(-1);\n'
        '  const [activeCueTexts, setActiveCueTexts] = useState<string[]>([]);\n'
        '  const [subtitleSettingsOpen, setSubtitleSettingsOpen] = useState(false);\n'
        '  const [isFullscreen, setIsFullscreen] = useState(false);\n'
        '  const [subtitleAppearance, setSubtitleAppearance] =\n'
        '    useState<SubtitleAppearance>(DEFAULT_SUBTITLE_APPEARANCE);\n',
        "NativeVideoPlayer subtitle state",
    )

    old_apply = '''  const applySubtitleMode = useCallback((index: number) => {
    const video = videoRef.current;
    if (!video) return;

    Array.from(video.textTracks).forEach((track, trackIndex) => {
      track.mode = trackIndex === index ? "showing" : "disabled";
    });
  }, []);
'''
    new_apply = '''  const applySubtitleMode = useCallback((
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
'''
    text = replace_once(
        text,
        old_apply,
        new_apply,
        "NativeVideoPlayer hidden subtitle track",
    )

    effect_anchor = '''  }, [applySubtitleMode, progressKey, subtitleTracks]);

  const handleCommand = useCallback(
'''
    effect_code = r'''  }, [applySubtitleMode, progressKey, subtitleTracks]);

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
'''
    text = replace_once(
        text,
        effect_anchor,
        effect_code,
        "NativeVideoPlayer subtitle effects",
    )

    text = replace_once(
        text,
        '    <div className="relative h-full w-full bg-black">\n',
        '    <div\n'
        '      ref={playerShellRef}\n'
        '      data-baoflix-subtitle-layer="custom"\n'
        '      className="relative h-full w-full overflow-hidden bg-black"\n'
        '    >\n',
        "NativeVideoPlayer shell JSX",
    )

    text = replace_once(
        text,
        '        controlsList={tvMode ? "nodownload nofullscreen noremoteplayback" : "nodownload"}\n',
        '        controlsList={tvMode ? "nodownload nofullscreen noremoteplayback" : "nodownload nofullscreen"}\n',
        "NativeVideoPlayer fullscreen controls",
    )

    text = replace_once(
        text,
        '            default={Boolean(track.default && index === 0)}\n',
        '            default={false}\n',
        "NativeVideoPlayer native subtitle default",
    )

    overlay_anchor = '''      {error && (
        <div className="pointer-events-none absolute left-1/2 top-[12%] max-w-[70vw] -translate-x-1/2 rounded-2xl bg-black/72 px-4 py-3 text-center text-sm font-bold text-yellow-100 shadow-2xl backdrop-blur">
'''
    overlay_code = r'''      {activeCueTexts.length > 0 && (
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
'''
    text = replace_once(
        text,
        overlay_anchor,
        overlay_code,
        "NativeVideoPlayer custom subtitle overlay",
    )

    return text


def patch_settings_page(text: str) -> str:
    text = replace_once(
        text,
        'import SupabaseAccountPanel from "@/components/SupabaseAccountPanel";\n',
        'import SupabaseAccountPanel from "@/components/SupabaseAccountPanel";\n'
        'import SubtitleAppearanceSettings from "@/components/SubtitleAppearanceSettings";\n',
        "SettingsPage import",
    )
    text = replace_once(
        text,
        '      <SupabaseAccountPanel />\n',
        '      <SubtitleAppearanceSettings />\n\n'
        '      <SupabaseAccountPanel />\n',
        "SettingsPage subtitle section",
    )
    return text


def patch_account_state(text: str) -> str:
    return replace_once(
        text,
        '  "baoflix_video_progress_v1",\n',
        '  "baoflix_video_progress_v1",\n'
        '  "baoflix_subtitle_appearance_v1",\n',
        "account-local subtitle appearance key",
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Thêm giao diện phụ đề Netflix-style cho BảoFlix local."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Thư mục gốc BảoFlix (mặc định: thư mục hiện tại).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Chỉ kiểm tra khả năng vá, không ghi file.",
    )
    args = parser.parse_args()

    root = args.root.resolve()
    package_json = root / "package.json"
    if not package_json.is_file():
        print(f"[LỖI] Không thấy package.json tại: {root}")
        print("Hãy đặt file patcher trong C:\\Local\\baoflix rồi chạy lại.")
        return 2

    native_path = root / "components" / "NativeVideoPlayer.tsx"
    settings_page_path = root / "app" / "cai-dat" / "page.tsx"
    account_state_path = root / "lib" / "accountLocalState.ts"
    appearance_path = root / "lib" / "subtitleAppearance.ts"
    settings_component_path = root / "components" / "SubtitleAppearanceSettings.tsx"

    required = [native_path, settings_page_path, account_state_path]
    missing = [str(path.relative_to(root)) for path in required if not path.is_file()]
    if missing:
        print("[LỖI] Thiếu file source cần thiết:")
        for item in missing:
            print(f"  - {item}")
        return 2

    native_text, native_newline = read_source(native_path)
    settings_text, settings_newline = read_source(settings_page_path)
    account_text, account_newline = read_source(account_state_path)

    already_applied = (
        PATCH_ID in native_text
        and appearance_path.is_file()
        and settings_component_path.is_file()
    )
    if already_applied:
        print("[OK] Patch Giao diện phụ đề V1 đã có sẵn. Không ghi đè lần nữa.")
        return 0

    if appearance_path.exists() or settings_component_path.exists():
        print("[LỖI] Có file trùng tên nhưng patch chưa hoàn chỉnh:")
        if appearance_path.exists():
            print("  - lib/subtitleAppearance.ts")
        if settings_component_path.exists():
            print("  - components/SubtitleAppearanceSettings.tsx")
        print("Hãy kiểm tra thủ công để tránh ghi đè code đang có.")
        return 2

    try:
        patched_native = patch_native_player(native_text)
        patched_settings = patch_settings_page(settings_text)
        patched_account = patch_account_state(account_text)
    except RuntimeError as error:
        print(f"[LỖI] {error}")
        return 2

    planned = [
        "Sửa components/NativeVideoPlayer.tsx",
        "Sửa app/cai-dat/page.tsx",
        "Sửa lib/accountLocalState.ts",
        "Tạo lib/subtitleAppearance.ts",
        "Tạo components/SubtitleAppearanceSettings.tsx",
    ]

    print("[KIỂM TRA] Patch tương thích với source hiện tại.")
    for item in planned:
        print(f"  - {item}")

    if args.dry_run:
        print("[DRY-RUN] Chưa thay đổi file nào.")
        return 0

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = (
        root
        / ".baoflix_patch_backups"
        / f"subtitle-appearance-v1-{timestamp}"
    )

    for source in required:
        target = backup_root / source.relative_to(root)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    writes = {
        native_path: encode_source(patched_native, native_newline),
        settings_page_path: encode_source(patched_settings, settings_newline),
        account_state_path: encode_source(patched_account, account_newline),
        appearance_path: encode_source(SUBTITLE_APPEARANCE_TS, native_newline),
        settings_component_path: encode_source(
            SUBTITLE_SETTINGS_TSX, native_newline
        ),
    }

    try:
        for path, content in writes.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_name(f".{path.name}.baoflix-tmp")
            temporary.write_bytes(content)
            temporary.replace(path)
    except Exception as error:
        print(f"[LỖI] Ghi file thất bại: {error}")
        print(f"Backup an toàn nằm tại: {backup_root}")
        return 3

    print("[XONG] Đã thêm Giao diện phụ đề Netflix-style vào BảoFlix local.")
    print(f"[BACKUP] {backup_root}")
    print("Bước tiếp theo: chạy npm run lint, sau đó npm run build.")
    print("Patch này không commit và không push GitHub.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
