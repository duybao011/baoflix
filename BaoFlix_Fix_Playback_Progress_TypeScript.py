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
MARKER = "BAOFLIX_PLAYBACK_PROGRESS_SYNC"
FIX_MARKER = "activeProgressKey = progressKey"


class PatchError(RuntimeError):
    pass


def find_root(start: Path) -> Path:
    start = start.expanduser().resolve()

    for candidate in (start, *start.parents):
        if (
            (candidate / "package.json").is_file()
            and (candidate / TARGET).is_file()
        ):
            return candidate

    raise PatchError(
        "Không tìm thấy repo BảoFlix hoặc components/NativeVideoPlayer.tsx."
    )


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)

    if count == 0:
        raise PatchError(
            f"Không tìm thấy đoạn cần sửa: {label}. "
            "Repo local có thể đã khác bản patch hiện tại."
        )

    if count > 1:
        raise PatchError(
            f"Đoạn '{label}' xuất hiện {count} lần; dừng để tránh sửa nhầm."
        )

    return text.replace(old, new, 1)


def patch_text(text: str) -> str:
    if FIX_MARKER in text:
        return text

    if MARKER not in text:
        raise PatchError(
            "NativeVideoPlayer.tsx chưa có marker playback progress sync."
        )

    text = replace_once(
        text,
        '''  useEffect(() => {
    if (!progressKey) return;

    function handleSyncedProgress(event: Event) {''',
        '''  useEffect(() => {
    if (!progressKey) return;

    // Capture giá trị đã được narrow vào const ổn định cho callback.
    const activeProgressKey = progressKey;

    function handleSyncedProgress(event: Event) {''',
        "capture progressKey",
    )

    text = replace_once(
        text,
        "!detail.keys.includes(progressKey)",
        "!detail.keys.includes(activeProgressKey)",
        "includes active progress key",
    )

    text = replace_once(
        text,
        "const saved = readVideoProgress(progressKey);",
        "const saved = readVideoProgress(activeProgressKey);",
        "read synced progress key",
    )

    if FIX_MARKER not in text:
        raise PatchError("Không tìm thấy marker xác nhận sau khi vá.")

    return text


def make_backup(root: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    destination = (
        root
        / "backup"
        / f"playback-progress-typescript-{stamp}"
        / TARGET
    )

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / TARGET, destination)
    return destination.parent.parent


def atomic_write(path: Path, content: str) -> None:
    temp = path.with_name(f".{path.name}.progress-ts.tmp")
    temp.write_text(content, encoding="utf-8", newline="\n")
    os.replace(temp, path)


def run_command(command: list[str], root: Path) -> bool:
    print(f"\n$ {' '.join(command)}")
    result = subprocess.run(command, cwd=root, check=False)
    return result.returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fix TypeScript narrowing cho BảoFlix playback progress sync."
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
            print("Hotfix TypeScript đã có sẵn, không cần sửa.")
        else:
            print("Sẽ capture progressKey thành activeProgressKey cho callback.")

            if args.dry_run:
                print("Dry-run OK. Chưa ghi file.")
                return 0

            backup_dir = make_backup(root)
            atomic_write(target, patched)

            print(f"Backup: {backup_dir}")
            print("Đã sửa lỗi string | undefined trong callback.")

        if args.verify:
            lint_ok = run_command(["npm", "run", "lint"], root)
            build_ok = run_command(["npm", "run", "build"], root)

            if not lint_ok or not build_ok:
                print(
                    "\nLint/build vẫn còn lỗi khác. Gửi phần lỗi kế tiếp cho mình.",
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
