#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BảoFlix - Custom Movie Subtitle Patch (.ass / .srt / .vtt)

Chạy trong thư mục gốc repo BảoFlix, cạnh package.json:
    python baoflix_custom_subtitle_ass_patch.py

- Thêm phụ đề riêng cho từng tập phim riêng.
- Hỗ trợ link Google Drive chứa .ass, .srt hoặc .vtt.
- Dùng NEXT_PUBLIC_DRIVE_RELAY_URL hiện tại để tải file phụ đề.
- Chuyển ASS/SRT sang WebVTT ngay trong trình duyệt.
- Thêm nút Phụ đề trên overlay TV.
- Không sửa Supabase, Worker hoặc GitHub.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


SUBTITLE_TOOLS_TS = r'''"use client";

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
'''


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path)
    parser.add_argument("--skip-build", action="store_true")
    return parser.parse_args()


def find_root(start: Path) -> Path:
    start = start.resolve()

    for candidate in [start, *start.parents]:
        if (
            (candidate / "package.json").is_file()
            and (candidate / "components" / "CustomDrivePlayer.tsx").is_file()
            and (candidate / "lib" / "customMoviesClient.ts").is_file()
        ):
            return candidate

    raise FileNotFoundError(
        "Không tìm thấy repo BảoFlix. Đặt file cạnh package.json "
        "hoặc dùng --repo DUONG_DAN."
    )


def rep(text: str, old: str, new: str, label: str, marker: str = ""):
    if old in text:
        return text.replace(old, new, 1)

    if marker and marker in text:
        return text

    raise RuntimeError(f"Không tìm thấy đoạn cần vá: {label}")


def patch_kkphim(text: str) -> str:
    return rep(
        text,
        """export type Episode = {
  name: string;
  slug?: string;
  filename?: string;
  link_embed?: string;
  link_m3u8?: string;
};""",
        """export type EpisodeSubtitle = {
  label: string;
  lang: string;
  url: string;
  default?: boolean;
};

export type Episode = {
  name: string;
  slug?: string;
  filename?: string;
  link_embed?: string;
  link_m3u8?: string;
  subtitles?: EpisodeSubtitle[];
};""",
        "type Episode",
        "export type EpisodeSubtitle",
    )


def patch_custom_client(text: str) -> str:
    text = rep(
        text,
        'import type { MovieDetailResponse } from "@/lib/kkphim";',
        'import type { EpisodeSubtitle, MovieDetailResponse } from "@/lib/kkphim";',
        "import EpisodeSubtitle",
        "EpisodeSubtitle, MovieDetailResponse",
    )

    if "function buildDefaultEpisodeSubtitles" not in text:
        helper = """function buildDefaultEpisodeSubtitles(
  url: string
): EpisodeSubtitle[] {
  const cleanUrl = String(url || "").trim();

  return cleanUrl
    ? [
        {
          label: "Tiếng Việt",
          lang: "vi",
          url: cleanUrl,
          default: true,
        },
      ]
    : [];
}

"""
        text = rep(
            text,
            "function parseSeasonsFromText(name: string, episodesText: string) {",
            helper + "function parseSeasonsFromText(name: string, episodesText: string) {",
            "helper subtitle",
        )

    text = text.replace(
        """      link_m3u8: string;
    }[];""",
        """      link_m3u8: string;
      subtitles?: EpisodeSubtitle[];
    }[];""",
    )

    text = text.replace(
        """      link_m3u8: string;
    }[],""",
        """      link_m3u8: string;
      subtitles?: EpisodeSubtitle[];
    }[],""",
    )

    text = rep(
        text,
        """    let episodeName = `Tập ${String(index).padStart(2, "0")}`;
    let linkRaw = line;

    if (line.includes("|")) {
      const parts = line.split("|");
      episodeName = parts[0]?.trim() || episodeName;
      linkRaw = parts.slice(1).join("|").trim();
    }

    const isHls = /\\.m3u8(\\?|$)/i.test(linkRaw);""",
        """    let episodeName = `Tập ${String(index).padStart(2, "0")}`;
    let linkRaw = line;
    let subtitleRaw = "";

    if (line.includes("|")) {
      const parts = line.split("|");
      episodeName = parts[0]?.trim() || episodeName;
      linkRaw = parts[1]?.trim() || "";
      subtitleRaw = parts.slice(2).join("|").trim();
    }

    const isHls = /\\.m3u8(\\?|$)/i.test(linkRaw);""",
        "parser ba cột",
        'let subtitleRaw = "";',
    )

    text = rep(
        text,
        """      link_embed: link,
      link_m3u8: isHls ? linkRaw : "",
    });""",
        """      link_embed: link,
      link_m3u8: isHls ? linkRaw : "",
      subtitles: buildDefaultEpisodeSubtitles(subtitleRaw),
    });""",
        "lưu subtitle",
        "subtitles: buildDefaultEpisodeSubtitles(subtitleRaw)",
    )

    return text


