#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

BACKUP_GLOB = "perf_phase2b_image_*"
HELPER = Path("components") / "MoviePosterImage.tsx"
HELPER_MARKER = "BAOFLIX_PERF_PHASE2B_SMART_IMAGE"

PROTECTED = [
    Path("components") / "NativeVideoPlayer.tsx",
    Path("components") / "CustomDrivePlayer.tsx",
    Path("components") / "TvRemoteNavigator.tsx",
    Path("components") / "TvWatchOverlay.tsx",
    Path("components") / "TvPlayerCommandBridge.tsx",
    Path("components") / "WatchHistoryCloudSync.tsx",
    Path("lib") / "customMoviesRemote.ts",
    Path("lib") / "favoritesStore.ts",
]

def fail(message: str) -> None:
    raise RuntimeError(message)

def find_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (
            (candidate / "package.json").exists()
            and (candidate / "components").exists()
            and (candidate / ".baoflix_patch_backups").exists()
        ):
            return candidate
    fail(
        "Không tìm thấy repo BảoFlix hoặc thư mục .baoflix_patch_backups."
    )

def latest_backup(root: Path) -> Path:
    backup_root = root / ".baoflix_patch_backups"
    matches = [
        path for path in backup_root.glob(BACKUP_GLOB)
        if path.is_dir()
    ]
    if not matches:
        fail(
            "Không tìm thấy backup Phase 2B dạng "
            ".baoflix_patch_backups/perf_phase2b_image_*"
        )
    return max(matches, key=lambda p: p.name)

def snapshot(root: Path, paths):
    result = {}
    for relative in paths:
        path = root / relative
        if path.exists():
            result[relative.as_posix()] = path.read_bytes()
    return result

def verify_snapshot(root: Path, before, label: str) -> None:
    for relative, old_bytes in before.items():
        path = root / relative
        if not path.exists():
            fail(f"{label} bị mất: {relative}")
        if path.read_bytes() != old_bytes:
            fail(f"{label} bị thay đổi ngoài dự kiến: {relative}")

def run_build(root: Path) -> None:
    npm = "npm.cmd" if sys.platform.startswith("win") else "npm"
    print("$ npm run build")
    result = subprocess.run([npm, "run", "build"], cwd=root)
    if result.returncode != 0:
        fail("npm run build thất bại sau rollback.")

def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Rollback riêng BảoFlix Performance Phase 2B Smart Images. "
            "Không đụng V3/Phase2A/TV/Drive."
        )
    )
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    root = find_root(args.root)
    backup = latest_backup(root)

    print("Repo   :", root)
    print("Backup :", backup)
    print()
    print("ROLLBACK PHASE 2B sẽ:")
    print(" - restore next.config.ts")
    print(" - restore MovieCard.tsx")
    print(" - restore CompactMovieCard.tsx")
    print(" - restore ContinueWatching.tsx")
    print(" - xóa MoviePosterImage.tsx nếu đúng file Phase 2B")
    print(" - giữ nguyên V3 / Phase 2A / TV / Drive")

    protected_before = snapshot(root, PROTECTED)

    restore_files = []
    for backup_file in backup.rglob("*"):
        if backup_file.is_file():
            relative = backup_file.relative_to(backup)
            restore_files.append((backup_file, root / relative))

    if not restore_files:
        fail("Backup Phase 2B không có file nào để restore.")

    helper_path = root / HELPER
    delete_helper = False
    if helper_path.exists():
        content = helper_path.read_text(encoding="utf-8")
        if HELPER_MARKER in content:
            delete_helper = True
        else:
            fail(
                "MoviePosterImage.tsx tồn tại nhưng không có marker Phase 2B. "
                "Dừng để tránh xóa file riêng."
            )

    print()
    print("Files restore:")
    for src, dst in restore_files:
        print(" -", dst.relative_to(root))

    if delete_helper:
        print(" - DELETE", HELPER)

    if args.dry_run:
        verify_snapshot(root, protected_before, "Protected file")
        print()
        print("Dry-run OK. Chưa thay đổi file nào.")
        return 0

    # Backup trạng thái hiện tại trước rollback để có thể hoàn tác rollback nếu cần.
    rollback_backup = (
        root
        / ".baoflix_patch_backups"
        / "rollback_phase2b_current_state"
    )
    if rollback_backup.exists():
        shutil.rmtree(rollback_backup)

    try:
        for _, dst in restore_files:
            if dst.exists():
                rb = rollback_backup / dst.relative_to(root)
                rb.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(dst, rb)

        if delete_helper and helper_path.exists():
            rb = rollback_backup / HELPER
            rb.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(helper_path, rb)

        for src, dst in restore_files:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

        if delete_helper and helper_path.exists():
            helper_path.unlink()

        verify_snapshot(root, protected_before, "Protected file")

        print()
        print("Rollback source OK.")

        if args.check:
            run_build(root)
            verify_snapshot(root, protected_before, "Protected file")
            print("Build check OK.")

        print()
        print("PHASE 2B ĐÃ ĐƯỢC HOÀN TÁC.")
        print("Chạy tiếp: git status")
        return 0

    except Exception:
        print(
            "Rollback gặp lỗi; đang khôi phục trạng thái trước rollback...",
            file=sys.stderr,
        )

        for path in rollback_backup.rglob("*"):
            if path.is_file():
                relative = path.relative_to(rollback_backup)
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, target)

        try:
            verify_snapshot(root, protected_before, "Protected file")
        except Exception as exc:
            print(
                f"CẢNH BÁO kiểm tra protected file: {exc}",
                file=sys.stderr,
            )
        raise

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ROLLBACK ABORTED: {exc}", file=sys.stderr)
        raise SystemExit(2)
