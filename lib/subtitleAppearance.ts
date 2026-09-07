"use client";

import type { CSSProperties } from "react";

// BAOFLIX_SUBTITLE_APPEARANCE_V1
// BAOFLIX_SUBTITLE_FONTS_V2
export const SUBTITLE_APPEARANCE_KEY = "baoflix_subtitle_appearance_v1";
export const SUBTITLE_APPEARANCE_CHANGE_EVENT =
  "baoflix-subtitle-appearance-change";

export type SubtitleSize = "small" | "medium" | "large" | "xlarge";
export type SubtitleFont =
  | "be-vietnam-pro"
  | "arimo"
  | "open-sans"
  | "nunito-sans"
  | "lato";
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
  font: "be-vietnam-pro",
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
  { value: "be-vietnam-pro", label: "Be Vietnam Pro" },
  { value: "arimo", label: "Arimo" },
  { value: "open-sans", label: "Open Sans" },
  { value: "nunito-sans", label: "Nunito Sans" },
  { value: "lato", label: "Lato" },
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
    font: isOneOf(raw.font, [
      "be-vietnam-pro",
      "arimo",
      "open-sans",
      "nunito-sans",
      "lato",
    ])
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
  "be-vietnam-pro": '"BaoFlix Be Vietnam Pro", Arial, Helvetica, sans-serif',
  arimo: '"BaoFlix Arimo", Arial, Helvetica, sans-serif',
  "open-sans": '"BaoFlix Open Sans", Arial, Helvetica, sans-serif',
  "nunito-sans": '"BaoFlix Nunito Sans", Arial, Helvetica, sans-serif',
  lato: '"BaoFlix Lato", Arial, Helvetica, sans-serif',
};

const FONT_WEIGHT_MAP: Record<SubtitleFont, number> = {
  "be-vietnam-pro": 800,
  arimo: 700,
  "open-sans": 700,
  "nunito-sans": 800,
  lato: 800,
};

export function getSubtitleFontFamily(font: SubtitleFont): string {
  return FONT_MAP[font];
}

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
    fontFamily: getSubtitleFontFamily(normalized.font),
    fontSize: SIZE_MAP[normalized.size],
    fontWeight: FONT_WEIGHT_MAP[normalized.font],
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