def patch_form(text: str) -> str:
    text = rep(
        text,
        """placeholder={`# Mùa 1
Tập 01 | https://drive.google.com/file/d/xxx/view
Tập 02 | https://drive.google.com/file/d/yyy/view

# Mùa 2
Tập 01 | https://drive.google.com/file/d/zzz/view
Tập 02 | https://drive.google.com/file/d/abc/view`}""",
        """placeholder={`# Mùa 1
Tập 01 | https://drive.google.com/file/d/video01/view | https://drive.google.com/file/d/sub01/view
Tập 02 | https://drive.google.com/file/d/video02/view | https://drive.google.com/file/d/sub02/view

# Mùa 2
Tập 01 | https://drive.google.com/file/d/video03/view | https://drive.google.com/file/d/sub03/view
Tập 02 | https://drive.google.com/file/d/video04/view`}""",
        "placeholder form",
        "video01/view | https://drive.google.com/file/d/sub01/view",
    )

    return rep(
        text,
        """            <b>Tên tập | Link video</b>. Nếu chỉ dán link, app tự đặt Tập 01,
            Tập 02...""",
        """            <b>Tên tập | Link video | Link phụ đề</b>. Phụ đề hỗ trợ link
            Drive chứa ASS, SRT hoặc VTT. Có thể bỏ trống cột phụ đề. Nếu chỉ
            dán link video, app tự đặt Tập 01, Tập 02...""",
        "help form",
        "Drive chứa ASS, SRT hoặc VTT",
    )


