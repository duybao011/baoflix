#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BảoFlix Supabase Cloud Sync Patcher

Chạy trong thư mục gốc repo:
    python baoflix_supabase_sync_patch.py

Tác dụng:
- Tạo lớp đồng bộ phim riêng với Supabase.
- Tạo bộ đồng bộ chạy toàn app.
- Phát hiện mọi lần thêm/sửa/import/xóa trong localStorage.
- Máy tính tự đẩy thay đổi lên Supabase.
- TV tự kéo thư viện từ Supabase về localStorage khi mở app/đăng nhập/online.
- Thêm nút "Đồng bộ thư viện ngay" trong Cài đặt.
- Backup file trước khi sửa và chạy npm run build.

Có thể chạy lại nhiều lần, không chèn trùng.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


REMOTE_TS = r'''"use client";

import { getSupabaseClient } from "@/lib/supabaseClient";
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
  localStorage.setItem(CUSTOM_MOVIES_KEY, JSON.stringify(movies));

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
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
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
  let downloadedCount = 0;
  let uploadedCount = 0;

  remoteRows.forEach((row) => {
    const movie = normalizeRemoteMovie(row);
    if (!movie) return;

    merged.set(movie.movie.slug, movie);
    remoteTimes.set(
      movie.movie.slug,
      Math.max(
        getTimestamp(row.updated_at),
        getTimestamp(movie.updatedAt)
      )
    );
  });

  localMovies.forEach((localMovie) => {
    const slug = localMovie.movie.slug;
    const remoteMovie = merged.get(slug);

    if (!remoteMovie) {
      merged.set(slug, localMovie);
      uploadedCount += 1;
      return;
    }

    const localTime = getTimestamp(localMovie.updatedAt);
    const remoteTime = remoteTimes.get(slug) ?? 0;

    if (localTime >= remoteTime) {
      merged.set(slug, localMovie);

      if (localTime > remoteTime) {
        uploadedCount += 1;
      }
    } else {
      downloadedCount += 1;
    }
  });

  remoteRows.forEach((row) => {
    if (!localSlugs.has(row.slug)) {
      downloadedCount += 1;
    }
  });

  return {
    movies: Array.from(merged.values()).sort(
      (a, b) => getTimestamp(b.updatedAt) - getTimestamp(a.updatedAt)
    ),
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

  const localMovies = readCustomMovies();
  const deletedCount = await deletePendingRemoteMovies(user.id, localMovies);
  const remoteRows = await fetchRemoteRows(user.id);

  const { movies, uploadedCount, downloadedCount } = mergeMovies(
    localMovies,
    remoteRows
  );

  await upsertRemoteMovies(user.id, movies);
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
'''


CLOUD_SYNC_TSX = r'''"use client";

import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  CUSTOM_MOVIES_CHANGE_EVENT,
  type CustomMoviesChangeDetail,
} from "@/lib/customMoviesClient";
import { syncCustomMoviesBidirectional } from "@/lib/customMoviesRemote";

export default function CustomMoviesCloudSync() {
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const queuedRef = useRef(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();

    async function runSync() {
      if (!active) return;

      if (runningRef.current) {
        queuedRef.current = true;
        return;
      }

      runningRef.current = true;

      try {
        await syncCustomMoviesBidirectional();
      } catch (error) {
        console.warn("[BảoFlix] Đồng bộ Supabase thất bại:", error);
      } finally {
        runningRef.current = false;

        if (queuedRef.current && active) {
          queuedRef.current = false;
          scheduleSync(250);
        }
      }
    }

    function scheduleSync(delay = 450) {
      if (!active) return;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void runSync();
      }, delay);
    }

    function handleLocalChange(event: Event) {
      const detail = (event as CustomEvent<CustomMoviesChangeDetail>).detail;
      scheduleSync(detail?.type === "delete" ? 80 : 350);
    }

    function handleStorage(event: StorageEvent) {
      if (
        event.key === "baoflix_custom_movies" ||
        event.key === "baoflix_custom_movies_pending_deletes"
      ) {
        scheduleSync(250);
      }
    }

    function handleFocus() {
      scheduleSync(200);
    }

    function handleOnline() {
      scheduleSync(50);
    }

    window.addEventListener(CUSTOM_MOVIES_CHANGE_EVENT, handleLocalChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        scheduleSync(50);
      }
    });

    scheduleSync(100);

    return () => {
      active = false;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      subscription.unsubscribe();
      window.removeEventListener(
        CUSTOM_MOVIES_CHANGE_EVENT,
        handleLocalChange
      );
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
'''


