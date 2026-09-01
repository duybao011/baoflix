"use client";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { ensureLocalStateForUser } from "@/lib/accountLocalState";
import {
  CUSTOM_MOVIES_KEY,
  clearPendingCustomMovieDeletions,
  readCustomMovies,
  readPendingCustomMovieDeletions,
  type StoredCustomMovie,
} from "@/lib/customMoviesClient";

type RemoteMovieRow = {
  slug: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
};

export type CustomMoviesSyncResult = {
  beforeLocalCount: number;
  beforeRemoteCount: number;
  finalCount: number;
  uploadedCount: number;
  downloadedCount: number;
  deletedCount: number;
};

function isStoredCustomMovie(value: unknown): value is StoredCustomMovie {
  if (!value || typeof value !== "object") return false;

  const item = value as Partial<StoredCustomMovie>;

  return Boolean(
    item.movie?.slug &&
      item.movie?.name &&
      Array.isArray(item.episodes)
  );
}

function getTimestamp(value?: string | null) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizeRemoteMovie(row: RemoteMovieRow): StoredCustomMovie | null {
  if (!isStoredCustomMovie(row.payload)) return null;

  const movie = row.payload;

  return {
    ...movie,
    source: "local",
    createdAt: movie.createdAt || row.created_at,
    updatedAt: movie.updatedAt || row.updated_at,
  };
}

function writeCustomMoviesCache(movies: StoredCustomMovie[]) {
  const nextValue = JSON.stringify(movies);
  const currentValue = localStorage.getItem(CUSTOM_MOVIES_KEY);

  if (currentValue === nextValue) return;

  localStorage.setItem(CUSTOM_MOVIES_KEY, nextValue);
  window.dispatchEvent(
    new CustomEvent("baoflix-custom-movies-synced", {
      detail: {
        count: movies.length,
        syncedAt: new Date().toISOString(),
      },
    })
  );
}

async function getAuthenticatedUser() {
  const supabase = getSupabaseClient();

  // BAOFLIX_PERF_PHASE2A_AUTH_SESSION_GATE
  // Chỉ cần biết local client hiện có session hay không trước khi sync.
  // Các query custom_movies phía sau vẫn được Supabase JWT/RLS bảo vệ.
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    return null;
  }

  return session.user;
}

async function fetchRemoteRows(userId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("custom_movies")
    .select("slug,payload,created_at,updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Không tải được thư viện Supabase: ${error.message}`);
  }

  return (data ?? []) as RemoteMovieRow[];
}

async function deletePendingRemoteMovies(
  userId: string,
  localMovies: StoredCustomMovie[]
) {
  const pendingSlugs = readPendingCustomMovieDeletions();

  if (pendingSlugs.length === 0) {
    return 0;
  }

  const localSlugs = new Set(localMovies.map((item) => item.movie.slug));
  const trulyDeleted = pendingSlugs.filter((slug) => !localSlugs.has(slug));

  if (trulyDeleted.length > 0) {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("custom_movies")
      .delete()
      .eq("owner_id", userId)
      .in("slug", trulyDeleted);

    if (error) {
      throw new Error(`Không xóa được phim trên Supabase: ${error.message}`);
    }
  }

  clearPendingCustomMovieDeletions(pendingSlugs);
  return trulyDeleted.length;
}

function mergeMovies(
  localMovies: StoredCustomMovie[],
  remoteRows: RemoteMovieRow[]
) {
  const merged = new Map<string, StoredCustomMovie>();
  const remoteTimes = new Map<string, number>();
  const localSlugs = new Set(localMovies.map((item) => item.movie.slug));
  const moviesToUpload: StoredCustomMovie[] = [];
  let downloadedCount = 0;
  let uploadedCount = 0;

  remoteRows.forEach((row) => {
    const movie = normalizeRemoteMovie(row);
    if (!movie) return;
    merged.set(movie.movie.slug, movie);
    remoteTimes.set(
      movie.movie.slug,
      Math.max(getTimestamp(row.updated_at), getTimestamp(movie.updatedAt))
    );
  });

  localMovies.forEach((localMovie) => {
    const slug = localMovie.movie.slug;
    const remoteMovie = merged.get(slug);

    if (!remoteMovie) {
      merged.set(slug, localMovie);
      moviesToUpload.push(localMovie);
      uploadedCount += 1;
      return;
    }

    const localTime = getTimestamp(localMovie.updatedAt);
    const remoteTime = remoteTimes.get(slug) ?? 0;

    if (localTime >= remoteTime) {
      merged.set(slug, localMovie);
      if (localTime > remoteTime) {
        moviesToUpload.push(localMovie);
        uploadedCount += 1;
      }
    } else {
      downloadedCount += 1;
    }
  });

  remoteRows.forEach((row) => {
    if (!localSlugs.has(row.slug)) downloadedCount += 1;
  });

  return {
    movies: Array.from(merged.values()).sort(
      (a, b) => getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt)
    ),
    moviesToUpload,
    uploadedCount,
    downloadedCount,
  };
}

async function upsertRemoteMovies(
  userId: string,
  movies: StoredCustomMovie[]
) {
  if (movies.length === 0) return;

  const supabase = getSupabaseClient();

  const rows = movies.map((movie) => ({
    owner_id: userId,
    slug: movie.movie.slug,
    payload: movie,
    created_at: movie.createdAt || new Date().toISOString(),
    updated_at: movie.updatedAt || new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("custom_movies")
    .upsert(rows, {
      onConflict: "owner_id,slug",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Không đưa được phim lên Supabase: ${error.message}`);
  }
}

export async function syncCustomMoviesBidirectional(): Promise<
  CustomMoviesSyncResult | null
> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  ensureLocalStateForUser(user.id);

  const localMovies = readCustomMovies();
  const deletedCount = await deletePendingRemoteMovies(user.id, localMovies);
  const remoteRows = await fetchRemoteRows(user.id);

  const {
    movies,
    moviesToUpload,
    uploadedCount,
    downloadedCount,
  } = mergeMovies(localMovies, remoteRows);

  // BAOFLIX_PERF_PHASE1: chỉ upload bản local thực sự mới hơn/không tồn tại.
  await upsertRemoteMovies(user.id, moviesToUpload);
  writeCustomMoviesCache(movies);

  return {
    beforeLocalCount: localMovies.length,
    beforeRemoteCount: remoteRows.length,
    finalCount: movies.length,
    uploadedCount,
    downloadedCount,
    deletedCount,
  };
}

export async function fetchRemoteCustomMovies() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return [];
  }

  const rows = await fetchRemoteRows(user.id);

  return rows
    .map(normalizeRemoteMovie)
    .filter((movie): movie is StoredCustomMovie => Boolean(movie));
}