def patch_manage(text: str) -> str:
    if 'import type { EpisodeSubtitle } from "@/lib/kkphim";' not in text:
        text = rep(
            text,
            'import { slugify } from "@/lib/slugify";',
            'import { slugify } from "@/lib/slugify";\nimport type { EpisodeSubtitle } from "@/lib/kkphim";',
            "import manage",
        )

    text = rep(
        text,
        """type EpisodeDraft = {
  name: string;
  link: string;
};""",
        """type EpisodeDraft = {
  name: string;
  link: string;
  subtitleLink: string;
};""",
        "EpisodeDraft",
        "subtitleLink: string;",
    )

    text = rep(
        text,
        """      if (line.includes("|")) {
        const parts = line.split("|");

        return {
          name: parts[0]?.trim() || "",
          link: parts.slice(1).join("|").trim(),
        };
      }

      return {
        name: "",
        link: line,
      };""",
        """      if (line.includes("|")) {
        const parts = line.split("|");

        return {
          name: parts[0]?.trim() || "",
          link: parts[1]?.trim() || "",
          subtitleLink: parts.slice(2).join("|").trim(),
        };
      }

      return {
        name: "",
        link: line,
        subtitleLink: "",
      };""",
        "bulk parser",
        "subtitleLink: parts.slice(2)",
    )

    text = rep(
        text,
        """  const [episodeName, setEpisodeName] = useState("");
  const [episodeLink, setEpisodeLink] = useState("");
  const [bulkEpisodesText, setBulkEpisodesText] = useState("");""",
        """  const [episodeName, setEpisodeName] = useState("");
  const [episodeLink, setEpisodeLink] = useState("");
  const [episodeSubtitleLink, setEpisodeSubtitleLink] = useState("");
  const [bulkEpisodesText, setBulkEpisodesText] = useState("");""",
        "state manage",
        "episodeSubtitleLink",
    )

    anchor = """function getEpisodeLinkValue(episode: { link_embed?: string; link_m3u8?: string }) {
  return episode.link_m3u8 || episode.link_embed || "";
}"""

    if "function buildDefaultSubtitle" not in text:
        text = rep(
            text,
            anchor,
            anchor + """

function buildDefaultSubtitle(url: string): EpisodeSubtitle[] {
  const cleanUrl = String(url || "").trim();

  return cleanUrl
    ? [
        {
          label: "Tiếng Việt",
          lang: "vi",
          url: cleanUrl,
          default: true,
        },
      ]
    : [];
}""",
            "helper manage",
        )

    text = rep(
        text,
        """    const cleanEpisodeName = episodeName.trim();
    const cleanLink = episodeLink.trim();""",
        """    const cleanEpisodeName = episodeName.trim();
    const cleanLink = episodeLink.trim();
    const cleanSubtitleLink = episodeSubtitleLink.trim();""",
        "clean subtitle",
        "cleanSubtitleLink",
    )

    text = rep(
        text,
        """      filename: `${movie.name} - ${cleanSeasonName} - ${finalEpisodeName}`,
      ...normalizeEpisodeLink(cleanLink),
    });""",
        """      filename: `${movie.name} - ${cleanSeasonName} - ${finalEpisodeName}`,
      ...normalizeEpisodeLink(cleanLink),
      subtitles: buildDefaultSubtitle(cleanSubtitleLink),
    });""",
        "add episode subtitle",
        "buildDefaultSubtitle(cleanSubtitleLink)",
    )

    text = rep(
        text,
        """    setEpisodeName("");
    setEpisodeLink("");""",
        """    setEpisodeName("");
    setEpisodeLink("");
    setEpisodeSubtitleLink("");""",
        "reset subtitle",
        "setEpisodeSubtitleLink",
    )

    text = rep(
        text,
        """        filename: `${movie.name} - ${cleanSeasonName} - ${finalEpisodeName}`,
        ...normalizeEpisodeLink(draft.link),
      });""",
        """        filename: `${movie.name} - ${cleanSeasonName} - ${finalEpisodeName}`,
        ...normalizeEpisodeLink(draft.link),
        subtitles: buildDefaultSubtitle(draft.subtitleLink),
      });""",
        "bulk subtitle",
        "buildDefaultSubtitle(draft.subtitleLink)",
    )

    text = rep(
        text,
        """      name?: string;
      link_embed?: string;
      link_m3u8?: string;
    }""",
        """      name?: string;
      link_embed?: string;
      link_m3u8?: string;
      subtitles?: EpisodeSubtitle[];
    }""",
        "update type",
        "subtitles?: EpisodeSubtitle[];",
    )

    text = rep(
        text,
        """    if (typeof nextValue.link_m3u8 === "string") {
      episode.link_m3u8 = nextValue.link_m3u8;
    }

    saveUpdatedMovie(cloned, "Đã cập nhật tập.");""",
        """    if (typeof nextValue.link_m3u8 === "string") {
      episode.link_m3u8 = nextValue.link_m3u8;
    }

    if (Array.isArray(nextValue.subtitles)) {
      episode.subtitles = nextValue.subtitles;
    }

    saveUpdatedMovie(cloned, "Đã cập nhật tập.");""",
        "update save",
        "episode.subtitles = nextValue.subtitles",
    )

    text = rep(
        text,
        '          <div className="grid gap-4 md:grid-cols-[1fr_2fr_auto]">',
        '          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_2fr_2fr_auto]">',
        "grid add episode",
        "xl:grid-cols-[1fr_2fr_2fr_auto]",
    )

    insert_before = """            <div className="flex items-end">
              <button
                type="button"
                onClick={addEpisode}"""

    if "Link phụ đề ASS / SRT / VTT" not in text:
        subtitle_input = """            <label className="grid gap-2">
              <span className="text-sm font-bold">
                Link phụ đề ASS / SRT / VTT
              </span>

              <input
                value={episodeSubtitleLink}
                onChange={(event) =>
                  setEpisodeSubtitleLink(event.target.value)
                }
                placeholder="Google Drive public, có thể để trống"
                className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
              />
            </label>

"""
        text = rep(
            text,
            insert_before,
            subtitle_input + insert_before,
            "single subtitle input",
        )

    text = rep(
        text,
        """placeholder={`Tập 04 | https://drive.google.com/file/d/xxx/view
Tập 05 | https://drive.google.com/file/d/yyy/view
Tập 06 | https://drive.google.com/file/d/zzz/view`}""",
        """placeholder={`Tập 04 | https://drive.google.com/file/d/video04/view | https://drive.google.com/file/d/sub04/view
Tập 05 | https://drive.google.com/file/d/video05/view | https://drive.google.com/file/d/sub05/view
Tập 06 | https://drive.google.com/file/d/video06/view`}""",
        "bulk placeholder",
        "video04/view | https://drive.google.com/file/d/sub04/view",
    )

    text = rep(
        text,
        """              Mỗi dòng một tập. Có thể dùng dạng <b>Tên tập | Link</b>. Nếu chỉ
              dán link, app tự đặt tên tập tiếp theo.""",
        """              Mỗi dòng một tập. Dùng dạng{" "}
              <b>Tên tập | Link video | Link phụ đề</b>. Cột phụ đề có thể
              để trống; hỗ trợ ASS, SRT và VTT trên Google Drive.""",
        "bulk help",
        "Cột phụ đề có thể",
    )

    text = rep(
        text,
        """                              {episodeIndex + 1}. {episode.name}""",
        """                              <span>
                                {episodeIndex + 1}. {episode.name}
                              </span>
                              {episode.subtitles?.length ? (
                                <span className="ml-2 rounded-full border border-yellow-300/30 bg-yellow-300/10 px-2 py-0.5 text-[10px] font-black text-yellow-200">
                                  CC
                                </span>
                              ) : null}""",
        "CC badge",
        'className="ml-2 rounded-full',
    )

    anchor_input = """                          <label className="grid gap-2">
                            <span className="text-xs font-bold text-slate-400">
                              Link m3u8 nếu có
                            </span>

                            <input
                              defaultValue={episode.link_m3u8 || ""}
                              onBlur={(event) =>
                                updateEpisode(seasonIndex, episodeIndex, {
                                  link_m3u8: event.currentTarget.value,
                                })
                              }
                              className="rounded-xl border border-white/10 bg-[#10131d] px-3 py-2 text-sm text-white outline-none"
                            />
                          </label>"""

    if 'defaultValue={episode.subtitles?.[0]?.url || ""}' not in text:
        text = rep(
            text,
            anchor_input,
            anchor_input + """

                          <label className="grid gap-2">
                            <span className="text-xs font-bold text-slate-400">
                              Phụ đề ASS / SRT / VTT
                            </span>

                            <input
                              defaultValue={episode.subtitles?.[0]?.url || ""}
                              onBlur={(event) =>
                                updateEpisode(seasonIndex, episodeIndex, {
                                  subtitles: buildDefaultSubtitle(
                                    event.currentTarget.value
                                  ),
                                })
                              }
                              placeholder="Link Google Drive public; để trống để tắt"
                              className="rounded-xl border border-white/10 bg-[#10131d] px-3 py-2 text-sm text-white outline-none"
                            />
                          </label>""",
            "edit subtitle input",
        )

    return text


