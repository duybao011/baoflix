#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

STORAGE_TS = '"use client";\n\nimport type { EpisodeSubtitle, MovieDetailResponse } from "@/lib/kkphim";\nimport { getSupabaseClient } from "@/lib/supabaseClient";\nimport { convertSubtitleTextToVtt } from "@/lib/subtitleTools";\nimport { slugify } from "@/lib/slugify";\n\nexport const CUSTOM_SUBTITLE_BUCKET = "custom-subtitles";\nexport const MAX_CUSTOM_SUBTITLE_BYTES = 2 * 1024 * 1024;\nconst PENDING_UPLOADS_KEY = "baoflix_pending_custom_subtitle_uploads_v1";\nconst ALLOWED_EXTENSIONS = new Set(["srt", "vtt", "ass", "ssa"]);\n\nexport type CustomSubtitleUploadResult = {\n  url: string;\n  storagePath: string;\n  originalName: string;\n};\n\nfunction extensionOf(name: string) {\n  return String(name || "").trim().toLowerCase().split(".").pop() || "";\n}\n\nfunction contentTypeFor(extension: string) {\n  if (extension === "vtt") return "text/vtt;charset=utf-8";\n  if (extension === "srt") return "application/x-subrip";\n  return "text/plain;charset=utf-8";\n}\n\nfunction readPendingUploads(): string[] {\n  try {\n    const raw = localStorage.getItem(PENDING_UPLOADS_KEY);\n    const parsed = raw ? JSON.parse(raw) : [];\n    return Array.isArray(parsed)\n      ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item))\n      : [];\n  } catch {\n    return [];\n  }\n}\n\nfunction writePendingUploads(paths: string[]) {\n  localStorage.setItem(\n    PENDING_UPLOADS_KEY,\n    JSON.stringify(Array.from(new Set(paths)))\n  );\n}\n\nfunction rememberPendingUpload(path: string) {\n  if (path) writePendingUploads([...readPendingUploads(), path]);\n}\n\nexport function isCustomSubtitlePathPending(path: string) {\n  return readPendingUploads().includes(path);\n}\n\nexport function markCustomSubtitlePathsCommitted(paths: string[]) {\n  if (!paths.length) return;\n  const committed = new Set(paths);\n  writePendingUploads(readPendingUploads().filter((path) => !committed.has(path)));\n}\n\nexport function getCustomSubtitleStoragePathFromUrl(input: string) {\n  const raw = String(input || "").trim();\n  if (!raw) return "";\n\n  try {\n    const parsed = new URL(raw);\n    const marker = `/storage/v1/object/public/${CUSTOM_SUBTITLE_BUCKET}/`;\n    const index = parsed.pathname.indexOf(marker);\n    if (index < 0) return "";\n\n    return parsed.pathname\n      .slice(index + marker.length)\n      .split("/")\n      .map((part) => {\n        try {\n          return decodeURIComponent(part);\n        } catch {\n          return part;\n        }\n      })\n      .join("/");\n  } catch {\n    return "";\n  }\n}\n\nexport function getCustomSubtitleStoragePath(\n  subtitle?: Partial<EpisodeSubtitle> | null\n) {\n  const explicit = String(subtitle?.storagePath || "").trim();\n  return explicit || getCustomSubtitleStoragePathFromUrl(String(subtitle?.url || ""));\n}\n\nexport function collectCustomSubtitleStoragePaths(\n  data?: Pick<MovieDetailResponse, "episodes"> | null\n) {\n  const paths: string[] = [];\n  (data?.episodes || []).forEach((season) => {\n    (season.server_data || []).forEach((episode) => {\n      (episode.subtitles || []).forEach((subtitle) => {\n        const path = getCustomSubtitleStoragePath(subtitle);\n        if (path) paths.push(path);\n      });\n    });\n  });\n  return Array.from(new Set(paths));\n}\n\nexport async function validateCustomSubtitleFile(file: File) {\n  const extension = extensionOf(file.name);\n\n  if (!ALLOWED_EXTENSIONS.has(extension)) {\n    throw new Error("Chỉ hỗ trợ file .srt, .vtt, .ass hoặc .ssa.");\n  }\n  if (file.size <= 0) throw new Error("File phụ đề đang trống.");\n  if (file.size > MAX_CUSTOM_SUBTITLE_BYTES) {\n    throw new Error("File phụ đề vượt quá 2 MB.");\n  }\n\n  const text = await file.text();\n  convertSubtitleTextToVtt(text, file.name);\n\n  return {\n    extension,\n    contentType: contentTypeFor(extension),\n  };\n}\n\nexport async function uploadCustomSubtitle(input: {\n  file: File;\n  movieSlug: string;\n  seasonIndex: number;\n  episodeIndex: number;\n}) {\n  const { extension, contentType } = await validateCustomSubtitleFile(input.file);\n  const supabase = getSupabaseClient();\n  const {\n    data: { user },\n    error: userError,\n  } = await supabase.auth.getUser();\n\n  if (userError) throw userError;\n  if (!user) {\n    throw new Error("Bạn cần đăng nhập BảoFlix trước khi upload phụ đề.");\n  }\n\n  const movieSlug = slugify(input.movieSlug || "phim-rieng");\n  const randomId =\n    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"\n      ? crypto.randomUUID()\n      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;\n\n  const storagePath = [\n    user.id,\n    movieSlug,\n    `season-${input.seasonIndex + 1}`,\n    `episode-${input.episodeIndex + 1}-${randomId}.${extension}`,\n  ].join("/");\n\n  const { error } = await supabase.storage\n    .from(CUSTOM_SUBTITLE_BUCKET)\n    .upload(storagePath, input.file, {\n      cacheControl: "3600",\n      contentType,\n      upsert: false,\n    });\n\n  if (error) {\n    throw new Error(`Upload phụ đề thất bại: ${error.message}`);\n  }\n\n  const { data } = supabase.storage\n    .from(CUSTOM_SUBTITLE_BUCKET)\n    .getPublicUrl(storagePath);\n\n  const publicUrl = String(data?.publicUrl || "").trim();\n  if (!publicUrl) {\n    await supabase.storage.from(CUSTOM_SUBTITLE_BUCKET).remove([storagePath]).catch(() => undefined);\n    throw new Error("Upload thành công nhưng không lấy được public URL.");\n  }\n\n  rememberPendingUpload(storagePath);\n\n  return {\n    url: publicUrl,\n    storagePath,\n    originalName: input.file.name,\n  } satisfies CustomSubtitleUploadResult;\n}\n\nexport async function removeCustomSubtitleFiles(paths: string[]) {\n  const uniquePaths = Array.from(\n    new Set(paths.map((path) => String(path || "").trim()).filter(Boolean))\n  );\n  if (!uniquePaths.length) return;\n\n  const supabase = getSupabaseClient();\n  const { error } = await supabase.storage\n    .from(CUSTOM_SUBTITLE_BUCKET)\n    .remove(uniquePaths);\n\n  if (error) {\n    throw new Error(`Không xóa được file phụ đề: ${error.message}`);\n  }\n\n  markCustomSubtitlePathsCommitted(uniquePaths);\n}\n'
UPLOAD_PANEL_TSX = '"use client";\n\nimport { useEffect, useMemo, useRef, useState } from "react";\nimport {\n  getCustomSubtitleStoragePathFromUrl,\n  isCustomSubtitlePathPending,\n  removeCustomSubtitleFiles,\n  uploadCustomSubtitle,\n} from "@/lib/customSubtitleStorage";\n\ntype EpisodeRow = {\n  key: string;\n  lineIndex: number;\n  seasonIndex: number;\n  episodeIndex: number;\n  seasonName: string;\n  label: string;\n  videoUrl: string;\n  subtitleUrl: string;\n};\n\ntype RowStatus = { message: string; error?: boolean };\n\nfunction parseRows(text: string): EpisodeRow[] {\n  const rows: EpisodeRow[] = [];\n  const lines = text.split("\\n");\n  let seasonIndex = -1;\n  let episodeIndex = 0;\n  let seasonName = "Mùa 1";\n  let currentSeasonHasEpisodes = false;\n\n  lines.forEach((rawLine, lineIndex) => {\n    const line = rawLine.trim();\n    if (!line) return;\n\n    if (line.startsWith("#")) {\n      if (seasonIndex < 0) seasonIndex = 0;\n      else if (currentSeasonHasEpisodes) seasonIndex += 1;\n\n      seasonName = line.replace(/^#+/, "").trim() || `Mùa ${seasonIndex + 1}`;\n      episodeIndex = 0;\n      currentSeasonHasEpisodes = false;\n      return;\n    }\n\n    if (seasonIndex < 0) seasonIndex = 0;\n\n    const parts = line.includes("|") ? line.split("|") : [];\n    const label =\n      parts.length > 0\n        ? parts[0]?.trim() || `Tập ${String(episodeIndex + 1).padStart(2, "0")}`\n        : `Tập ${String(episodeIndex + 1).padStart(2, "0")}`;\n    const videoUrl = parts.length > 0 ? parts[1]?.trim() || "" : line;\n    const subtitleUrl = parts.length > 2 ? parts.slice(2).join("|").trim() : "";\n\n    rows.push({\n      key: `${lineIndex}:${seasonIndex}:${episodeIndex}`,\n      lineIndex,\n      seasonIndex,\n      episodeIndex,\n      seasonName,\n      label,\n      videoUrl,\n      subtitleUrl,\n    });\n\n    episodeIndex += 1;\n    currentSeasonHasEpisodes = true;\n  });\n\n  return rows;\n}\n\nfunction withSubtitle(text: string, row: EpisodeRow, subtitleUrl: string) {\n  const lines = text.split("\\n");\n  if (!String(lines[row.lineIndex] || "").trim()) return text;\n  lines[row.lineIndex] = subtitleUrl\n    ? `${row.label} | ${row.videoUrl} | ${subtitleUrl}`\n    : `${row.label} | ${row.videoUrl}`;\n  return lines.join("\\n");\n}\n\nexport default function CustomSubtitleUploadPanel({\n  movieSlug,\n  episodesText,\n  onEpisodesTextChange,\n}: {\n  movieSlug: string;\n  episodesText: string;\n  onEpisodesTextChange: (value: string) => void;\n}) {\n  const rows = useMemo(() => parseRows(episodesText), [episodesText]);\n  const [busyKey, setBusyKey] = useState("");\n  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({});\n  const sessionUploadsRef = useRef<Set<string>>(new Set());\n\n  useEffect(() => {\n    const uploadedPaths = sessionUploadsRef.current;\n    return () => {\n      const uncommitted = Array.from(uploadedPaths).filter((path) =>\n        isCustomSubtitlePathPending(path)\n      );\n      if (uncommitted.length) {\n        void removeCustomSubtitleFiles(uncommitted).catch(() => undefined);\n      }\n    };\n  }, []);\n\n  function status(key: string, value: RowStatus) {\n    setStatuses((old) => ({ ...old, [key]: value }));\n  }\n\n  async function upload(row: EpisodeRow, file: File) {\n    if (!movieSlug.trim()) {\n      status(row.key, {\n        message: "Nhập tên/slug phim trước khi upload.",\n        error: true,\n      });\n      return;\n    }\n\n    setBusyKey(row.key);\n    status(row.key, { message: "Đang kiểm tra và upload..." });\n\n    try {\n      const previousSessionPath = Array.from(sessionUploadsRef.current).find((path) =>\n        path.includes(\n          `/season-${row.seasonIndex + 1}/episode-${row.episodeIndex + 1}-`\n        )\n      );\n\n      const result = await uploadCustomSubtitle({\n        file,\n        movieSlug,\n        seasonIndex: row.seasonIndex,\n        episodeIndex: row.episodeIndex,\n      });\n\n      sessionUploadsRef.current.add(result.storagePath);\n      onEpisodesTextChange(withSubtitle(episodesText, row, result.url));\n\n      if (previousSessionPath && previousSessionPath !== result.storagePath) {\n        sessionUploadsRef.current.delete(previousSessionPath);\n        void removeCustomSubtitleFiles([previousSessionPath]).catch(() => undefined);\n      }\n\n      status(row.key, {\n        message: `✅ ${file.name} đã upload. Bấm “Lưu phim riêng” để gắn vào phim.`,\n      });\n    } catch (error) {\n      status(row.key, {\n        message: error instanceof Error ? error.message : "Upload phụ đề thất bại.",\n        error: true,\n      });\n    } finally {\n      setBusyKey("");\n    }\n  }\n\n  async function remove(row: EpisodeRow) {\n    const path = getCustomSubtitleStoragePathFromUrl(row.subtitleUrl);\n    onEpisodesTextChange(withSubtitle(episodesText, row, ""));\n\n    if (path && sessionUploadsRef.current.has(path)) {\n      sessionUploadsRef.current.delete(path);\n      await removeCustomSubtitleFiles([path]).catch(() => undefined);\n    }\n\n    status(row.key, { message: "Đã bỏ phụ đề khỏi tập." });\n  }\n\n  if (!rows.length) {\n    return (\n      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">\n        Nhập danh sách tập phía trên để hiện nút upload phụ đề cho từng tập.\n      </div>\n    );\n  }\n\n  return (\n    <section className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">\n      <h3 className="text-lg font-black text-cyan-100">Upload phụ đề trực tiếp</h3>\n      <p className="mt-1 text-sm leading-6 text-slate-300">\n        Chọn SRT/VTT/ASS/SSA cho từng tập. File được tải lên Supabase Storage,\n        URL tự điền vào cột phụ đề. Cần đăng nhập BảoFlix.\n      </p>\n\n      <div className="mt-4 grid gap-3">\n        {rows.map((row) => {\n          const uploadedPath = getCustomSubtitleStoragePathFromUrl(row.subtitleUrl);\n\n          return (\n            <div key={row.key} className="rounded-2xl border border-white/10 bg-black/20 p-3">\n              <div className="flex flex-wrap items-start justify-between gap-3">\n                <div className="min-w-0">\n                  <p className="font-black text-white">{row.seasonName} · {row.label}</p>\n                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">\n                    {row.videoUrl || "Chưa có link video"}\n                  </p>\n                  {row.subtitleUrl ? (\n                    <p className="mt-2 break-all text-xs text-emerald-300">\n                      {uploadedPath ? "☁️ Upload BảoFlix" : "🔗 Link ngoài"} · {row.subtitleUrl}\n                    </p>\n                  ) : (\n                    <p className="mt-2 text-xs text-slate-500">Chưa có phụ đề.</p>\n                  )}\n                </div>\n\n                <div className="flex flex-wrap gap-2">\n                  <label\n                    className={[\n                      "cursor-pointer rounded-xl px-3 py-2 text-xs font-black",\n                      busyKey === row.key\n                        ? "cursor-wait bg-white/10 text-slate-500"\n                        : "bg-cyan-300 text-black hover:bg-cyan-200",\n                    ].join(" ")}\n                  >\n                    {busyKey === row.key\n                      ? "Đang upload..."\n                      : row.subtitleUrl\n                        ? "Thay file"\n                        : "Upload SRT"}\n                    <input\n                      type="file"\n                      accept=".srt,.vtt,.ass,.ssa,text/plain,text/vtt,application/x-subrip"\n                      disabled={busyKey === row.key}\n                      className="hidden"\n                      onChange={(event) => {\n                        const file = event.currentTarget.files?.[0];\n                        event.currentTarget.value = "";\n                        if (file) void upload(row, file);\n                      }}\n                    />\n                  </label>\n\n                  {row.subtitleUrl && (\n                    <button\n                      type="button"\n                      onClick={() => void remove(row)}\n                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black hover:bg-white/10"\n                    >\n                      Xóa phụ đề\n                    </button>\n                  )}\n                </div>\n              </div>\n\n              {statuses[row.key] && (\n                <p\n                  className={[\n                    "mt-2 text-xs font-bold",\n                    statuses[row.key]?.error ? "text-red-300" : "text-cyan-200",\n                  ].join(" ")}\n                >\n                  {statuses[row.key]?.message}\n                </p>\n              )}\n            </div>\n          );\n        })}\n      </div>\n    </section>\n  );\n}\n'
STORED_MANAGER_TSX = '"use client";\n\nimport { useState } from "react";\nimport type { EpisodeSubtitle } from "@/lib/kkphim";\nimport { getCustomSubtitleStoragePath, uploadCustomSubtitle } from "@/lib/customSubtitleStorage";\nimport { upsertCustomMovie, type StoredCustomMovie } from "@/lib/customMoviesClient";\n\ntype Status = { key: string; message: string; error?: boolean } | null;\n\nfunction uploadedTrack(input: {\n  url: string;\n  storagePath: string;\n  originalName: string;\n}): EpisodeSubtitle {\n  return {\n    label: "Tiếng Việt",\n    lang: "vi",\n    url: input.url,\n    source: "upload",\n    storagePath: input.storagePath,\n    originalName: input.originalName,\n    default: true,\n  };\n}\n\nexport default function StoredCustomSubtitleManager({\n  movie,\n  onMovieChange,\n}: {\n  movie: StoredCustomMovie;\n  onMovieChange: (movie: StoredCustomMovie) => void;\n}) {\n  const [busyKey, setBusyKey] = useState("");\n  const [status, setStatus] = useState<Status>(null);\n\n  function updateEpisode(\n    seasonIndex: number,\n    episodeIndex: number,\n    subtitles: EpisodeSubtitle[]\n  ) {\n    const next: StoredCustomMovie = {\n      ...movie,\n      updatedAt: new Date().toISOString(),\n      episodes: movie.episodes.map((season, si) =>\n        si !== seasonIndex\n          ? season\n          : {\n              ...season,\n              server_data: season.server_data.map((episode, ei) =>\n                ei !== episodeIndex ? episode : { ...episode, subtitles }\n              ),\n            }\n      ),\n    };\n\n    upsertCustomMovie(next);\n    onMovieChange(next);\n  }\n\n  async function upload(\n    seasonIndex: number,\n    episodeIndex: number,\n    file: File\n  ) {\n    const key = `${seasonIndex}:${episodeIndex}`;\n    setBusyKey(key);\n    setStatus({ key, message: "Đang kiểm tra và upload..." });\n\n    try {\n      const result = await uploadCustomSubtitle({\n        file,\n        movieSlug: movie.movie.slug,\n        seasonIndex,\n        episodeIndex,\n      });\n\n      updateEpisode(seasonIndex, episodeIndex, [uploadedTrack(result)]);\n      setStatus({ key, message: `✅ ${file.name} đã upload và lưu vào phim.` });\n    } catch (error) {\n      setStatus({\n        key,\n        message: error instanceof Error ? error.message : "Upload phụ đề thất bại.",\n        error: true,\n      });\n    } finally {\n      setBusyKey("");\n    }\n  }\n\n  function remove(seasonIndex: number, episodeIndex: number) {\n    const key = `${seasonIndex}:${episodeIndex}`;\n    updateEpisode(seasonIndex, episodeIndex, []);\n    setStatus({\n      key,\n      message: "Đã xóa phụ đề khỏi phim. File Storage cũ sẽ được dọn tự động.",\n    });\n  }\n\n  return (\n    <section className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">\n      <h2 className="text-xl font-black text-cyan-100">Phụ đề từng tập</h2>\n      <p className="mt-1 text-sm leading-6 text-slate-300">\n        Upload SRT/VTT/ASS/SSA trực tiếp. Thay hoặc xóa ở đây được lưu ngay.\n      </p>\n\n      <div className="mt-4 grid gap-3">\n        {movie.episodes.flatMap((season, seasonIndex) =>\n          (season.server_data || []).map((episode, episodeIndex) => {\n            const key = `${seasonIndex}:${episodeIndex}`;\n            const subtitle = episode.subtitles?.[0];\n            const uploadedPath = getCustomSubtitleStoragePath(subtitle);\n\n            return (\n              <div key={key} className="rounded-2xl border border-white/10 bg-black/20 p-3">\n                <div className="flex flex-wrap items-start justify-between gap-3">\n                  <div className="min-w-0">\n                    <p className="font-black">{season.server_name} · {episode.name}</p>\n                    {subtitle?.url ? (\n                      <p className="mt-2 break-all text-xs text-emerald-300">\n                        {uploadedPath ? "☁️ Upload BảoFlix" : "🔗 Link ngoài"} · {subtitle.url}\n                      </p>\n                    ) : (\n                      <p className="mt-2 text-xs text-slate-500">Chưa có phụ đề.</p>\n                    )}\n                  </div>\n\n                  <div className="flex flex-wrap gap-2">\n                    <label\n                      className={[\n                        "cursor-pointer rounded-xl px-3 py-2 text-xs font-black",\n                        busyKey === key\n                          ? "cursor-wait bg-white/10 text-slate-500"\n                          : "bg-cyan-300 text-black hover:bg-cyan-200",\n                      ].join(" ")}\n                    >\n                      {busyKey === key ? "Đang upload..." : subtitle?.url ? "Thay file" : "Upload SRT"}\n                      <input\n                        type="file"\n                        accept=".srt,.vtt,.ass,.ssa,text/plain,text/vtt,application/x-subrip"\n                        disabled={busyKey === key}\n                        className="hidden"\n                        onChange={(event) => {\n                          const file = event.currentTarget.files?.[0];\n                          event.currentTarget.value = "";\n                          if (file) void upload(seasonIndex, episodeIndex, file);\n                        }}\n                      />\n                    </label>\n\n                    {subtitle?.url && (\n                      <button\n                        type="button"\n                        onClick={() => remove(seasonIndex, episodeIndex)}\n                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black hover:bg-white/10"\n                      >\n                        Xóa phụ đề\n                      </button>\n                    )}\n                  </div>\n                </div>\n\n                {status?.key === key && (\n                  <p className={["mt-2 text-xs font-bold", status.error ? "text-red-300" : "text-cyan-200"].join(" ")}>\n                    {status.message}\n                  </p>\n                )}\n              </div>\n            );\n          })\n        )}\n      </div>\n    </section>\n  );\n}\n'
KK_OLD = 'export type EpisodeSubtitle = {\n  label: string;\n  lang: string;\n  url: string;\n  default?: boolean;\n};'
KK_NEW = 'export type EpisodeSubtitle = {\n  label: string;\n  lang: string;\n  url: string;\n  source?: "external" | "upload";\n  storagePath?: string;\n  originalName?: string;\n  default?: boolean;\n};'
CM_IMPORT_OLD = 'import { slugify } from "@/lib/slugify";'
CM_IMPORT_NEW = 'import { slugify } from "@/lib/slugify";\nimport {\n  collectCustomSubtitleStoragePaths,\n  getCustomSubtitleStoragePathFromUrl,\n  markCustomSubtitlePathsCommitted,\n  removeCustomSubtitleFiles,\n} from "@/lib/customSubtitleStorage";'
CM_DU_OLD = 'export function deleteCustomMovie(slug: string) {\n  const next = readCustomMovies().filter((item) => item.movie.slug !== slug);\n\n  rememberPendingCustomMovieDeletion(slug);\n  saveCustomMovies(next, { type: "delete", slug });\n\n  return next;\n}\n\nexport function upsertCustomMovie(movie: StoredCustomMovie) {\n  const movies = readCustomMovies();\n\n  const oldMovie = movies.find((item) => item.movie.slug === movie.movie.slug);\n\n  const nextMovie: StoredCustomMovie = {\n    ...movie,\n    createdAt: oldMovie?.createdAt || movie.createdAt,\n    updatedAt: new Date().toISOString(),\n  };\n\n  const next = [\n    nextMovie,\n    ...movies.filter((item) => item.movie.slug !== movie.movie.slug),\n  ];\n\n  saveCustomMovies(next);\n\n  return next;\n}'
CM_DU_NEW = '// BAOFLIX_SUBTITLE_STORAGE_CLEANUP\nexport function deleteCustomMovie(slug: string) {\n  const movies = readCustomMovies();\n  const oldMovie = movies.find((item) => item.movie.slug === slug);\n  const next = movies.filter((item) => item.movie.slug !== slug);\n\n  rememberPendingCustomMovieDeletion(slug);\n  saveCustomMovies(next, { type: "delete", slug });\n\n  const oldSubtitlePaths =\n    collectCustomSubtitleStoragePaths(oldMovie);\n\n  if (oldSubtitlePaths.length) {\n    void removeCustomSubtitleFiles(oldSubtitlePaths).catch((error) => {\n      console.warn(\n        "[BảoFlix] Không dọn được subtitle Storage khi xóa phim:",\n        error\n      );\n    });\n  }\n\n  return next;\n}\n\nexport function upsertCustomMovie(movie: StoredCustomMovie) {\n  const movies = readCustomMovies();\n\n  const oldMovie = movies.find((item) => item.movie.slug === movie.movie.slug);\n\n  const nextMovie: StoredCustomMovie = {\n    ...movie,\n    createdAt: oldMovie?.createdAt || movie.createdAt,\n    updatedAt: new Date().toISOString(),\n  };\n\n  const next = [\n    nextMovie,\n    ...movies.filter((item) => item.movie.slug !== movie.movie.slug),\n  ];\n\n  saveCustomMovies(next);\n\n  const oldSubtitlePaths =\n    collectCustomSubtitleStoragePaths(oldMovie);\n  const nextSubtitlePaths =\n    collectCustomSubtitleStoragePaths(nextMovie);\n  const keepingPaths = new Set(nextSubtitlePaths);\n  const orphanPaths = oldSubtitlePaths.filter(\n    (path) => !keepingPaths.has(path)\n  );\n\n  markCustomSubtitlePathsCommitted(nextSubtitlePaths);\n\n  if (orphanPaths.length) {\n    void removeCustomSubtitleFiles(orphanPaths).catch((error) => {\n      console.warn(\n        "[BảoFlix] Không dọn được subtitle Storage cũ:",\n        error\n      );\n    });\n  }\n\n  return next;\n}'
CM_BUILDER_OLD = 'function buildDefaultEpisodeSubtitles(\n  url: string\n): EpisodeSubtitle[] {\n  const cleanUrl = String(url || "").trim();\n\n  return cleanUrl\n    ? [\n        {\n          label: "Tiếng Việt",\n          lang: "vi",\n          url: cleanUrl,\n          default: true,\n        },\n      ]\n    : [];\n}'
CM_BUILDER_NEW = 'function buildDefaultEpisodeSubtitles(\n  url: string\n): EpisodeSubtitle[] {\n  const cleanUrl = String(url || "").trim();\n  const storagePath =\n    getCustomSubtitleStoragePathFromUrl(cleanUrl);\n\n  return cleanUrl\n    ? [\n        {\n          label: "Tiếng Việt",\n          lang: "vi",\n          url: cleanUrl,\n          source: storagePath ? "upload" : "external",\n          ...(storagePath ? { storagePath } : {}),\n          default: true,\n        },\n      ]\n    : [];\n}'
FORM_IMPORT_OLD = 'import { slugify } from "@/lib/slugify";'
FORM_IMPORT_NEW = 'import { slugify } from "@/lib/slugify";\nimport CustomSubtitleUploadPanel from "@/components/CustomSubtitleUploadPanel";'
FORM_ANCHOR = '        </label>\n\n        <button\n          type="button"\n          onClick={submit}'
FORM_REPL = '        </label>\n\n        <CustomSubtitleUploadPanel\n          movieSlug={finalSlug}\n          episodesText={episodesText}\n          onEpisodesTextChange={setEpisodesText}\n        />\n\n        <button\n          type="button"\n          onClick={submit}'
EDIT_IMPORT_NEW = 'import { slugify } from "@/lib/slugify";\nimport StoredCustomSubtitleManager from "@/components/StoredCustomSubtitleManager";'
EDIT_ANCHOR = '        <div className="flex flex-wrap gap-3">\n          <button'
EDIT_REPL = '        <StoredCustomSubtitleManager\n          movie={movieData}\n          onMovieChange={setMovieData}\n        />\n\n        <div className="flex flex-wrap gap-3">\n          <button'

