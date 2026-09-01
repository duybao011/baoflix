#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import datetime as dt
import shutil
import subprocess
import sys
from pathlib import Path

MARKERS = {
    "lib/favoritesStore.ts": "BAOFLIX_PERF_PHASE2A_FAVORITES_CACHE",
    "components/MovieCard.tsx": "BAOFLIX_PERF_PHASE2A_FAVORITES_CACHE",
    "components/WatchHistoryCloudSync.tsx": "BAOFLIX_PERF_PHASE2A_AUTH_SESSION_GATE",
    "lib/customMoviesRemote.ts": "BAOFLIX_PERF_PHASE2A_AUTH_SESSION_GATE",
}

TARGETS = [
    Path("lib/favoritesStore.ts"),
    Path("components/MovieCard.tsx"),
    Path("components/WatchHistoryCloudSync.tsx"),
    Path("lib/customMoviesRemote.ts"),
    Path(".gitignore"),
    Path(".vercelignore"),
]

PROTECTED = [
    Path("components/NativeVideoPlayer.tsx"),
    Path("components/CustomDrivePlayer.tsx"),
    Path("components/TvRemoteNavigator.tsx"),
    Path("components/TvWatchOverlay.tsx"),
    Path("components/TvPlayerCommandBridge.tsx"),
]