def patch_watch(text: str) -> str:
    return rep(
        text,
        """              detailHref={`/ca-nhan/${movie.slug}`}
              poster={movie.thumb_url || movie.poster_url}
              onOpenEpisodes={() => setEpisodePanelOpen(true)}""",
        """              detailHref={`/ca-nhan/${movie.slug}`}
              poster={movie.thumb_url || movie.poster_url}
              subtitles={episode.subtitles}
              onOpenEpisodes={() => setEpisodePanelOpen(true)}""",
        "watch props",
        "subtitles={episode.subtitles}",
    )


def patch_drive_player(text: str) -> str:
    text = rep(
        text,
        'import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";',
        'import type { EpisodeServer, EpisodeSubtitle, MovieDetail } from "@/lib/kkphim";\nimport {\n  buildSubtitleFetchUrl,\n  convertSubtitleTextToVtt,\n  type ResolvedSubtitleTrack,\n} from "@/lib/subtitleTools";',
        "drive imports",
        'from "@/lib/subtitleTools";',
    )

    text = rep(
        text,
        """  detailHref: string;
  poster?: string;
  onOpenEpisodes: () => void;""",
        """  detailHref: string;
  poster?: string;
  subtitles?: EpisodeSubtitle[];
  onOpenEpisodes: () => void;""",
        "drive props",
        "subtitles?: EpisodeSubtitle[];",
    )

    text = rep(
        text,
        """  detailHref,
  poster,
  onOpenEpisodes,""",
        """  detailHref,
  poster,
  subtitles = EMPTY_SUBTITLES,
  onOpenEpisodes,""",
        "drive destructure",
        "subtitles = EMPTY_SUBTITLES,",
    )

    text = rep(
        text,
        """const SAVE_INTERVAL_SECONDS = 5;""",
        """const SAVE_INTERVAL_SECONDS = 5;
const EMPTY_SUBTITLES: EpisodeSubtitle[] = [];""",
        "drive empty subtitles constant",
        "const EMPTY_SUBTITLES",
    )

    text = rep(
        text,
        """  const [fallbackReason, setFallbackReason] = useState("");
  const [estimateSeconds, setEstimateSeconds] = useState(0);""",
        """  const [fallbackReason, setFallbackReason] = useState("");
  const [estimateSeconds, setEstimateSeconds] = useState(0);
  const [resolvedSubtitleTracks, setResolvedSubtitleTracks] = useState<
    ResolvedSubtitleTrack[]
  >([]);
  const [subtitleLoadError, setSubtitleLoadError] = useState("");""",
        "drive state",
        "resolvedSubtitleTracks",
    )

    if "async function loadSubtitleTracks()" not in text:
        effect = """  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    async function loadSubtitleTracks() {
      setResolvedSubtitleTracks([]);
      setSubtitleLoadError("");

      if (!tvMode || subtitles.length === 0) return;

      const relayBase = String(
        process.env.NEXT_PUBLIC_DRIVE_RELAY_URL || ""
      )
        .trim()
        .replace(/\\/+$/, "");

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
  }, [subtitles, tvMode]);

"""
        text = rep(
            text,
            """  useEffect(() => {
    function refreshTvMode() {""",
            effect + """  useEffect(() => {
    function refreshTvMode() {""",
            "subtitle load effect",
        )

    text = rep(
        text,
        """          progressKey={progressKey}
          tvMode={tvMode}
        />""",
        """          progressKey={progressKey}
          tvMode={tvMode}
          subtitleTracks={resolvedSubtitleTracks}
        />""",
        "native tracks",
        "subtitleTracks={resolvedSubtitleTracks}",
    )

    text = rep(
        text,
        """          customSeasonIndex={seasonIndex}
          detailHref={detailHref}
        />""",
        """          customSeasonIndex={seasonIndex}
          detailHref={detailHref}
          hasSubtitles={resolvedSubtitleTracks.length > 0}
        />""",
        "overlay tracks",
        "hasSubtitles={resolvedSubtitleTracks.length > 0}",
    )

    if "subtitleLoadError &&" not in text:
        text = rep(
            text,
            """      {tvMode && mode === "probing" && (
        <div className="pointer-events-none absolute left-1/2 top-[12%]""",
            """      {tvMode && subtitleLoadError && (
        <div className="pointer-events-none absolute left-1/2 top-[18%] z-20 max-w-[70vw] -translate-x-1/2 rounded-xl border border-yellow-300/20 bg-black/75 px-4 py-2 text-center text-xs font-bold text-yellow-100 shadow-xl backdrop-blur">
          {subtitleLoadError}
        </div>
      )}

      {tvMode && mode === "probing" && (
        <div className="pointer-events-none absolute left-1/2 top-[12%]""",
            "subtitle error",
        )

    return text