def fail(message: str) -> None:
    raise RuntimeError(message)

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"[{label}] expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)

def read(path: Path) -> str:
    if not path.exists():
        fail(f"Missing file: {path}")
    return path.read_text(encoding="utf-8")

def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")

def find_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (
            (candidate / "package.json").exists()
            and (candidate / "components").exists()
            and (candidate / "lib").exists()
        ):
            return candidate
    fail("Không tìm thấy root repo BảoFlix.")

def patch_kkphim(text: str) -> str:
    if 'source?: "external" | "upload";' in text and "storagePath?: string;" in text:
        return text
    return replace_once(text, KK_OLD, KK_NEW, "EpisodeSubtitle metadata")

def patch_custom_movies_client(text: str) -> str:
    if "collectCustomSubtitleStoragePaths" not in text:
        text = replace_once(
            text,
            CM_IMPORT_OLD,
            CM_IMPORT_NEW,
            "customMoviesClient subtitle storage imports",
        )

    if "BAOFLIX_SUBTITLE_STORAGE_CLEANUP" not in text:
        text = replace_once(
            text,
            CM_DU_OLD,
            CM_DU_NEW,
            "customMoviesClient cleanup on upsert/delete",
        )

    if 'source: storagePath ? "upload" : "external"' not in text:
        text = replace_once(
            text,
            CM_BUILDER_OLD,
            CM_BUILDER_NEW,
            "customMoviesClient subtitle metadata",
        )

    return text

