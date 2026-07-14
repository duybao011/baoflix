#!/usr/bin/env python3
# -*- coding: utf-8 -*-

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
    "baoflix_drive_relay_public",
    "baoflix_drive_relay_public/**/*",
    "worker",
    "worker/**/*",
    "cloudflare-worker",
    "cloudflare-worker/**/*",
]

GITIGNORE_ITEMS = [
    "backup/",
    ".patch-backups/",
    "baoflix_drive_relay_public/",
    "worker/",
    "cloudflare-worker/",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Loại Cloudflare Worker khỏi Next.js TypeScript build."
    )
    parser.add_argument("--repo", type=Path)
    parser.add_argument("--skip-build", action="store_true")
    return parser.parse_args()


def find_repo_root(start: Path) -> Path:
    start = start.resolve()

    for candidate in [start, *start.parents]:
        if (
            (candidate / "package.json").is_file()
            and (candidate / "tsconfig.json").is_file()
            and (candidate / "app").is_dir()
        ):
            return candidate

    raise FileNotFoundError(
        "Không tìm thấy repo BảoFlix. Đặt file cạnh package.json "
        "hoặc dùng --repo DUONG_DAN."
    )


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError(
            f"tsconfig.json không phải JSON hợp lệ: {error}"
        ) from error


def save_json(path: Path, data: dict):
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def patch_tsconfig(path: Path) -> bool:
    config = load_json(path)
    current = config.get("exclude")

    if not isinstance(current, list):
        current = []

    output = []
    seen = set()

    for item in [*current, *EXCLUDES]:
        if not isinstance(item, str):
            continue

        value = item.strip()

        if not value or value in seen:
            continue

        seen.add(value)
        output.append(value)

    changed = output != current
    config["exclude"] = output
    save_json(path, config)

    return changed


def patch_gitignore(path: Path) -> bool:
    existing = (
        path.read_text(encoding="utf-8").replace("\r\n", "\n")
        if path.exists()
        else ""
    )

    lines = existing.splitlines()
    normalized = {line.strip() for line in lines}
    additions = [
        item for item in GITIGNORE_ITEMS
        if item not in normalized
    ]

    if not additions:
        return False

    if lines and lines[-1].strip():
        lines.append("")

    lines.append("# Local workers and patch backups")
    lines.extend(additions)

    path.write_text(
        "\n".join(lines).rstrip() + "\n",
        encoding="utf-8",
    )

    return True


def get_npm_command():
    return "npm.cmd" if os.name == "nt" else "npm"


def run_build(repo_root: Path):
    command = [get_npm_command(), "run", "build"]

    print("\n> " + " ".join(command))

    result = subprocess.run(command, cwd=repo_root)

    if result.returncode != 0:
        raise RuntimeError(
            f"Build vẫn thất bại với mã {result.returncode}. "
            "Hãy gửi lỗi mới vì Worker đã được loại khỏi Next build."
        )


def main():
    args = parse_args()

    try:
        repo_root = find_repo_root(args.repo or Path.cwd())
    except Exception as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1

    tsconfig = repo_root / "tsconfig.json"
    gitignore = repo_root / ".gitignore"
    next_cache = repo_root / ".next"

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = (
        repo_root
        / "backup"
        / f"exclude-worker-fix-{timestamp}"
    )
    backup_root.mkdir(parents=True, exist_ok=True)

    try:
        shutil.copy2(
            tsconfig,
            backup_root / "tsconfig.json",
        )

        if gitignore.exists():
            shutil.copy2(
                gitignore,
                backup_root / ".gitignore",
            )

        if patch_tsconfig(tsconfig):
            print("✓ Đã loại Worker/relay khỏi tsconfig build")
        else:
            print("✓ Worker/relay đã nằm trong tsconfig exclude")

        if patch_gitignore(gitignore):
            print("✓ Đã thêm Worker/relay vào .gitignore")
        else:
            print("✓ .gitignore đã bỏ qua Worker/relay")

        if next_cache.exists():
            shutil.rmtree(next_cache, ignore_errors=True)
            print("✓ Đã xóa cache .next")

        print(f"✓ Backup: {backup_root}")

        if not args.skip_build:
            run_build(repo_root)
            print("✓ Build Next.js thành công")
        else:
            print("! Đã bỏ qua build")

        print(
            "\nHOÀN TẤT.\n"
            "Cloudflare Worker vẫn còn nguyên để deploy riêng, "
            "nhưng Next.js sẽ không type-check nó nữa.\n"
            "Script không commit hoặc push GitHub."
        )

        return 0

    except Exception as error:
        print(f"\nLỖI: {error}", file=sys.stderr)
        print(f"Backup: {backup_root}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