def patch_native(text: str) -> str:
    if 'import type { ResolvedSubtitleTrack } from "@/lib/subtitleTools";' not in text:
        text = rep(
            text,
            'import { useCallback, useEffect, useRef, useState } from "react";',
            'import { useCallback, useEffect, useRef, useState } from "react";\nimport type { ResolvedSubtitleTrack } from "@/lib/subtitleTools";',
            "native import",
        )

    text = rep(
        text,
        'type PlayerCommandAction = "seek" | "toggle-play" | "play" | "pause" | "focus-player";',
        'type PlayerCommandAction = "seek" | "toggle-play" | "play" | "pause" | "focus-player" | "cycle-subtitle";',
        "native command",
        '"cycle-subtitle"',
    )

    text = rep(
        text,
        """  progressKey?: string;
  /**
   * true: TV remote overlay điều khiển video, không hiện browser controls.""",
        """  progressKey?: string;
  subtitleTracks?: ResolvedSubtitleTrack[];
  /**
   * true: TV remote overlay điều khiển video, không hiện browser controls.""",
        "native prop",
        "subtitleTracks?: ResolvedSubtitleTrack[];",
    )

    text = rep(
        text,
        """  progressKey,
  tvMode = false,
}: NativeVideoPlayerProps) {""",
        """  progressKey,
  subtitleTracks = EMPTY_SUBTITLE_TRACKS,
  tvMode = false,
}: NativeVideoPlayerProps) {""",
        "native destructure",
        "subtitleTracks = EMPTY_SUBTITLE_TRACKS,",
    )

    text = rep(
        text,
        'const VIDEO_PROGRESS_KEY = "baoflix_video_progress_v1";',
        'const VIDEO_PROGRESS_KEY = "baoflix_video_progress_v1";\nconst EMPTY_SUBTITLE_TRACKS: ResolvedSubtitleTrack[] = [];',
        "native empty tracks constant",
        "const EMPTY_SUBTITLE_TRACKS",
    )

    text = rep(
        text,
        """  const lastProgressSaveRef = useRef(0);
  const [error, setError] = useState<string>("");""",
        """  const lastProgressSaveRef = useRef(0);
  const [error, setError] = useState<string>("");
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState(-1);""",
        "native state",
        "activeSubtitleIndex",
    )

    text = rep(
        text,
        """function emitHud(detail: {
  type: "seek" | "play" | "pause";
  delta?: number;
  currentTime?: number;
  duration?: number;
}) {""",
        """function emitHud(detail: {
  type: "seek" | "play" | "pause" | "subtitle";
  delta?: number;
  currentTime?: number;
  duration?: number;
  label?: string;
}) {""",
        "native hud",
        '"pause" | "subtitle"',
    )

    if "const applySubtitleMode = useCallback" not in text:
        logic = """  const applySubtitleMode = useCallback((index: number) => {
    const video = videoRef.current;
    if (!video) return;

    Array.from(video.textTracks).forEach((track, trackIndex) => {
      track.mode = trackIndex === index ? "showing" : "disabled";
    });
  }, []);

  const cycleSubtitle = useCallback(() => {
    if (!subtitleTracks.length) {
      emitHud({ type: "subtitle", label: "Không có phụ đề" });
      return;
    }

    const nextIndex =
      activeSubtitleIndex >= subtitleTracks.length - 1
        ? -1
        : activeSubtitleIndex + 1;

    setActiveSubtitleIndex(nextIndex);
    window.setTimeout(() => applySubtitleMode(nextIndex), 0);

    if (progressKey) {
      try {
        localStorage.setItem(
          `${progressKey}:subtitle-choice`,
          String(nextIndex)
        );
      } catch {}
    }

    emitHud({
      type: "subtitle",
      label:
        nextIndex < 0
          ? "Phụ đề: Tắt"
          : `Phụ đề: ${subtitleTracks[nextIndex]?.label || "Bật"}`,
    });
  }, [
    activeSubtitleIndex,
    applySubtitleMode,
    progressKey,
    subtitleTracks,
  ]);

  useEffect(() => {
    let nextIndex = subtitleTracks.findIndex((track) => track.default);
    if (nextIndex < 0 && subtitleTracks.length) nextIndex = 0;

    if (progressKey) {
      try {
        const stored = localStorage.getItem(
          `${progressKey}:subtitle-choice`
        );
        if (stored !== null) {
          const parsed = Number(stored);
          if (
            Number.isInteger(parsed) &&
            parsed >= -1 &&
            parsed < subtitleTracks.length
          ) {
            nextIndex = parsed;
          }
        }
      } catch {}
    }

    setActiveSubtitleIndex(nextIndex);

    const sync = () => applySubtitleMode(nextIndex);
    const video = videoRef.current;
    sync();

    const timers = [
      window.setTimeout(sync, 50),
      window.setTimeout(sync, 250),
      window.setTimeout(sync, 800),
    ];

    video?.addEventListener("loadedmetadata", sync);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      video?.removeEventListener("loadedmetadata", sync);
    };
  }, [applySubtitleMode, progressKey, subtitleTracks]);

"""
        text = rep(
            text,
            """  const handleCommand = useCallback(
    (detail: PlayerCommandDetail) => {""",
            logic + """  const handleCommand = useCallback(
    (detail: PlayerCommandDetail) => {""",
            "native subtitle logic",
        )

    text = rep(
        text,
        """      if (detail.action === "focus-player") {
        // Chỉ trả focus về bề mặt remote. Không được tự play lại khi user đã pause.
        focusRemoteSurface();
        return;
      }

      if (detail.action === "seek") {""",
        """      if (detail.action === "focus-player") {
        // Chỉ trả focus về bề mặt remote. Không được tự play lại khi user đã pause.
        focusRemoteSurface();
        return;
      }

      if (detail.action === "cycle-subtitle") {
        cycleSubtitle();
        focusRemoteSurface();
        return;
      }

      if (detail.action === "seek") {""",
        "native cycle handler",
        'detail.action === "cycle-subtitle"',
    )

    text = rep(
        text,
        """    [pauseVideo, playVideo, seekVideo, tvMode]
  );""",
        """    [cycleSubtitle, pauseVideo, playVideo, seekVideo, tvMode]
  );""",
        "native deps",
        "[cycleSubtitle, pauseVideo",
    )

    text = rep(
        text,
        """        onPause={() => {
          if (!tvMode) return;
          userPausedRef.current = true;
        }}
      />""",
        """        onPause={() => {
          if (!tvMode) return;
          userPausedRef.current = true;
        }}
      >
        {subtitleTracks.map((track, index) => (
          <track
            key={`${track.lang}-${track.label}-${track.url}-${index}`}
            kind="subtitles"
            src={track.url}
            srcLang={track.lang || "vi"}
            label={track.label || `Phụ đề ${index + 1}`}
            default={Boolean(track.default && index === 0)}
          />
        ))}
      </video>""",
        "native track tags",
        "{subtitleTracks.map((track, index)",
    )

    return text