def patch_custom_movie_form(text: str) -> str:
    if "CustomSubtitleUploadPanel" in text:
        return text

    text = replace_once(
        text,
        FORM_IMPORT_OLD,
        FORM_IMPORT_NEW,
        "CustomMovieForm uploader import",
    )
    return replace_once(
        text,
        FORM_ANCHOR,
        FORM_REPL,
        "CustomMovieForm uploader panel",
    )

def patch_edit_custom_movie_form(text: str) -> str:
    if "StoredCustomSubtitleManager" in text:
        return text

    text = replace_once(
        text,
        FORM_IMPORT_OLD,
        EDIT_IMPORT_NEW,
        "EditCustomMovieForm manager import",
    )
    return replace_once(
        text,
        EDIT_ANCHOR,
        EDIT_REPL,
        "EditCustomMovieForm subtitle manager",
    )

def build(root: Path) -> dict[str, str]:
    return {
        "lib/customSubtitleStorage.ts": STORAGE_TS,
        "components/CustomSubtitleUploadPanel.tsx": UPLOAD_PANEL_TSX,
        "components/StoredCustomSubtitleManager.tsx": STORED_MANAGER_TSX,
        "lib/kkphim.ts": patch_kkphim(read(root / "lib/kkphim.ts")),
        "lib/customMoviesClient.ts": patch_custom_movies_client(
            read(root / "lib/customMoviesClient.ts")
        ),
        "components/CustomMovieForm.tsx": patch_custom_movie_form(
            read(root / "components/CustomMovieForm.tsx")
        ),
        "components/EditCustomMovieForm.tsx": patch_edit_custom_movie_form(
            read(root / "components/EditCustomMovieForm.tsx")
        ),
    }