ACCOUNT_PANEL_TSX = r'''"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { readCustomMovies } from "@/lib/customMoviesClient";
import { syncCustomMoviesBidirectional } from "@/lib/customMoviesRemote";

export default function SupabaseAccountPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localCount, setLocalCount] = useState(0);

  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;

    function refreshLocalCount() {
      if (!active) return;
      setLocalCount(readCustomMovies().length);
    }

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setStatus(`Không đọc được phiên đăng nhập: ${error.message}`);
      }

      setUser(data.session?.user ?? null);
      setCheckingSession(false);
      refreshLocalCount();
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      setUser(session?.user ?? null);
      setCheckingSession(false);
      refreshLocalCount();
    });

    window.addEventListener("baoflix-custom-movies-synced", refreshLocalCount);
    window.addEventListener("baoflix-custom-movies-change", refreshLocalCount);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener(
        "baoflix-custom-movies-synced",
        refreshLocalCount
      );
      window.removeEventListener(
        "baoflix-custom-movies-change",
        refreshLocalCount
      );
    };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setStatus("Nhập đầy đủ email và mật khẩu.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setStatus(`Đăng nhập thất bại: ${error.message}`);
        return;
      }

      setUser(data.user);
      setPassword("");

      const result = await syncCustomMoviesBidirectional();

      if (result) {
        setLocalCount(result.finalCount);
      }

      setStatus(
        result
          ? `Đăng nhập và đồng bộ thành công: ${result.finalCount} phim.`
          : "Đăng nhập Supabase thành công."
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Không thể kết nối tới Supabase."
      );
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setLoading(true);
    setStatus("");

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setStatus(`Không đăng xuất được: ${error.message}`);
        return;
      }

      setUser(null);
      setEmail("");
      setPassword("");
      setStatus("Đã đăng xuất khỏi Supabase.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Không thể đăng xuất."
      );
    } finally {
      setLoading(false);
    }
  }

  async function testDatabase() {
    setLoading(true);
    setStatus("");

    try {
      const supabase = getSupabaseClient();

      const { count, error } = await supabase
        .from("custom_movies")
        .select("slug", {
          count: "exact",
          head: true,
        });

      if (error) {
        setStatus(`Kết nối database thất bại: ${error.message}`);
        return;
      }

      setStatus(
        `Kết nối database thành công. Tài khoản hiện có ${count ?? 0} phim trên Supabase.`
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Không thể kiểm tra database."
      );
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    setLoading(true);
    setStatus("");

    try {
      const result = await syncCustomMoviesBidirectional();

      if (!result) {
        setStatus("Bạn cần đăng nhập Supabase trước.");
        return;
      }

      setLocalCount(result.finalCount);

      setStatus(
        [
          `Đồng bộ xong ${result.finalCount} phim.`,
          result.uploadedCount > 0
            ? `Đẩy lên: ${result.uploadedCount}.`
            : "",
          result.downloadedCount > 0
            ? `Tải về: ${result.downloadedCount}.`
            : "",
          result.deletedCount > 0
            ? `Đã xóa trên cloud: ${result.deletedCount}.`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Đồng bộ thất bại."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-2xl font-black">Tài khoản đồng bộ</h2>

        <p className="mt-3 text-sm text-slate-400">
          Đang kiểm tra phiên đăng nhập Supabase...
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-2xl font-black">Tài khoản đồng bộ</h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Máy tính thêm hoặc sửa phim sẽ tự đẩy lên Supabase. TV đăng nhập cùng
          tài khoản sẽ tự tải thư viện về thiết bị.
        </p>
      </div>

      {user ? (
        <div className="mt-5">
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
              Đã đăng nhập
            </p>

            <p className="mt-2 break-all font-bold text-white">
              {user.email || "Tài khoản Supabase"}
            </p>

            <p className="mt-2 text-sm font-bold text-slate-300">
              Thiết bị hiện có {localCount} phim riêng.
            </p>

            <p className="mt-2 break-all text-xs text-slate-500">
              User ID: {user.id}
            </p>
          </div>

          <div
            data-tv-row
            data-tv-row-wrap="true"
            className="mt-4 flex flex-wrap gap-3"
          >
            <button
              type="button"
              onClick={syncNow}
              disabled={loading}
              className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black hover:bg-yellow-200 disabled:opacity-50"
            >
              {loading ? "Đang xử lý..." : "↻ Đồng bộ thư viện ngay"}
            </button>

            <button
              type="button"
              onClick={testDatabase}
              disabled={loading}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black hover:bg-white/10 disabled:opacity-50"
            >
              Kiểm tra database
            </button>

            <button
              type="button"
              onClick={signOut}
              disabled={loading}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black hover:bg-white/10 disabled:opacity-50"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={signIn} className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Email</span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="Email tài khoản BảoFlix"
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none focus:border-yellow-300"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Mật khẩu</span>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Mật khẩu Supabase"
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none focus:border-yellow-300"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black hover:bg-yellow-200 disabled:opacity-50"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập đồng bộ"}
          </button>
        </form>
      )}

      {status && (
        <div className="mt-4 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm font-semibold text-yellow-100">
          {status}
        </div>
      )}
    </section>
  );
}
'''