def patch_overlay(text: str) -> str:
    text = rep(
        text,
        """  customSeasonIndex?: number;
  detailHref?: string;
};""",
        """  customSeasonIndex?: number;
  detailHref?: string;
  hasSubtitles?: boolean;
};""",
        "overlay prop",
        "hasSubtitles?: boolean;",
    )

    text = rep(
        text,
        """type PlayerHudDetail = {
  type: "seek" | "play" | "pause" | "toggle";
  delta?: number;
  currentTime?: number;
  duration?: number;
};""",
        """type PlayerHudDetail = {
  type: "seek" | "play" | "pause" | "toggle" | "subtitle";
  delta?: number;
  currentTime?: number;
  duration?: number;
  label?: string;
};""",
        "overlay hud",
        '"toggle" | "subtitle"',
    )

    text = rep(
        text,
        'type PlayerCommandAction = "seek" | "toggle-play" | "play" | "pause" | "focus-player";',
        'type PlayerCommandAction = "seek" | "toggle-play" | "play" | "pause" | "focus-player" | "cycle-subtitle";',
        "overlay command",
        '"cycle-subtitle"',
    )

    text = rep(
        text,
        """  if (hud.type === "pause") return "Tạm dừng";
  if (hud.type === "play") return "Phát";
  return "Phát / tạm dừng";""",
        """  if (hud.type === "pause") return "Tạm dừng";
  if (hud.type === "play") return "Phát";
  if (hud.type === "subtitle") return hud.label || "Phụ đề";
  return "Phát / tạm dừng";""",
        "overlay hud label",
        'hud.type === "subtitle"',
    )

    text = rep(
        text,
        """  routeMode = "normal",
  customSeasonIndex,
  detailHref,
}: TvWatchOverlayProps) {""",
        """  routeMode = "normal",
  customSeasonIndex,
  detailHref,
  hasSubtitles = false,
}: TvWatchOverlayProps) {""",
        "overlay destructure",
        "hasSubtitles = false,",
    )

    text = rep(
        text,
        """  function handleTogglePlay() {
    showPeek({ focus: false });
    dispatchPlayerCommand("toggle-play");
  }

  function handleFocusPlayer() {""",
        """  function handleTogglePlay() {
    showPeek({ focus: false });
    dispatchPlayerCommand("toggle-play");
  }

  function handleSubtitleCycle() {
    showPeek({ focus: false });
    dispatchPlayerCommand("cycle-subtitle");
  }

  function handleFocusPlayer() {""",
        "overlay subtitle handler",
        "function handleSubtitleCycle()",
    )

    text = rep(
        text,
        """              <button
                type="button"
                data-tv-focus-key="overlay:sources"
                {...hiddenFocusProps}
                onClick={() => openPanel("sources")}
                disabled={!hasMultipleServers}
                className={[
                  "flex min-h-[40px] items-center justify-center rounded-2xl px-3 text-[11px] font-black min-[1280px]:min-h-[44px] min-[1280px]:text-[12px]",
                  SURFACE_BUTTON_CLASS,
                  !hasMultipleServers ? "opacity-40" : "",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Nguồn
              </button>""",
        """              <button
                type="button"
                data-tv-focus-key={
                  routeMode === "custom"
                    ? "overlay:subtitles"
                    : "overlay:sources"
                }
                {...hiddenFocusProps}
                onClick={
                  routeMode === "custom"
                    ? handleSubtitleCycle
                    : () => openPanel("sources")
                }
                disabled={
                  routeMode === "custom"
                    ? !hasSubtitles
                    : !hasMultipleServers
                }
                className={[
                  "flex min-h-[40px] items-center justify-center rounded-2xl px-3 text-[11px] font-black min-[1280px]:min-h-[44px] min-[1280px]:text-[12px]",
                  SURFACE_BUTTON_CLASS,
                  routeMode === "custom"
                    ? !hasSubtitles
                      ? "opacity-40"
                      : ""
                    : !hasMultipleServers
                      ? "opacity-40"
                      : "",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                {routeMode === "custom" ? "Phụ đề" : "Nguồn"}
              </button>""",
        "overlay source button",
        'routeMode === "custom" ? "Phụ đề" : "Nguồn"',
    )

    return text