def backup_files(root: Path, changed: list[str], backup_dir: Path) -> None:
    for rel in changed:
        src = root / rel
        if not src.exists():
            continue
        dst = backup_dir / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

def restore_files(root: Path, changed: list[str], backup_dir: Path) -> None:
    new_files = {
        "lib/customSubtitleStorage.ts",
        "components/CustomSubtitleUploadPanel.tsx",
        "components/StoredCustomSubtitleManager.tsx",
    }
    for rel in changed:
        target = root / rel
        saved = backup_dir / rel
        if saved.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(saved, target)
        elif rel in new_files and target.exists():
            target.unlink()

def run(root: Path, command: list[str]) -> int:
    print("$", " ".join(command))
    return subprocess.run(command, cwd=root).returncode

def main() -> int:
    parser = argparse.ArgumentParser(
        description="BảoFlix V10 - upload subtitle lên Supabase Storage"
    )
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    root = find_root(args.root)
    print("Repo:", root)

    package = json.loads(
        (root / "package.json").read_text(encoding="utf-8")
    )
    if package.get("name") != "baoflix":
        print("Cảnh báo package name:", repr(package.get("name")))

    patched = build(root)
    changed: list[str] = []

    for rel, content in patched.items():
        path = root / rel
        old = path.read_text(encoding="utf-8") if path.exists() else None
        if old != content:
            changed.append(rel)

    if not changed:
        print("Không có thay đổi: V10 có thể đã được áp dụng.")
        return 0

    print("Sẽ sửa/tạo:")
    for rel in changed:
        print(" -", rel)

    if args.dry_run:
        print("Dry-run OK: marker khớp source hiện tại.")
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = (
        root.parent
        / f"{root.name}_patch_backups"
        / f"v10_subtitle_{stamp}"
    )
    backup_files(root, changed, backup_dir)
    print("Backup:", backup_dir)

    try:
        for rel in changed:
            write(root / rel, patched[rel])

        print("Patch V10 hoàn tất.")

        if args.check:
            npm = "npm.cmd" if os.name == "nt" else "npm"
            lint_targets = [
                rel
                for rel in changed
                if Path(rel).suffix.lower()
                in {".ts", ".tsx", ".js", ".jsx", ".mts"}
            ]

            if lint_targets:
                if run(
                    root,
                    [npm, "exec", "--", "eslint", *lint_targets],
                ) != 0:
                    fail("Patched source lint failed")

            if run(root, [npm, "run", "build"]) != 0:
                fail("npm run build failed")

            print("Lint patched files + build: OK.")
        else:
            print("Nên chạy lại với --check trước khi commit/push.")

        return 0

    except Exception as exc:
        print(f"Patch lỗi, rollback: {exc}", file=sys.stderr)
        restore_files(root, changed, backup_dir)
        print("Đã rollback.", file=sys.stderr)
        return 1

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"PATCH ABORTED: {exc}", file=sys.stderr)
        raise SystemExit(2)
