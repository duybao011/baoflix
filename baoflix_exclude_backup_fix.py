#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix BảoFlix build scanning backup folders.

Chạy trong thư mục gốc repo:
    python baoflix_exclude_backup_fix.py

Script sẽ:
- Thêm backup vào exclude của tsconfig.json.
- Thêm backup/ vào .gitignore.
- Xóa cache .next cũ.
- Chạy npm run build.
- Không commit hoặc push GitHub.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


EXCLUDES = [
    "node_modules",
    "backup",
    "backup/**/*",
    ".patch-backups",
    ".patch-backups/**/*",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Loại thư mục backup khỏi TypeScript/Next.js build."
    )
    parser.add_argument(
        "--repo",
        type=Path,
        help="Đường dẫn repo BảoFlix. Mặc định tự dò từ thư mục hiện tại.",
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
            and (candidate / "tsconfig.json").is_file()
        ):
            return candidate

    raise FileNotFoundError(
        "Không tìm thấy repo BảoFlix. Hãy đặt file Python cạnh package.json "
        "hoặc dùng --repo DUONG_DAN."
    )


def load_tsconfig(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError(
            f"tsconfig.json không phải JSON hợp lệ: {error}"
        ) from error


def save_tsconfig(path: Path, data: dict) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def update_gitignore(path: Path) -> bool:
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    lines = existing.replace("\r\n", "\n").splitlines()

    normalized = {line.strip() for line in lines}
    additions = []

    for item in ("backup/", ".patch-backups/"):
        if item not in normalized:
            additions.append(item)

    if not additions:
        return False

    if lines and lines[-1].strip():
        lines.append("")

    lines.append("# Local patch backups")
    lines.extend(additions)

    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    return True


def get_npm_command() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def run_build(repo_root: Path) -> None:
    command = [get_npm_command(), "run", "build"]
    print("\n> " + " ".join(command))

    result = subprocess.run(command, cwd=repo_root)

    if result.returncode != 0:
        raise RuntimeError(
            f"Build vẫn thất bại với mã {result.returncode}. "
            "Lỗi backup đã được loại; hãy gửi lỗi mới nếu còn."
        )


def main() -> int:
    args = parse_args()

    try:
        repo_root = find_repo_root(args.repo or Path.cwd())
    except Exception as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1

    tsconfig_path = repo_root / "tsconfig.json"
    gitignore_path = repo_root / ".gitignore"
    next_path = repo_root / ".next"

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    tsconfig_backup = repo_root / f"tsconfig.json.before-backup-exclude-{timestamp}.bak"

    try:
        shutil.copy2(tsconfig_path, tsconfig_backup)

        config = load_tsconfig(tsconfig_path)
        old_exclude = config.get("exclude")

        if not isinstance(old_exclude, list):
            old_exclude = []

        next_exclude = []
        seen = set()

        for item in [*old_exclude, *EXCLUDES]:
            if not isinstance(item, str):
                continue

            value = item.strip()
            if not value or value in seen:
                continue

            seen.add(value)
            next_exclude.append(value)

        config["exclude"] = next_exclude
        save_tsconfig(tsconfig_path, config)

        print("✓ Đã loại backup khỏi TypeScript:")
        for item in next_exclude:
            print(f"  - {item}")

        if update_gitignore(gitignore_path):
            print("✓ Đã thêm backup/ vào .gitignore")
        else:
            print("✓ .gitignore đã bỏ qua backup")

        if next_path.exists():
            shutil.rmtree(next_path, ignore_errors=True)
            print("✓ Đã xóa cache .next cũ")

        print(f"✓ Backup tsconfig: {tsconfig_backup.name}")

        if not args.skip_build:
            run_build(repo_root)
            print("✓ Build thành công")
        else:
            print("! Đã bỏ qua build")

        print(
            "\nHOÀN TẤT.\n"
            "Từ giờ các file .ts/.tsx trong backup/ sẽ không còn bị Next.js "
            "type-check.\n"
            "Script không commit hoặc push GitHub."
        )
        return 0

    except Exception as error:
        print(f"\nLỖI: {error}", file=sys.stderr)
        print(
            f"Có thể khôi phục tsconfig từ: {tsconfig_backup}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
