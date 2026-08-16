#!/usr/bin/env python3
# -*- coding: utf-8 -*-
'''
BảoFlix: đồng bộ lịch sử PC local <-> điện thoại Vercel, tách TV.

Trước khi chạy:
1. Chạy BaoFlix_Watch_History_Supabase.sql trong Supabase SQL Editor.
2. Đăng nhập cùng tài khoản Supabase trên PC và điện thoại.

TV Mode luôn bị loại khỏi history sync.

Lệnh:
  python BaoFlix_Personal_History_Sync.py --dry-run
  python BaoFlix_Personal_History_Sync.py
  python BaoFlix_Personal_History_Sync.py --verify
'''

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

MARKER = "BAOFLIX_PERSONAL_HISTORY_SYNC"

PROTECTED = {
    Path("components/TvRemoteNavigator.tsx"),
    Path("components/TvWatchOverlay.tsx"),
    Path("components/TvRemoteKeyBridge.tsx"),
    Path("components/TvPlayerCommandBridge.tsx"),
    Path("components/NativeVideoPlayer.tsx"),
    Path("components/CustomDrivePlayer.tsx"),
}


class PatchError(RuntimeError):
    pass


SYNC_COMPONENT = r'''\"use client\";

// BAOFLIX_PERSONAL_HISTORY_SYNC

import { useEffect, useRef } from \"react\";
import { getSupabaseClient } from \"@/lib/supabaseClient\";
import { isTvModeActive } from \"@/lib/tvMode\";
import {
  applySyncedWatchState,
  normalizeWatchHistory,
  readWatchHistory,
  readWatchedEpisodes,
  WATCH_STORE_CHANGE_EVENT,
  type WatchHistoryItem,
} from \"@/lib/watchStore\";

const TABLE = \"watch_history_sync\";
const SYNC_GROUP = \"personal\";
const MIN_SYNC_INTERVAL_MS = 5000;
const PERIODIC_SYNC_MS = 60000;

function isTvSession() {
  if (typeof window === \"undefined\") return false;

  return (
    window.location.pathname === \"/tv\" ||
    isTvModeActive({ allowSessionOnDesktop: true })
  );
}

function normalizeRemoteHistory(value: unknown): WatchHistoryItem[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is WatchHistoryItem =>
      Boolean(
        item &&
          typeof item === \"object\" &&
          typeof (item as WatchHistoryItem).slug === \"string\"
      )
  );
}

function normalizeRemoteWatched(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === \"string\" && Boolean(item)
  );
}

function mergeWatched(local: string[], remote: string[]) {
  return Array.from(new Set([...local, ...remote])).slice(0, 5000);
}

export default function WatchHistoryCloudSync() {
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const queuedRef = useRef(false);
  const lastCompletedRef = useRef(0);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();

    function schedule(delay = 800, force = false) {
      if (!active) return;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void sync(force);
      }, delay);
    }

    async function sync(force = false) {
      if (!active || isTvSession()) return;

      if (
        !force &&
        lastCompletedRef.current &&
        Date.now() - lastCompletedRef.current < MIN_SYNC_INTERVAL_MS
      ) {
        return;
      }

      if (runningRef.current) {
        queuedRef.current = true;
        return;
      }

      runningRef.current = true;

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) return;

        const { data, error } = await supabase
          .from(TABLE)
          .select(\"history,watched_episodes\")
          .eq(\"user_id\", user.id)
          .eq(\"sync_group\", SYNC_GROUP)
          .maybeSingle();

        if (error) throw error;

        const remoteHistory = normalizeRemoteHistory(data?.history);
        const remoteWatched = normalizeRemoteWatched(
          data?.watched_episodes
        );

        const localHistory = readWatchHistory();
        const localWatched = readWatchedEpisodes();

        const mergedHistory = normalizeWatchHistory([
          ...localHistory,
          ...remoteHistory,
        ]).slice(0, 200);

        const mergedWatched = mergeWatched(
          localWatched,
          remoteWatched
        );

        applySyncedWatchState(
          mergedHistory,
          mergedWatched
        );

        const remoteChanged =
          !data ||
          JSON.stringify(remoteHistory) !==
            JSON.stringify(mergedHistory) ||
          JSON.stringify(remoteWatched) !==
            JSON.stringify(mergedWatched);

        if (remoteChanged) {
          const { error: upsertError } = await supabase
            .from(TABLE)
            .upsert(
              {
                user_id: user.id,
                sync_group: SYNC_GROUP,
                history: mergedHistory,
                watched_episodes: mergedWatched,
                updated_at: new Date().toISOString(),
              },
              { onConflict: \"user_id,sync_group\" }
            );

          if (upsertError) throw upsertError;
        }

        lastCompletedRef.current = Date.now();
      } catch (error) {
        console.warn(
          \"[BảoFlix] History sync thất bại:\",
          error
        );
      } finally {
        runningRef.current = false;

        if (queuedRef.current && active) {
          queuedRef.current = false;
          schedule(500, true);
        }
      }
    }

    function handleLocalChange() {
      schedule(900, false);
    }

    function handleFocus() {
      schedule(400, false);
    }

    function handleOnline() {
      schedule(150, true);
    }

    function handleTvModeChange() {
      schedule(400, true);
    }

    window.addEventListener(
      WATCH_STORE_CHANGE_EVENT,
      handleLocalChange
    );
    window.addEventListener(\"focus\", handleFocus);
    window.addEventListener(\"online\", handleOnline);
    window.addEventListener(
      \"baoflix-tv-mode-change\",
      handleTvModeChange
    );

    const interval = window.setInterval(() => {
      void sync(false);
    }, PERIODIC_SYNC_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === \"SIGNED_IN\") {
        schedule(100, true);
      } else if (event === \"TOKEN_REFRESHED\") {
        schedule(500, false);
      }
    });

    schedule(1600, false);

    return () => {
      active = false;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      window.clearInterval(interval);
      subscription.unsubscribe();

      window.removeEventListener(
        WATCH_STORE_CHANGE_EVENT,
        handleLocalChange
      );
      window.removeEventListener(\"focus\", handleFocus);
      window.removeEventListener(\"online\", handleOnline);
      window.removeEventListener(
        \"baoflix-tv-mode-change\",
        handleTvModeChange
      );
    };
  }, []);

  return null;
}
'''