CUSTOM_MOVIES_HELPERS = r'''export const CUSTOM_MOVIES_CHANGE_EVENT =
  "baoflix-custom-movies-change";

export const CUSTOM_MOVIES_PENDING_DELETES_KEY =
  "baoflix_custom_movies_pending_deletes";

export type CustomMoviesChangeDetail = {
  type: "save" | "delete";
  slug?: string;
};

export function readPendingCustomMovieDeletions(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_MOVIES_PENDING_DELETES_KEY);
    const list = raw ? JSON.parse(raw) : [];

    return Array.isArray(list)
      ? list.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function rememberPendingCustomMovieDeletion(slug: string) {
  const cleanSlug = slug.trim();
  if (!cleanSlug) return;

  const next = Array.from(
    new Set([...readPendingCustomMovieDeletions(), cleanSlug])
  );

  localStorage.setItem(
    CUSTOM_MOVIES_PENDING_DELETES_KEY,
    JSON.stringify(next)
  );
}

export function clearPendingCustomMovieDeletions(slugs: string[]) {
  if (slugs.length === 0) return;

  const removing = new Set(slugs);
  const next = readPendingCustomMovieDeletions().filter(
    (slug) => !removing.has(slug)
  );

  localStorage.setItem(
    CUSTOM_MOVIES_PENDING_DELETES_KEY,
    JSON.stringify(next)
  );
}

function notifyCustomMoviesChanged(detail: CustomMoviesChangeDetail) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<CustomMoviesChangeDetail>(
      CUSTOM_MOVIES_CHANGE_EVENT,
      { detail }
    )
  );
}
'''


def parse_args():
    parser = argparse.ArgumentParser(
        description="Tự động thêm đồng bộ Supabase toàn app cho BảoFlix."
    )
    parser.add_argument(
        "--repo",
        type=Path,
        help="Đường dẫn repo. Mặc định tự dò từ thư mục hiện tại.",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Không chạy npm run build.",
    )
    return parser.parse_args()


def find_repo_root(start: Path) -> Path:
    start = start.resolve()

    for candidate in [start, *start.parents]:
        if (
            (candidate / "package.json").is_file()
            and (candidate / "app" / "layout.tsx").is_file()
            and (candidate / "lib" / "customMoviesClient.ts").is_file()
        ):
            return candidate

    raise FileNotFoundError(
        "Không tìm thấy repo BảoFlix. Đặt file Python cạnh package.json "
        "hoặc chạy với --repo DUONG_DAN."
    )


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        content.replace("\r\n", "\n").rstrip() + "\n",
        encoding="utf-8",
    )


def backup(path: Path, root: Path, backup_root: Path):
    if not path.exists():
        return

    relative = path.resolve().relative_to(root.resolve())
    destination = backup_root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)


def patch_custom_movies_client(text: str) -> str:
    if "CUSTOM_MOVIES_PENDING_DELETES_KEY" not in text:
        anchor = 'export const CUSTOM_MOVIES_KEY = "baoflix_custom_movies";'
        if anchor not in text:
            raise RuntimeError(
                "Không tìm thấy CUSTOM_MOVIES_KEY trong customMoviesClient.ts."
            )

        text = text.replace(
            anchor,
            anchor + "\n\n" + CUSTOM_MOVIES_HELPERS.rstrip(),
            1,
        )

    old_save = '''export function saveCustomMovies(movies: StoredCustomMovie[]) {
  localStorage.setItem(CUSTOM_MOVIES_KEY, JSON.stringify(movies));
}'''

    new_save = '''export function saveCustomMovies(
  movies: StoredCustomMovie[],
  detail: CustomMoviesChangeDetail = { type: "save" }
) {
  localStorage.setItem(CUSTOM_MOVIES_KEY, JSON.stringify(movies));
  notifyCustomMoviesChanged(detail);
}'''

    if old_save in text:
        text = text.replace(old_save, new_save, 1)
    elif "detail: CustomMoviesChangeDetail" not in text:
        raise RuntimeError(
            "Không nhận diện được hàm saveCustomMovies để thêm tín hiệu sync."
        )

    old_delete = '''export function deleteCustomMovie(slug: string) {
  const next = readCustomMovies().filter((item) => item.movie.slug !== slug);
  saveCustomMovies(next);
  return next;
}'''

    new_delete = '''export function deleteCustomMovie(slug: string) {
  const next = readCustomMovies().filter((item) => item.movie.slug !== slug);

  rememberPendingCustomMovieDeletion(slug);
  saveCustomMovies(next, { type: "delete", slug });

  return next;
}'''

    if old_delete in text:
        text = text.replace(old_delete, new_delete, 1)
    elif 'saveCustomMovies(next, { type: "delete", slug });' not in text:
        raise RuntimeError(
            "Không nhận diện được hàm deleteCustomMovie để đồng bộ xóa."
        )

    return text