OLD_FAVORITES = "\"use client\";\n\nimport type { MovieItem } from \"@/lib/kkphim\";\n\nexport const FAVORITES_KEY = \"baoflix_favorites\";\nexport const FAVORITES_CHANGE_EVENT = \"baoflix-favorites-change\";\n\ntype ChangeDetail = {\n  type: \"toggle\" | \"remove\" | \"replace\";\n  slug?: string;\n};\n\nfunction notify(detail: ChangeDetail) {\n  if (typeof window === \"undefined\") return;\n  window.dispatchEvent(new CustomEvent(FAVORITES_CHANGE_EVENT, { detail }));\n}\n\nexport function readFavorites(): MovieItem[] {\n  try {\n    const raw = localStorage.getItem(FAVORITES_KEY);\n    const parsed = raw ? JSON.parse(raw) : [];\n    return Array.isArray(parsed)\n      ? parsed.filter((item): item is MovieItem => Boolean(item?.slug && item?.name))\n      : [];\n  } catch {\n    return [];\n  }\n}\n\nexport function isFavorite(slug: string) {\n  return readFavorites().some((item) => item.slug === slug);\n}\n\nexport function writeFavorites(movies: MovieItem[], detail: ChangeDetail = { type: \"replace\" }) {\n  localStorage.setItem(FAVORITES_KEY, JSON.stringify(movies));\n  notify(detail);\n  return movies;\n}\n\nexport function toggleFavorite(movie: MovieItem) {\n  const movies = readFavorites();\n  const exists = movies.some((item) => item.slug === movie.slug);\n  const next = exists\n    ? movies.filter((item) => item.slug !== movie.slug)\n    : [movie, ...movies];\n  writeFavorites(next, { type: \"toggle\", slug: movie.slug });\n  return { saved: !exists, movies: next };\n}\n\nexport function removeFavorite(slug: string) {\n  const next = readFavorites().filter((item) => item.slug !== slug);\n  writeFavorites(next, { type: \"remove\", slug });\n  return next;\n}\n"
NEW_FAVORITES = "\"use client\";\n\nimport type { MovieItem } from \"@/lib/kkphim\";\n\nexport const FAVORITES_KEY = \"baoflix_favorites\";\nexport const FAVORITES_CHANGE_EVENT = \"baoflix-favorites-change\";\n\n// BAOFLIX_PERF_PHASE2A_FAVORITES_CACHE\n// Một cache + một bộ listener toàn cục dùng chung cho mọi MovieCard.\n// Tránh mỗi card tự parse cùng một localStorage và tự gắn focus/storage listener.\ntype ChangeDetail = {\n  type: \"toggle\" | \"remove\" | \"replace\";\n  slug?: string;\n};\n\ntype FavoriteSubscriber = () => void;\n\nlet cachedRaw: string | null | undefined;\nlet cachedMovies: MovieItem[] = [];\nlet cachedSlugs = new Set<string>();\nconst subscribers = new Set<FavoriteSubscriber>();\nlet globalListenersAttached = false;\n\nfunction parseFavorites(raw: string | null): MovieItem[] {\n  try {\n    const parsed = raw ? JSON.parse(raw) : [];\n    return Array.isArray(parsed)\n      ? parsed.filter(\n          (item): item is MovieItem =>\n            Boolean(item?.slug && item?.name)\n        )\n      : [];\n  } catch {\n    return [];\n  }\n}\n\nfunction updateCache(raw: string | null) {\n  if (cachedRaw === raw) return false;\n\n  cachedRaw = raw;\n  cachedMovies = parseFavorites(raw);\n  cachedSlugs = new Set(\n    cachedMovies.map((movie) => movie.slug)\n  );\n\n  return true;\n}\n\nfunction ensureCache() {\n  if (cachedRaw !== undefined) return;\n  if (typeof window === \"undefined\") return;\n\n  updateCache(localStorage.getItem(FAVORITES_KEY));\n}\n\nfunction refreshCacheFromStorage() {\n  if (typeof window === \"undefined\") return false;\n  return updateCache(localStorage.getItem(FAVORITES_KEY));\n}\n\nfunction emitSubscribers() {\n  subscribers.forEach((subscriber) => {\n    try {\n      subscriber();\n    } catch {\n      // Một card lỗi không được làm ngắt cập nhật các card khác.\n    }\n  });\n}\n\nfunction handleStorage(event: StorageEvent) {\n  if (\n    event.key !== null &&\n    event.key !== FAVORITES_KEY\n  ) {\n    return;\n  }\n\n  const changed =\n    event.key === FAVORITES_KEY\n      ? updateCache(event.newValue)\n      : refreshCacheFromStorage();\n\n  if (changed) emitSubscribers();\n}\n\nfunction handleFocus() {\n  if (refreshCacheFromStorage()) {\n    emitSubscribers();\n  }\n}\n\nfunction handleLegacyFavoriteChange() {\n  // Tương thích code cũ có thể tự ghi localStorage rồi phát event.\n  if (refreshCacheFromStorage()) {\n    emitSubscribers();\n  }\n}\n\nfunction attachGlobalListeners() {\n  if (\n    globalListenersAttached ||\n    typeof window === \"undefined\"\n  ) {\n    return;\n  }\n\n  globalListenersAttached = true;\n  window.addEventListener(\"storage\", handleStorage);\n  window.addEventListener(\"focus\", handleFocus);\n  window.addEventListener(\n    FAVORITES_CHANGE_EVENT,\n    handleLegacyFavoriteChange\n  );\n}\n\nfunction detachGlobalListeners() {\n  if (\n    !globalListenersAttached ||\n    typeof window === \"undefined\"\n  ) {\n    return;\n  }\n\n  globalListenersAttached = false;\n  window.removeEventListener(\"storage\", handleStorage);\n  window.removeEventListener(\"focus\", handleFocus);\n  window.removeEventListener(\n    FAVORITES_CHANGE_EVENT,\n    handleLegacyFavoriteChange\n  );\n}\n\nfunction notify(detail: ChangeDetail) {\n  if (typeof window === \"undefined\") return;\n  window.dispatchEvent(\n    new CustomEvent(FAVORITES_CHANGE_EVENT, { detail })\n  );\n}\n\nexport function subscribeFavorites(\n  subscriber: FavoriteSubscriber\n) {\n  if (typeof window === \"undefined\") {\n    return () => {};\n  }\n\n  // Đọc localStorage đúng một lần trước khi card đầu tiên subscribe.\n  ensureCache();\n\n  subscribers.add(subscriber);\n  if (subscribers.size === 1) {\n    attachGlobalListeners();\n  }\n\n  return () => {\n    subscribers.delete(subscriber);\n\n    if (subscribers.size === 0) {\n      detachGlobalListeners();\n    }\n  };\n}\n\nexport function readFavorites(): MovieItem[] {\n  // Các màn hình không subscribe vẫn nhận dữ liệu mới nhất khi chủ động đọc.\n  refreshCacheFromStorage();\n  return [...cachedMovies];\n}\n\nexport function isFavorite(slug: string) {\n  ensureCache();\n  return cachedSlugs.has(slug);\n}\n\nexport function writeFavorites(\n  movies: MovieItem[],\n  detail: ChangeDetail = { type: \"replace\" }\n) {\n  const raw = JSON.stringify(movies);\n  localStorage.setItem(FAVORITES_KEY, raw);\n\n  if (updateCache(raw)) {\n    emitSubscribers();\n  }\n\n  // Giữ event cũ cho PersonalDashboard/các component hiện hữu.\n  notify(detail);\n  return movies;\n}\n\nexport function toggleFavorite(movie: MovieItem) {\n  const movies = readFavorites();\n  const exists = cachedSlugs.has(movie.slug);\n  const next = exists\n    ? movies.filter((item) => item.slug !== movie.slug)\n    : [movie, ...movies];\n\n  writeFavorites(next, {\n    type: \"toggle\",\n    slug: movie.slug,\n  });\n\n  return { saved: !exists, movies: next };\n}\n\nexport function removeFavorite(slug: string) {\n  const next = readFavorites().filter(\n    (item) => item.slug !== slug\n  );\n\n  writeFavorites(next, {\n    type: \"remove\",\n    slug,\n  });\n\n  return next;\n}\n"
OLD_MOVIECARD_IMPORT = "import {\n  FAVORITES_CHANGE_EVENT,\n  isFavorite,\n  toggleFavorite as toggleFavoriteStore,\n} from \"@/lib/favoritesStore\";\n"
NEW_MOVIECARD_IMPORT = "import {\n  isFavorite,\n  subscribeFavorites,\n  toggleFavorite as toggleFavoriteStore,\n} from \"@/lib/favoritesStore\";\n"
OLD_MOVIECARD_EFFECT = "  useEffect(() => {\n    function refresh() {\n      setSaved(isFavorite(movie.slug));\n    }\n\n    refresh();\n    window.addEventListener(FAVORITES_CHANGE_EVENT, refresh);\n    window.addEventListener(\"storage\", refresh);\n    window.addEventListener(\"focus\", refresh);\n\n    return () => {\n      window.removeEventListener(FAVORITES_CHANGE_EVENT, refresh);\n      window.removeEventListener(\"storage\", refresh);\n      window.removeEventListener(\"focus\", refresh);\n    };\n  }, [movie.slug]);\n"
NEW_MOVIECARD_EFFECT = "  // BAOFLIX_PERF_PHASE2A_FAVORITES_CACHE\n  // Mỗi card chỉ subscribe vào store trong RAM.\n  // Store tự giữ đúng một bộ listener storage/focus cho toàn trang.\n  useEffect(() => {\n    function refresh() {\n      setSaved(isFavorite(movie.slug));\n    }\n\n    const unsubscribe = subscribeFavorites(refresh);\n    refresh();\n\n    return unsubscribe;\n  }, [movie.slug]);\n"
OLD_HISTORY_AUTH = "        const {\n          data: { user },\n          error: userError,\n        } = await supabase.auth.getUser();\n\n        if (userError) throw userError;\n        if (!user) return;\n\n        ensureLocalStateForUser(user.id);\n"
NEW_HISTORY_AUTH = "        // BAOFLIX_PERF_PHASE2A_AUTH_SESSION_GATE\n        // getSession() đọc session local trước. Guest không còn gọi getUser()\n        // ra Auth server chỉ để nhận AuthSessionMissingError.\n        // Data API phía dưới vẫn dùng JWT/RLS của Supabase như cũ.\n        const {\n          data: { session },\n          error: sessionError,\n        } = await supabase.auth.getSession();\n\n        if (sessionError) throw sessionError;\n\n        const user = session?.user;\n        if (!user) {\n          lastCompletedRef.current = Date.now();\n          return;\n        }\n\n        ensureLocalStateForUser(user.id);\n"
OLD_CUSTOM_AUTH = "async function getAuthenticatedUser() {\n  const supabase = getSupabaseClient();\n  const { data, error } = await supabase.auth.getUser();\n\n  if (error || !data.user) {\n    return null;\n  }\n\n  return data.user;\n}\n"
NEW_CUSTOM_AUTH = "async function getAuthenticatedUser() {\n  const supabase = getSupabaseClient();\n\n  // BAOFLIX_PERF_PHASE2A_AUTH_SESSION_GATE\n  // Chỉ cần biết local client hiện có session hay không trước khi sync.\n  // Các query custom_movies phía sau vẫn được Supabase JWT/RLS bảo vệ.\n  const {\n    data: { session },\n    error,\n  } = await supabase.auth.getSession();\n\n  if (error || !session?.user) {\n    return null;\n  }\n\n  return session.user;\n}\n"

