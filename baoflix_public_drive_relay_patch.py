#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# BảoFlix Public Drive Relay Web Patcher
# Chạy trong repo BảoFlix:
#   python baoflix_public_drive_relay_patch.py

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path)
    parser.add_argument("--relay-url")
    parser.add_argument("--skip-build", action="store_true")
    return parser.parse_args()


def find_root(start: Path) -> Path:
    start = start.resolve()

    for candidate in [start, *start.parents]:
        target = (
            candidate
            / "components"
            / "CustomDrivePlayer.tsx"
        )

        if (
            (candidate / "package.json").is_file()
            and target.is_file()
        ):
            return candidate

    raise FileNotFoundError(
        "Không tìm thấy repo BảoFlix. Đặt file cạnh "
        "package.json hoặc dùng --repo DUONG_DAN."
    )


def normalize_url(value: str) -> str:
    url = value.strip().rstrip("/")

    if not url.startswith(("https://", "http://")):
        raise ValueError(
            "Worker URL phải bắt đầu bằng https:// hoặc http://"
        )

    return url


def update_env(path: Path, relay_url: str):
    key = "NEXT_PUBLIC_DRIVE_RELAY_URL"
    lines = (
        path.read_text(encoding="utf-8")
        .replace("\r\n", "\n")
        .splitlines()
        if path.exists()
        else []
    )

    output = []
    found = False

    for line in lines:
        if line.strip().startswith(f"{key}="):
            output.append(f"{key}={relay_url}")
            found = True
        else:
            output.append(line)

    if not found:
        if output and output[-1].strip():
            output.append("")

        output.append(f"{key}={relay_url}")

    path.write_text(
        "\n".join(output).rstrip() + "\n",
        encoding="utf-8",
    )


def patch_player(text: str) -> str:
    pattern = re.compile(
        r"function buildDirectCandidates"
        r"\(fileId: string\) \{.*?\n\}",
        re.DOTALL,
    )

    replacement = '''function buildDirectCandidates(fileId: string) {
  const relayBase = String(
    process.env.NEXT_PUBLIC_DRIVE_RELAY_URL || ""
  )
    .trim()
    .replace(/\\/+$/, "");

  if (!fileId || !relayBase) return [];

  return [
    `${relayBase}/video/${encodeURIComponent(fileId)}`,
  ];
}'''

    if not pattern.search(text):
        if "NEXT_PUBLIC_DRIVE_RELAY_URL" in text:
            return text

        raise RuntimeError(
            "Không tìm thấy buildDirectCandidates trong "
            "CustomDrivePlayer.tsx."
        )

    text = pattern.sub(replacement, text, count=1)

    text = text.replace(
        "Drive không cho phát trực tiếp bằng video native. "
        "Đã chuyển sang iframe dự phòng.",
        "Drive Relay không trả về video native. "
        "Đã chuyển sang iframe dự phòng.",
    )

    if "NEXT_PUBLIC_DRIVE_RELAY_URL" not in text:
        raise RuntimeError("Patch relay chưa được áp dụng.")

    return text


def npm_command():
    return "npm.cmd" if os.name == "nt" else "npm"


def run_build(root: Path):
    result = subprocess.run(
        [npm_command(), "run", "build"],
        cwd=root,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Build thất bại với mã {result.returncode}."
        )


def main():
    args = parse_args()

    try:
        root = find_root(args.repo or Path.cwd())
        relay_url = normalize_url(
            args.relay_url
            or input(
                "Dán URL Worker, ví dụ "
                "https://baoflix-drive-relay."
                "tenban.workers.dev: "
            )
        )
    except Exception as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1

    player = (
        root
        / "components"
        / "CustomDrivePlayer.tsx"
    )
    env_file = root / ".env.local"

    timestamp = datetime.now().strftime(
        "%Y%m%d-%H%M%S"
    )
    backup_root = (
        root
        / "backup"
        / f"public-drive-relay-{timestamp}"
    )

    try:
        for path in (player, env_file):
            if not path.exists():
                continue

            destination = (
                backup_root
                / path.relative_to(root)
            )
            destination.parent.mkdir(
                parents=True,
                exist_ok=True,
            )
            shutil.copy2(path, destination)

        update_env(env_file, relay_url)

        player.write_text(
            patch_player(
                player.read_text(encoding="utf-8")
            ).rstrip()
            + "\n",
            encoding="utf-8",
        )

        next_cache = root / ".next"

        if next_cache.exists():
            shutil.rmtree(
                next_cache,
                ignore_errors=True,
            )

        print(f"✓ Relay URL: {relay_url}")
        print("✓ Đã cập nhật .env.local")
        print(
            "✓ Đã chuyển CustomDrivePlayer "
            "sang Cloudflare relay"
        )
        print(f"✓ Backup: {backup_root}")

        if not args.skip_build:
            run_build(root)
            print("✓ Build thành công")

        print(
            "\nVercel Environment Variable:\n"
            f"NEXT_PUBLIC_DRIVE_RELAY_URL={relay_url}\n"
            "Sau đó Redeploy."
        )
        return 0

    except Exception as error:
        print(f"\nLỖI: {error}", file=sys.stderr)
        print(
            f"Backup: {backup_root}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