def patch_layout(text: str) -> str:
    import_line = (
        'import CustomMoviesCloudSync from '
        '"@/components/CustomMoviesCloudSync";'
    )

    if import_line not in text:
        anchor = 'import PwaRegister from "@/components/PwaRegister";'

        if anchor not in text:
            raise RuntimeError(
                "Không tìm thấy import PwaRegister trong app/layout.tsx."
            )

        text = text.replace(anchor, anchor + "\n" + import_line, 1)

    if "<CustomMoviesCloudSync />" not in text:
        anchor = "        <PwaRegister />"

        if anchor not in text:
            raise RuntimeError(
                "Không tìm thấy <PwaRegister /> trong app/layout.tsx."
            )

        text = text.replace(
            anchor,
            anchor + "\n        <CustomMoviesCloudSync />",
            1,
        )

    return text


def run_build(root: Path):
    npm = "npm.cmd" if sys.platform.startswith("win") else "npm"
    command = [npm, "run", "build"]

    print("\n> " + " ".join(command))
    result = subprocess.run(command, cwd=root)

    if result.returncode != 0:
        raise RuntimeError(
            f"Build thất bại với mã {result.returncode}."
        )


def main() -> int:
    args = parse_args()

    try:
        root = find_repo_root(args.repo or Path.cwd())
    except Exception as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1

    required = [
        root / "lib" / "supabaseClient.ts",
        root / "components" / "SupabaseAccountPanel.tsx",
    ]

    missing = [path for path in required if not path.exists()]

    if missing:
        print(
            "LỖI: Chưa thấy file từ bước đăng nhập Supabase:\n"
            + "\n".join(f"- {path}" for path in missing),
            file=sys.stderr,
        )
        return 1

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = root / "backup" / f"supabase-sync-{timestamp}"
    backup_root.mkdir(parents=True, exist_ok=True)

    custom_client = root / "lib" / "customMoviesClient.ts"
    remote_file = root / "lib" / "customMoviesRemote.ts"
    cloud_component = root / "components" / "CustomMoviesCloudSync.tsx"
    account_panel = root / "components" / "SupabaseAccountPanel.tsx"
    layout = root / "app" / "layout.tsx"

    targets = [
        custom_client,
        remote_file,
        cloud_component,
        account_panel,
        layout,
    ]

    try:
        for path in targets:
            backup(path, root, backup_root)

        write_text(remote_file, REMOTE_TS)
        print("✓ Đã tạo lib/customMoviesRemote.ts")

        write_text(cloud_component, CLOUD_SYNC_TSX)
        print("✓ Đã tạo components/CustomMoviesCloudSync.tsx")

        write_text(account_panel, ACCOUNT_PANEL_TSX)
        print("✓ Đã nâng cấp components/SupabaseAccountPanel.tsx")

        patched_client = patch_custom_movies_client(
            read_text(custom_client)
        )
        write_text(custom_client, patched_client)
        print("✓ Đã nối tín hiệu thêm/sửa/xóa trong customMoviesClient.ts")

        patched_layout = patch_layout(read_text(layout))
        write_text(layout, patched_layout)
        print("✓ Đã bật đồng bộ toàn app trong app/layout.tsx")

        print(f"✓ Backup: {backup_root}")

        if not args.skip_build:
            run_build(root)
            print("✓ Build thành công")
        else:
            print("! Đã bỏ qua build")

        print(
            "\nHOÀN TẤT.\n"
            "1. Tắt npm run dev cũ rồi chạy lại.\n"
            "2. Mở /cai-dat.\n"
            '3. Bấm "Đồng bộ thư viện ngay" trên máy tính.\n'
            "4. Kiểm tra Table Editor > custom_movies trên Supabase.\n"
            "5. Trên TV đăng nhập cùng tài khoản; thư viện sẽ tự tải về."
        )
        return 0

    except Exception as error:
        print(f"\nLỖI: {error}", file=sys.stderr)
        print(f"Backup: {backup_root}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
