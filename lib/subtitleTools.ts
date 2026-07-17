"use client";

import type { EpisodeSubtitle } from "@/lib/kkphim";

export type ResolvedSubtitleTrack = {
  label: string;
  lang: string;
  url: string;
  default?: boolean;
};

function normalizeNewlines(value: string) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n");
}

export function extractDriveFileId(url: string) {
  const value = String(url || "").trim();

  const fileMatch = value.match(
    /drive\.google\.com\/file\/d\/([^/?#]+)/i
  );
  if (fileMatch?.[1]) return fileMatch[1];

  const idMatch = value.match(/[?&]id=([^&#]+)/i);
  if (idMatch?.[1]) {
    try {
      return decodeURIComponent(idMatch[1]);
    } catch {
      return idMatch[1];
    }
  }

  return "";
}

function extractDriveResourceKey(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("resourcekey") || "";
  } catch {
    return "";
  }
}

export function buildSubtitleFetchUrl(
  subtitle: EpisodeSubtitle,
  relayBase: string
) {
  const rawUrl = String(subtitle?.url || "").trim();
  if (!rawUrl) return "";

  const fileId = extractDriveFileId(rawUrl);
  const cleanRelay = String(relayBase || "")
    .trim()
    .replace(/\/+$/, "");

  if (fileId && cleanRelay) {
    const resourceKey = extractDriveResourceKey(rawUrl);
    const suffix = resourceKey
      ? `?resourcekey=${encodeURIComponent(resourceKey)}`
      : "";

    return `${cleanRelay}/video/${encodeURIComponent(fileId)}${suffix}`;
  }

  return rawUrl;
}

function srtToVtt(input: string) {
  const normalized = normalizeNewlines(input).trim();

  if (!normalized) {
    throw new Error("File phụ đề trống.");
  }

  return (
    "WEBVTT\n\n" +
    normalized.replace(
      /(\d{1,2}:\d{2}:\d{2}),(\d{1,3})/g,
      (_match, time, milliseconds) =>
        `${time}.${String(milliseconds).padEnd(3, "0").slice(0, 3)}`
    )
  );
}

function assTimeToVtt(value: string) {
  const match = String(value || "")
    .trim()
    .match(/^(\d+):(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?$/);

  if (!match) return "";

  const hours = String(Number(match[1] || 0)).padStart(2, "0");
  const minutes = String(Number(match[2] || 0)).padStart(2, "0");
  const seconds = String(Number(match[3] || 0)).padStart(2, "0");
  const fraction = String(match[4] || "0")
    .padEnd(3, "0")
    .slice(0, 3);

  return `${hours}:${minutes}:${seconds}.${fraction}`;
}

function splitAssFields(payload: string, fieldCount: number) {
  const fields: string[] = [];
  let remaining = payload;

  for (let index = 0; index < fieldCount - 1; index += 1) {
    const commaIndex = remaining.indexOf(",");

    if (commaIndex < 0) {
      fields.push(remaining);
      remaining = "";
      break;
    }

    fields.push(remaining.slice(0, commaIndex));
    remaining = remaining.slice(commaIndex + 1);
  }

  fields.push(remaining);

  while (fields.length < fieldCount) fields.push("");

  return fields;
}

function cleanAssText(value: string) {
  return String(value || "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\\N/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\h/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

function assToVtt(input: string) {
  const lines = normalizeNewlines(input).split("\n");
  let inEvents = false;
  let format = [
    "Layer",
    "Start",
    "End",
    "Style",
    "Name",
    "MarginL",
    "MarginR",
    "MarginV",
    "Effect",
    "Text",
  ];
  const cues: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^\[Events\]$/i.test(line)) {
      inEvents = true;
      continue;
    }

    if (/^\[[^\]]+\]$/.test(line)) {
      inEvents = false;
      continue;
    }

    if (!inEvents) continue;

    if (/^Format\s*:/i.test(line)) {
      const nextFormat = line
        .replace(/^Format\s*:/i, "")
        .split(",")
        .map((item) => item.trim());

      if (nextFormat.length >= 3) format = nextFormat;
      continue;
    }

    if (!/^Dialogue\s*:/i.test(line)) continue;

    const payload = line.replace(/^Dialogue\s*:/i, "");
    const fields = splitAssFields(payload, format.length);
    const lowerFormat = format.map((item) => item.toLowerCase());

    const startIndex = lowerFormat.indexOf("start");
    const endIndex = lowerFormat.indexOf("end");
    const textIndex = lowerFormat.indexOf("text");

    if (startIndex < 0 || endIndex < 0 || textIndex < 0) continue;

    const start = assTimeToVtt(fields[startIndex]);
    const end = assTimeToVtt(fields[endIndex]);
    const text = cleanAssText(fields[textIndex]);

    if (!start || !end || !text) continue;

    cues.push(`${start} --> ${end}\n${text}`);
  }

  if (cues.length === 0) {
    throw new Error("Không tìm thấy Dialogue hợp lệ trong file ASS.");
  }

  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

export function convertSubtitleTextToVtt(
  input: string,
  sourceUrl = ""
) {
  const normalized = normalizeNewlines(input).trim();
  const lowerUrl = String(sourceUrl || "").toLowerCase();

  if (!normalized) throw new Error("File phụ đề trống.");

  if (/^WEBVTT(?:\s|$)/i.test(normalized)) {
    return `${normalized}\n`;
  }

  if (
    lowerUrl.includes(".ass") ||
    lowerUrl.includes(".ssa") ||
    /\[Events\]/i.test(normalized) ||
    /^Dialogue\s*:/im.test(normalized)
  ) {
    return assToVtt(normalized);
  }

  if (lowerUrl.includes(".srt") || /-->/m.test(normalized)) {
    return srtToVtt(normalized);
  }

  throw new Error(
    "Không nhận diện được phụ đề. Hãy dùng ASS, SRT hoặc VTT."
  );
}
