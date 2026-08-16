#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BảoFlix - hotfix cú pháp WatchHistoryCloudSync.tsx

Sửa lỗi file được tạo thành:
    \"use client\";
thay vì:
    "use client";

Script chỉ sửa:
    components/WatchHistoryCloudSync.tsx

Không đụng overlay / navigator / player.

Dùng:
    python BaoFlix_Fix_History_Sync_Syntax.py
    python BaoFlix_Fix_History_Sync_Syntax.py --dry-run
    python BaoFlix_Fix_History_Sync_Syntax.py --verify
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

TARGET = Path("components/WatchHistoryCloudSync.tsx")
MARKER = "BAOFLIX_PERSONAL_HISTORY_SYNC"


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
        "Không tìm thấy repo BảoFlix hoặc WatchHistoryCloudSync.tsx."
    )


def patch_text(text: str) -> tuple[str, int]:
    if MARKER not in text:
        raise PatchError(
            "WatchHistoryCloudSync.tsx không có marker của patch history sync; "
            "dừng để tránh sửa nhầm file."
        )

    escaped_count = text.count(r'\"')

    if escaped_count == 0:
        first = next(
            (line.strip() for line in text.splitlines() if line.strip()),
            "",
        )

        if first in {'"use client";', "'use client';"}:
            return text, 0

        raise PatchError(
            "Không còn ký tự \\\" nhưng dòng đầu cũng không phải use client; "
            "không tự đoán tiếp."
        )

    fixed = text.replace(r'\"', '"')

    if r'\"' in fixed:
        raise PatchError("Vẫn còn dấu quote bị escape sau khi sửa.")

    first = next(
        (line.strip() for line in fixed.splitlines() if line.strip()),
        "",
    )

    if first != '"use client";':
        raise PatchError(
            f"Dòng đầu sau sửa không đúng kỳ vọng: {first!r}"
        )

    return fixed, escaped_count


def backup(root: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = (
        root
        / "backup"
        / f"history-sync-syntax-{stamp}"
        / TARGET
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / TARGET, dest)
    return dest.parent.parent


def atomic_write(path: Path, content: str) -> None:
    temp = path.with_name(f".{path.name}.syntax.tmp")
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
        target = root / TARGET
        original = target.read_text(encoding="utf-8")
        fixed, count = patch_text(original)

        print(f"Repo: {root}")
        print(f"Target: {TARGET}")

        if fixed == original:
            print("File đã đúng cú pháp, không cần sửa.")
        else:
            print(f"Sẽ sửa {count} dấu quote bị escape sai.")

            if args.dry_run:
                print("Dry-run OK. Chưa ghi file.")
                return 0

            backup_dir = backup(root)
            atomic_write(target, fixed)

            print(f"Backup: {backup_dir}")
            print('Đã sửa thành: "use client"; và bỏ escape quote thừa.')

        if args.verify:
            lint_ok = run(["npm", "run", "lint"], root)
            build_ok = run(["npm", "run", "build"], root)

            if not lint_ok or not build_ok:
                print(
                    "\nLint/build chưa đạt. Gửi output lỗi tiếp cho mình.",
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