IGNORE_MARKER = "# BAOFLIX_PERF_PHASE2A: local patch backups"
IGNORE_RULE = ".baoflix_patch_backups/"

def fail(message: str) -> None:
    raise RuntimeError(message)

def find_root(start: Path) -> Path:
    current = start.resolve()

    for candidate in [current, *current.parents]:
        if (
            (candidate / "package.json").exists()
            and (candidate / "components").exists()
            and (candidate / "lib").exists()
        ):
            return candidate

    fail(
        "Không tìm thấy repo BảoFlix. "
        "Đặt patcher trong repo hoặc dùng --root PATH."
    )

def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)

    if count != 1:
        fail(
            f"{label}: cần đúng 1 block nguồn nhưng tìm thấy {count}. "
            "Patcher dừng để tránh sửa nhầm phiên bản."
        )

    return text.replace(old, new, 1)

def append_ignore_rule(text: str) -> str:
    if IGNORE_RULE in text:
        return text

    suffix = "" if text.endswith("\n") else "\n"
    return (
        text
        + suffix
        + "\n"
        + IGNORE_MARKER
        + "\n"
        + IGNORE_RULE
    )

def build_patched_files(root: Path):
    patched = {}

    favorites_path = root / "lib/favoritesStore.ts"
    favorites = read_text(favorites_path)
    if MARKERS["lib/favoritesStore.ts"] not in favorites:
        if favorites != OLD_FAVORITES:
            fail(
                "lib/favoritesStore.ts khác source GitHub đã kiểm tra. "
                "Không thay nguyên file để tránh mất sửa đổi riêng."
            )
        favorites = NEW_FAVORITES
    patched[favorites_path] = favorites

    card_path = root / "components/MovieCard.tsx"
    card = read_text(card_path)
    if MARKERS["components/MovieCard.tsx"] not in card:
        card = replace_exact(
            card,
            OLD_MOVIECARD_IMPORT,
            NEW_MOVIECARD_IMPORT,
            "MovieCard import",
        )
        card = replace_exact(
            card,
            OLD_MOVIECARD_EFFECT,
            NEW_MOVIECARD_EFFECT,
            "MovieCard favorites effect",
        )
    patched[card_path] = card

    history_path = root / "components/WatchHistoryCloudSync.tsx"
    history = read_text(history_path)
    if MARKERS["components/WatchHistoryCloudSync.tsx"] not in history:
        history = replace_exact(
            history,
            OLD_HISTORY_AUTH,
            NEW_HISTORY_AUTH,
            "WatchHistoryCloudSync auth gate",
        )
    patched[history_path] = history

    custom_path = root / "lib/customMoviesRemote.ts"
    custom = read_text(custom_path)
    if MARKERS["lib/customMoviesRemote.ts"] not in custom:
        custom = replace_exact(
            custom,
            OLD_CUSTOM_AUTH,
            NEW_CUSTOM_AUTH,
            "customMoviesRemote auth gate",
        )
    patched[custom_path] = custom

    for relative in [Path(".gitignore"), Path(".vercelignore")]:
        path = root / relative
        patched[path] = append_ignore_rule(read_text(path))

    return patched

