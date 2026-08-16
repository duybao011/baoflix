#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

TARGET = Path("components/NativeVideoPlayer.tsx")
SYNC_MARKER = "BAOFLIX_PLAYBACK_PROGRESS_SYNC"
FIX_MARKER = "const activeProgressKey = progressKey;"


class PatchError(RuntimeError):
    pass


def find_root(start: Path) -> Path:
    start = start.expanduser().resolve()
    for candidate in (start, *start.parents):
        if (candidate / "package.json").is_file() and (candidate / TARGET).is_file():
            return candidate
    raise PatchError("Không tìm thấy repo BảoFlix hoặc NativeVideoPlayer.tsx.")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0:
        raise PatchError(
            f"Không tìm thấy block: {label}. Repo local có thể đã khác phiên bản dự kiến."
        )
    if count > 1:
        raise PatchError(
            f"Block '{label}' xuất hiện {count} lần; dừng để tránh sửa nhầm."
        )
    return text.replace(old, new, 1)


def patch_text(text: str) -> str:
    if FIX_MARKER in text:
        return text

    if SYNC_MARKER not in text:
        raise PatchError(
            "NativeVideoPlayer.tsx chưa có marker playback progress sync."
        )

    old_effect_start = '''  useEffect(() => {
    if (!progressKey) return;

    function handleSyncedProgress(event: Event) {'''

    new_effect_start = '''  useEffect(() => {
    if (!progressKey) return;

    // Giữ một string đã được narrow ổn định cho callback chạy về sau.
    const activeProgressKey = progressKey;

    function handleSyncedProgress(event: Event) {'''

    text = replace_once(
        text,
        old_effect_start,
        new_effect_start,
        "đầu effect handleSyncedProgress",
    )

    old_cloud_block = '''      if (
        Array.isArray(detail?.keys) &&
        !detail.keys.includes(progressKey)
      ) {
        return;
      }

      const saved = readVideoProgress(progressKey);
      if (!saved) return;'''

    new_cloud_block = '''      if (
        Array.isArray(detail?.keys) &&
        !detail.keys.includes(activeProgressKey)
      ) {
        return;
      }

      const saved = readVideoProgress(activeProgressKey);
      if (!saved) return;'''

    text = replace_once(
        text,
        old_cloud_block,
        new_cloud_block,
        "cloud progress callback",
    )

    if FIX_MARKER not in text:
        raise PatchError("Không tìm thấy marker xác nhận sau khi vá.")

    cloud_start = text.find("function handleSyncedProgress(event: Event)")
    if cloud_start < 0:
        raise PatchError("Không xác định được callback cloud sau khi vá.")

    cloud_region = text[cloud_start:cloud_start + 3500]
    if "!detail.keys.includes(progressKey)" in cloud_region:
        raise PatchError(
            "Callback cloud vẫn còn dùng progressKey optional trong includes()."
        )

    return text


def make_backup(root: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    destination = (
        root
        / "backup"
        / f"playback-progress-typescript-v2-{stamp}"
        / TARGET
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / TARGET, destination)
    return destination.parent.parent


def atomic_write(path: Path, content: str) -> None:
    temp = path.with_name(f".{path.name}.progress-ts-v2.tmp")
    temp.write_text(content, encoding="utf-8", newline="\n")
    os.replace(temp, path)


def run_command(command: list[str], root: Path) -> bool:
    print(f"\n$ {' '.join(command)}")
    result = subprocess.run(command, cwd=root, check=False)
    return result.returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fix v2 TypeScript callback playback progress."
    )
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()

    try:
        root = find_root(args.repo)
        target = root / TARGET

        original = target.read_text(encoding="utf-8")
        patched = patch_text(original)

        print(f"Repo: {root}")
        print(f"Target: {TARGET}")

        if patched == original:
            print("Hotfix v2 đã có sẵn, không cần sửa.")
        else:
            print("Sẽ chỉ sửa callback handleSyncedProgress().")

            if args.dry_run:
                print("Dry-run OK. Chưa ghi file.")
                return 0

            backup_dir = make_backup(root)
            atomic_write(target, patched)

            print(f"Backup: {backup_dir}")
            print(
                "Đã capture progressKey thành activeProgressKey "
                "chỉ trong cloud progress callback."
            )

        if args.verify:
            lint_ok = run_command(["npm", "run", "lint"], root)
            build_ok = run_command(["npm", "run", "build"], root)

            if not lint_ok or not build_ok:
                print(
                    "\nLint/build còn lỗi khác. Gửi phần lỗi kế tiếp cho mình.",
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