def npm_cmd():
    return "npm.cmd" if os.name == "nt" else "npm"


def main():
    args = parse_args()

    try:
        root = find_root(args.repo or Path.cwd())
    except Exception as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1

    patches = {
        "lib/kkphim.ts": patch_kkphim,
        "lib/customMoviesClient.ts": patch_custom_client,
        "components/CustomMovieForm.tsx": patch_form,
        "app/ca-nhan/[slug]/quan-ly/page.tsx": patch_manage,
        "app/ca-nhan/[slug]/xem/page.tsx": patch_watch,
        "components/CustomDrivePlayer.tsx": patch_drive_player,
        "components/NativeVideoPlayer.tsx": patch_native,
        "components/TvWatchOverlay.tsx": patch_overlay,
    }

    missing = [name for name in patches if not (root / name).is_file()]
    if missing:
        print("LỖI: Thiếu file:\n- " + "\n- ".join(missing), file=sys.stderr)
        return 1

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = root / "backup" / f"custom-subtitle-ass-{stamp}"

    try:
        for relative in [*patches, "lib/subtitleTools.ts"]:
            source = root / relative
            if not source.exists():
                continue
            destination = backup / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)

        for relative, patcher in patches.items():
            path = root / relative
            path.write_text(
                patcher(path.read_text(encoding="utf-8")).rstrip() + "\n",
                encoding="utf-8",
            )
            print(f"✓ {relative}")

        (root / "lib" / "subtitleTools.ts").write_text(
            SUBTITLE_TOOLS_TS.rstrip() + "\n",
            encoding="utf-8",
        )
        print("✓ lib/subtitleTools.ts")

        if (root / ".next").exists():
            shutil.rmtree(root / ".next", ignore_errors=True)

        print(f"✓ Backup: {backup}")

        if not args.skip_build:
            result = subprocess.run([npm_cmd(), "run", "build"], cwd=root)
            if result.returncode != 0:
                raise RuntimeError(f"Build thất bại với mã {result.returncode}.")
            print("✓ Build thành công")

        print(
            "\nHOÀN TẤT.\n"
            "Không cần deploy lại Worker.\n"
            "Vào Phim riêng → Quản lý mùa / tập → mở tập → "
            "dán link Drive .ass/.srt/.vtt vào ô Phụ đề.\n"
            "Trên TV, nút Nguồn của phim riêng đổi thành Phụ đề.\n"
            "Script không commit hoặc push GitHub."
        )
        return 0

    except Exception as error:
        print(f"\nLỖI: {error}", file=sys.stderr)
        print(f"Backup: {backup}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