def find_root(start: Path) -> Path:
    start = start.expanduser().resolve()

    for candidate in (start, *start.parents):
        if (
            (candidate / "package.json").is_file()
            and (candidate / "app/layout.tsx").is_file()
            and (candidate / "lib/watchStore.ts").is_file()
        ):
            return candidate

    raise PatchError("Không tìm thấy root repo BảoFlix.")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)

    if count != 1:
        raise PatchError(
            f"Anchor '{label}' xuất hiện {count} lần; dừng để tránh sửa nhầm."
        )

    return text.replace(old, new, 1)


def patch_watch_store(text: str) -> str:
    if MARKER in text:
        return text

    text = replace_once(
        text,
        'export const WATCHED_KEY = "baoflix_watched_episodes";',
        'export const WATCHED_KEY = "baoflix_watched_episodes";\n'
        'export const WATCH_STORE_CHANGE_EVENT = "baoflix-watch-store-change";\n'
        '// BAOFLIX_PERSONAL_HISTORY_SYNC',
        "watch event constant",
    )

    text = replace_once(
        text,
        '''export function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}''',
        '''export function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));

  if (key === HISTORY_KEY || key === WATCHED_KEY) {
    window.dispatchEvent(
      new CustomEvent(WATCH_STORE_CHANGE_EVENT, {
        detail: { key },
      })
    );
  }
}''',
        "writeJson",
    )

    helper = r'''export function applySyncedWatchState(
  history: WatchHistoryItem[],
  watchedEpisodes: string[]
) {
  const nextHistory = normalizeWatchHistory(history).slice(0, 200);
  const nextWatched = Array.from(
    new Set(watchedEpisodes.filter(Boolean))
  ).slice(0, 5000);

  const oldHistory = readJson<WatchHistoryItem[]>(
    HISTORY_KEY,
    []
  );
  const oldWatched = readJson<string[]>(
    WATCHED_KEY,
    []
  );

  let changed = false;

  if (
    JSON.stringify(oldHistory) !== JSON.stringify(nextHistory)
  ) {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(nextHistory)
    );
    changed = true;
  }

  if (
    JSON.stringify(oldWatched) !== JSON.stringify(nextWatched)
  ) {
    localStorage.setItem(
      WATCHED_KEY,
      JSON.stringify(nextWatched)
    );
    changed = true;
  }

  if (changed) {
    window.dispatchEvent(new Event("storage"));
  }

  return changed;
}

'''

    anchor = "export function readWatchHistory() {"

    if anchor not in text:
        raise PatchError("Không tìm thấy readWatchHistory().")

    return text.replace(anchor, helper + anchor, 1)