def snapshot_files(root: Path, paths):
    snapshot = {}

    for relative in paths:
        path = root / relative
        if path.exists():
            snapshot[relative.as_posix()] = path.read_bytes()

    return snapshot

def verify_snapshot(root: Path, snapshot, label: str) -> None:
    for relative, old_bytes in snapshot.items():
        path = root / relative

        if not path.exists():
            fail(f"{label} bị mất ngoài dự kiến: {relative}")

        if path.read_bytes() != old_bytes:
            fail(f"{label} bị thay đổi ngoài dự kiến: {relative}")

def run_build(root: Path) -> None:
    npm = "npm.cmd" if sys.platform.startswith("win") else "npm"

    print("$ npm run build")
    result = subprocess.run(
        [npm, "run", "build"],
        cwd=root,
    )

    if result.returncode != 0:
        fail("npm run build thất bại.")

def cleanup_git_backups(root: Path) -> None:
    git = shutil.which("git")

    if not git:
        print(
            "WARN: không tìm thấy git; bỏ qua bước untrack "
            ".baoflix_patch_backups."
        )
        return

    check = subprocess.run(
        [git, "rev-parse", "--is-inside-work-tree"],
        cwd=root,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    if check.returncode != 0:
        print(
            "WARN: đây không phải Git worktree; bỏ qua bước untrack backup."
        )
        return

    result = subprocess.run(
        [
            git,
            "rm",
            "-r",
            "--cached",
            "--ignore-unmatch",
            ".baoflix_patch_backups",
        ],
        cwd=root,
    )

    if result.returncode != 0:
        print(
            "WARN: git rm --cached thất bại. Code vẫn đã patch; "
            "có thể chạy thủ công:\n"
            "git rm -r --cached --ignore-unmatch .baoflix_patch_backups"
        )
    else:
        print(
            "Git cleanup OK: backup cũ đã được bỏ khỏi index; "
            "file local vẫn còn nguyên."
        )

def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "BảoFlix Performance Phase 2A: shared Favorites cache, "
            "Supabase session gate, ignore/untrack patch backups."
        )
    )
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Sau khi patch, chạy npm run build.",
    )
    parser.add_argument(
        "--skip-git-cleanup",
        action="store_true",
        help="Không chạy git rm --cached cho .baoflix_patch_backups.",
    )
    args = parser.parse_args()

    root = find_root(args.root)
    print("Repo:", root)
    print()
    print("PHASE 2A sẽ:")
    print("  1. MovieCard dùng Favorites cache/store chung.")
    print("  2. Guest không gọi getUser() mạng khi cloud sync.")
    print("  3. Giữ nguyên history/progress + custom movie sync khi đã login.")
    print("  4. Ignore .baoflix_patch_backups ở Git + Vercel.")
    print("  5. Không sửa NativeVideoPlayer/CustomDrivePlayer/TV.")
    print()

    protected_before = snapshot_files(root, PROTECTED)
    patched_files = build_patched_files(root)

    changed = [
        path for path, content in patched_files.items()
        if read_text(path) != content
    ]

    if not changed:
        print("Phase 2A đã có sẵn; không cần sửa source.")
        verify_snapshot(root, protected_before, "Playback/TV file")
        if args.check:
            run_build(root)
        if not args.skip_git_cleanup and not args.dry_run:
            cleanup_git_backups(root)
        return 0

    print("Files sẽ đổi:")
    for path in changed:
        print(" -", path.relative_to(root))

    if args.dry_run:
        print()
        print("Dry-run OK. Không file nào bị ghi.")
        verify_snapshot(root, protected_before, "Playback/TV file")
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_root = (
        root
        / ".baoflix_patch_backups"
        / f"perf_phase2a_{stamp}"
    )
    backups = {}

    try:
        for path in changed:
            relative = path.relative_to(root)
            backup = backup_root / relative
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, backup)
            backups[path] = backup

        for path in changed:
            path.write_text(
                patched_files[path],
                encoding="utf-8",
                newline="\n",
            )

        verify_snapshot(root, protected_before, "Playback/TV file")
        print()
        print("Source patch OK.")
        print("Backup:", backup_root)

        if args.check:
            run_build(root)
            verify_snapshot(root, protected_before, "Playback/TV file")
            print("Build check OK.")

    except Exception:
        print(
            "Có lỗi; đang rollback các file Phase 2A...",
            file=sys.stderr,
        )

        for path, backup in backups.items():
            if backup.exists():
                shutil.copy2(backup, path)

        try:
            verify_snapshot(root, protected_before, "Playback/TV file")
        except Exception as protected_error:
            print(
                f"CẢNH BÁO kiểm tra file bảo vệ: {protected_error}",
                file=sys.stderr,
            )

        raise

    if not args.skip_git_cleanup:
        cleanup_git_backups(root)

    print()
    print("PHASE 2A HOÀN TẤT.")
    print("Kiểm tra tiếp: git status")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"PATCH ABORTED: {exc}", file=sys.stderr)
        raise SystemExit(2)
