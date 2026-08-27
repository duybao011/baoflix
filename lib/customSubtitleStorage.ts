"use client";

import type { EpisodeSubtitle, MovieDetailResponse } from "@/lib/kkphim";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { convertSubtitleTextToVtt } from "@/lib/subtitleTools";
import { slugify } from "@/lib/slugify";

export const CUSTOM_SUBTITLE_BUCKET = "custom-subtitles";
export const MAX_CUSTOM_SUBTITLE_BYTES = 2 * 1024 * 1024;
const PENDING_UPLOADS_KEY = "baoflix_pending_custom_subtitle_uploads_v1";
const ALLOWED_EXTENSIONS = new Set(["srt", "vtt", "ass", "ssa"]);

export type CustomSubtitleUploadResult = {
  url: string;
  storagePath: string;
  originalName: string;
};

function extensionOf(name: string) {
  return String(name || "").trim().toLowerCase().split(".").pop() || "";
}

function contentTypeFor(extension: string) {
  if (extension === "vtt") return "text/vtt;charset=utf-8";
  if (extension === "srt") return "application/x-subrip";
  return "text/plain;charset=utf-8";
}

function readPendingUploads(): string[] {
  try {
    const raw = localStorage.getItem(PENDING_UPLOADS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item))
      : [];
  } catch {
    return [];
  }
}

function writePendingUploads(paths: string[]) {
  localStorage.setItem(
    PENDING_UPLOADS_KEY,
    JSON.stringify(Array.from(new Set(paths)))
  );
}

function rememberPendingUpload(path: string) {
  if (path) writePendingUploads([...readPendingUploads(), path]);
}

export function isCustomSubtitlePathPending(path: string) {
  return readPendingUploads().includes(path);
}

export function markCustomSubtitlePathsCommitted(paths: string[]) {
  if (!paths.length) return;
  const committed = new Set(paths);
  writePendingUploads(readPendingUploads().filter((path) => !committed.has(path)));
}

export function getCustomSubtitleStoragePathFromUrl(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const marker = `/storage/v1/object/public/${CUSTOM_SUBTITLE_BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return "";

    return parsed.pathname
      .slice(index + marker.length)
      .split("/")
      .map((part) => {
        try {
          return decodeURIComponent(part);
        } catch {
          return part;
        }
      })
      .join("/");
  } catch {
    return "";
  }
}

export function getCustomSubtitleStoragePath(
  subtitle?: Partial<EpisodeSubtitle> | null
) {
  const explicit = String(subtitle?.storagePath || "").trim();
  return explicit || getCustomSubtitleStoragePathFromUrl(String(subtitle?.url || ""));
}

export function collectCustomSubtitleStoragePaths(
  data?: Pick<MovieDetailResponse, "episodes"> | null
) {
  const paths: string[] = [];
  (data?.episodes || []).forEach((season) => {
    (season.server_data || []).forEach((episode) => {
      (episode.subtitles || []).forEach((subtitle) => {
        const path = getCustomSubtitleStoragePath(subtitle);
        if (path) paths.push(path);
      });
    });
  });
  return Array.from(new Set(paths));
}

export async function validateCustomSubtitleFile(file: File) {
  const extension = extensionOf(file.name);

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Chỉ hỗ trợ file .srt, .vtt, .ass hoặc .ssa.");
  }
  if (file.size <= 0) throw new Error("File phụ đề đang trống.");
  if (file.size > MAX_CUSTOM_SUBTITLE_BYTES) {
    throw new Error("File phụ đề vượt quá 2 MB.");
  }

  const text = await file.text();
  convertSubtitleTextToVtt(text, file.name);

  return {
    extension,
    contentType: contentTypeFor(extension),
  };
}

export async function uploadCustomSubtitle(input: {
  file: File;
  movieSlug: string;
  seasonIndex: number;
  episodeIndex: number;
}) {
  const { extension, contentType } = await validateCustomSubtitleFile(input.file);
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) {
    throw new Error("Bạn cần đăng nhập BảoFlix trước khi upload phụ đề.");
  }

  const movieSlug = slugify(input.movieSlug || "phim-rieng");
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const storagePath = [
    user.id,
    movieSlug,
    `season-${input.seasonIndex + 1}`,
    `episode-${input.episodeIndex + 1}-${randomId}.${extension}`,
  ].join("/");

  const { error } = await supabase.storage
    .from(CUSTOM_SUBTITLE_BUCKET)
    .upload(storagePath, input.file, {
      cacheControl: "3600",
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload phụ đề thất bại: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(CUSTOM_SUBTITLE_BUCKET)
    .getPublicUrl(storagePath);

  const publicUrl = String(data?.publicUrl || "").trim();
  if (!publicUrl) {
    await supabase.storage.from(CUSTOM_SUBTITLE_BUCKET).remove([storagePath]).catch(() => undefined);
    throw new Error("Upload thành công nhưng không lấy được public URL.");
  }

  // BAOFLIX_V11_VERIFY_PUBLIC_SUBTITLE
  // getPublicUrl() chỉ tạo URL; nó không xác nhận bucket thật sự đang public.
  try {
    const verifyResponse = await fetch(publicUrl, {
      cache: "no-store",
    });

    if (!verifyResponse.ok) {
      throw new Error(`HTTP ${verifyResponse.status}`);
    }
  } catch (error) {
    await supabase.storage
      .from(CUSTOM_SUBTITLE_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);

    const reason =
      error instanceof Error ? error.message : "fetch failed";

    throw new Error(
      `File đã upload nhưng public URL không đọc được (${reason}). ` +
      `Kiểm tra bucket "${CUSTOM_SUBTITLE_BUCKET}" phải bật Public.`
    );
  }

  rememberPendingUpload(storagePath);

  return {
    url: publicUrl,
    storagePath,
    originalName: input.file.name,
  } satisfies CustomSubtitleUploadResult;
}

export async function removeCustomSubtitleFiles(paths: string[]) {
  const uniquePaths = Array.from(
    new Set(paths.map((path) => String(path || "").trim()).filter(Boolean))
  );
  if (!uniquePaths.length) return;

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from(CUSTOM_SUBTITLE_BUCKET)
    .remove(uniquePaths);

  if (error) {
    throw new Error(`Không xóa được file phụ đề: ${error.message}`);
  }

  markCustomSubtitlePathsCommitted(uniquePaths);
}