def patch_layout(text: str) -> str:
    if MARKER in text:
        return text

    import_anchor = (
        'import CustomMoviesCloudSync from "@/components/CustomMoviesCloudSync";'
    )

    text = replace_once(
        text,
        import_anchor,
        import_anchor
        + '\nimport WatchHistoryCloudSync from "@/components/WatchHistoryCloudSync";'
        + '\n// BAOFLIX_PERSONAL_HISTORY_SYNC',
        "layout import",
    )

    return replace_once(
        text,
        "<CustomMoviesCloudSync />",
        "<CustomMoviesCloudSync />\n"
        "        <WatchHistoryCloudSync />",
        "layout mount",
    )


def backup(root: Path, changed: list[Path]) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = root / "backup" / f"history-sync-{stamp}"

    for relative in changed:
        source = root / relative
        if source.is_file():
            dest = target / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)

    return target


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.history-sync.tmp")
    temp.write_text(content, encoding="utf-8", newline="\n")
    os.replace(temp, path)


def run(command: list[str], root: Path) -> bool:
    print(f"\n$ {' '.join(command)}")
    return subprocess.run(
        command,
        cwd=root,
        check=False,
    ).returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()

    try:
        root = find_root(args.repo)

        targets = {
            Path("lib/watchStore.ts"),
            Path("app/layout.tsx"),
            Path("components/WatchHistoryCloudSync.tsx"),
        }

        if targets & PROTECTED:
            raise PatchError("Protected file nằm trong target.")

        watch_path = root / "lib/watchStore.ts"
        layout_path = root / "app/layout.tsx"
        sync_path = root / "components/WatchHistoryCloudSync.tsx"

        watch_new = patch_watch_store(
            watch_path.read_text(encoding="utf-8")
        )
        layout_new = patch_layout(
            layout_path.read_text(encoding="utf-8")
        )

        if sync_path.exists():
            sync_old = sync_path.read_text(encoding="utf-8")
            if MARKER not in sync_old:
                raise PatchError(
                    "WatchHistoryCloudSync.tsx đã tồn tại nhưng không phải patch này."
                )
            sync_new = sync_old
        else:
            sync_new = SYNC_COMPONENT

        outputs = {
            Path("lib/watchStore.ts"): watch_new,
            Path("app/layout.tsx"): layout_new,
            Path("components/WatchHistoryCloudSync.tsx"): sync_new,
        }

        changed = []
        for relative, content in outputs.items():
            full = root / relative
            old = (
                full.read_text(encoding="utf-8")
                if full.is_file()
                else None
            )
            if old != content:
                changed.append(relative)

        print(f"Repo: {root}")
        print("\nFile sẽ thay đổi:")
        for relative in changed:
            print(f"- {relative}")

        print("\nProtected - không sửa:")
        for relative in sorted(PROTECTED, key=str):
            print(f"- {relative}")

        if args.dry_run:
            print("\nDry-run OK. Chưa ghi file.")
            return 0

        if not changed:
            print("\nHistory sync đã được áp dụng.")
            return 0

        backup_dir = backup(root, changed)

        for relative in changed:
            atomic_write(root / relative, outputs[relative])

        print(f"\nBackup: {backup_dir}")
        print(
            "Đã bật personal history sync cho PC/điện thoại; TV Mode tách riêng."
        )

        if args.verify:
            lint_ok = run(["npm", "run", "lint"], root)
            build_ok = run(["npm", "run", "build"], root)

            if not lint_ok or not build_ok:
                print(
                    "\nLint/build chưa đạt. Bản cũ nằm trong backup.",
                    file=sys.stderr,
                )
                return 2

        return 0

    except PatchError as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1
    except OSError as error:
        print(f"LỖI HỆ THỐNG: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
