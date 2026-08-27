"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCustomSubtitleStoragePathFromUrl,
  isCustomSubtitlePathPending,
  removeCustomSubtitleFiles,
  uploadCustomSubtitle,
} from "@/lib/customSubtitleStorage";

type EpisodeRow = {
  key: string;
  lineIndex: number;
  seasonIndex: number;
  episodeIndex: number;
  seasonName: string;
  label: string;
  videoUrl: string;
  subtitleUrl: string;
};

type RowStatus = { message: string; error?: boolean };

function parseRows(text: string): EpisodeRow[] {
  const rows: EpisodeRow[] = [];
  const lines = text.split("\n");
  let seasonIndex = -1;
  let episodeIndex = 0;
  let seasonName = "Mùa 1";
  let currentSeasonHasEpisodes = false;

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line) return;

    if (line.startsWith("#")) {
      if (seasonIndex < 0) seasonIndex = 0;
      else if (currentSeasonHasEpisodes) seasonIndex += 1;

      seasonName = line.replace(/^#+/, "").trim() || `Mùa ${seasonIndex + 1}`;
      episodeIndex = 0;
      currentSeasonHasEpisodes = false;
      return;
    }

    if (seasonIndex < 0) seasonIndex = 0;

    const parts = line.includes("|") ? line.split("|") : [];
    const label =
      parts.length > 0
        ? parts[0]?.trim() || `Tập ${String(episodeIndex + 1).padStart(2, "0")}`
        : `Tập ${String(episodeIndex + 1).padStart(2, "0")}`;
    const videoUrl = parts.length > 0 ? parts[1]?.trim() || "" : line;
    const subtitleUrl = parts.length > 2 ? parts.slice(2).join("|").trim() : "";

    rows.push({
      key: `${lineIndex}:${seasonIndex}:${episodeIndex}`,
      lineIndex,
      seasonIndex,
      episodeIndex,
      seasonName,
      label,
      videoUrl,
      subtitleUrl,
    });

    episodeIndex += 1;
    currentSeasonHasEpisodes = true;
  });

  return rows;
}

function withSubtitle(text: string, row: EpisodeRow, subtitleUrl: string) {
  const lines = text.split("\n");
  if (!String(lines[row.lineIndex] || "").trim()) return text;
  lines[row.lineIndex] = subtitleUrl
    ? `${row.label} | ${row.videoUrl} | ${subtitleUrl}`
    : `${row.label} | ${row.videoUrl}`;
  return lines.join("\n");
}

export default function CustomSubtitleUploadPanel({
  movieSlug,
  episodesText,
  onEpisodesTextChange,
}: {
  movieSlug: string;
  episodesText: string;
  onEpisodesTextChange: (value: string) => void;
}) {
  const rows = useMemo(() => parseRows(episodesText), [episodesText]);
  const [busyKey, setBusyKey] = useState("");
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});
  const sessionUploadsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const uploadedPaths = sessionUploadsRef.current;
    return () => {
      const uncommitted = Array.from(uploadedPaths).filter((path) =>
        isCustomSubtitlePathPending(path)
      );
      if (uncommitted.length) {
        void removeCustomSubtitleFiles(uncommitted).catch(() => undefined);
      }
    };
  }, []);

  function status(key: string, value: RowStatus) {
    setStatuses((old) => ({ ...old, [key]: value }));
  }

  async function upload(row: EpisodeRow, file: File) {
    if (!movieSlug.trim()) {
      status(row.key, {
        message: "Nhập tên/slug phim trước khi upload.",
        error: true,
      });
      return;
    }

    setBusyKey(row.key);
    status(row.key, { message: "Đang kiểm tra và upload..." });

    try {
      const previousSessionPath = Array.from(sessionUploadsRef.current).find((path) =>
        path.includes(
          `/season-${row.seasonIndex + 1}/episode-${row.episodeIndex + 1}-`
        )
      );

      const result = await uploadCustomSubtitle({
        file,
        movieSlug,
        seasonIndex: row.seasonIndex,
        episodeIndex: row.episodeIndex,
      });

      sessionUploadsRef.current.add(result.storagePath);
      onEpisodesTextChange(withSubtitle(episodesText, row, result.url));

      if (previousSessionPath && previousSessionPath !== result.storagePath) {
        sessionUploadsRef.current.delete(previousSessionPath);
        void removeCustomSubtitleFiles([previousSessionPath]).catch(() => undefined);
      }

      status(row.key, {
        message: `✅ ${file.name} đã upload. Bấm “Lưu phim riêng” để gắn vào phim.`,
      });
    } catch (error) {
      status(row.key, {
        message: error instanceof Error ? error.message : "Upload phụ đề thất bại.",
        error: true,
      });
    } finally {
      setBusyKey("");
    }
  }

  async function remove(row: EpisodeRow) {
    const path = getCustomSubtitleStoragePathFromUrl(row.subtitleUrl);
    onEpisodesTextChange(withSubtitle(episodesText, row, ""));

    if (path && sessionUploadsRef.current.has(path)) {
      sessionUploadsRef.current.delete(path);
      await removeCustomSubtitleFiles([path]).catch(() => undefined);
    }

    status(row.key, { message: "Đã bỏ phụ đề khỏi tập." });
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
        Nhập danh sách tập phía trên để hiện nút upload phụ đề cho từng tập.
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
      <h3 className="text-lg font-black text-cyan-100">Upload phụ đề trực tiếp</h3>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Chọn SRT/VTT/ASS/SSA cho từng tập. File được tải lên Supabase Storage,
        URL tự điền vào cột phụ đề. Cần đăng nhập BảoFlix.
      </p>

      <div className="mt-4 grid gap-3">
        {rows.map((row) => {
          const uploadedPath = getCustomSubtitleStoragePathFromUrl(row.subtitleUrl);

          return (
            <div key={row.key} className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-white">{row.seasonName} · {row.label}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                    {row.videoUrl || "Chưa có link video"}
                  </p>
                  {row.subtitleUrl ? (
                    <p className="mt-2 break-all text-xs text-emerald-300">
                      {uploadedPath ? "☁️ Upload BảoFlix" : "🔗 Link ngoài"} · {row.subtitleUrl}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Chưa có phụ đề.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <label
                    className={[
                      "cursor-pointer rounded-xl px-3 py-2 text-xs font-black",
                      busyKey === row.key
                        ? "cursor-wait bg-white/10 text-slate-500"
                        : "bg-cyan-300 text-black hover:bg-cyan-200",
                    ].join(" ")}
                  >
                    {busyKey === row.key
                      ? "Đang upload..."
                      : row.subtitleUrl
                        ? "Thay file"
                        : "Upload SRT"}
                    <input
                      type="file"
                      accept=".srt,.vtt,.ass,.ssa,text/plain,text/vtt,application/x-subrip"
                      disabled={busyKey === row.key}
                      className="hidden"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void upload(row, file);
                      }}
                    />
                  </label>

                  {row.subtitleUrl && (
                    <button
                      type="button"
                      onClick={() => void remove(row)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black hover:bg-white/10"
                    >
                      Xóa phụ đề
                    </button>
                  )}
                </div>
              </div>

              {statuses[row.key] && (
                <p
                  className={[
                    "mt-2 text-xs font-bold",
                    statuses[row.key]?.error ? "text-red-300" : "text-cyan-200",
                  ].join(" ")}
                >
                  {statuses[row.key]?.message}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
