#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import datetime as dt
import shutil
import subprocess
import sys
from pathlib import Path

MARKER = "BAOFLIX_PERF_PHASE2B_SMART_IMAGE"

TARGETS = [
    Path("next.config.ts"),
    Path("components/MovieCard.tsx"),
    Path("components/CompactMovieCard.tsx"),
    Path("components/ContinueWatching.tsx"),
]

HELPER_PATH = Path("components/MoviePosterImage.tsx")

PROTECTED = [
    Path("components/NativeVideoPlayer.tsx"),
    Path("components/CustomDrivePlayer.tsx"),
    Path("components/TvRemoteNavigator.tsx"),
    Path("components/TvWatchOverlay.tsx"),
    Path("components/TvPlayerCommandBridge.tsx"),
    Path("components/WatchHistoryCloudSync.tsx"),
    Path("lib/customMoviesRemote.ts"),
]

HELPER = "\"use client\";\n\nimport Image from \"next/image\";\nimport { useEffect, useState } from \"react\";\n\ntype MoviePosterImageProps = {\n  src: string;\n  alt: string;\n  className?: string;\n  sizes?: string;\n  priority?: boolean;\n};\n\nconst PLACEHOLDER_IMAGE = \"/placeholder.svg\";\n\n// BAOFLIX_PERF_PHASE2B_SMART_IMAGE\n// Chỉ đưa ảnh KKPhim/phimimg qua Next Image Optimizer.\n// Ảnh phim riêng hoặc domain tự nhập vẫn dùng <img> thường để không\n// làm hỏng các nguồn custom chưa khai báo trong next.config.\nfunction canUseNextImage(src: string) {\n  const value = String(src || \"\").trim();\n\n  if (!value) return false;\n\n  if (value.startsWith(\"/\")) {\n    return !value.toLowerCase().endsWith(\".svg\");\n  }\n\n  try {\n    const url = new URL(value);\n    const hostname = url.hostname.toLowerCase();\n\n    return (\n      url.protocol === \"https:\" &&\n      (\n        hostname === \"phimimg.com\" ||\n        hostname.endsWith(\".phimimg.com\")\n      )\n    );\n  } catch {\n    return false;\n  }\n}\n\nexport default function MoviePosterImage({\n  src,\n  alt,\n  className = \"\",\n  sizes = \"(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 20vw, 220px\",\n  priority = false,\n}: MoviePosterImageProps) {\n  const [failed, setFailed] = useState(false);\n\n  useEffect(() => {\n    setFailed(false);\n  }, [src]);\n\n  const safeSrc = String(src || \"\").trim() || PLACEHOLDER_IMAGE;\n\n  if (failed || !canUseNextImage(safeSrc)) {\n    return (\n      <img\n        src={failed ? PLACEHOLDER_IMAGE : safeSrc}\n        alt={alt}\n        className={className}\n        loading={priority ? \"eager\" : \"lazy\"}\n        decoding=\"async\"\n        fetchPriority={priority ? \"high\" : \"auto\"}\n        onError={\n          failed\n            ? undefined\n            : () => setFailed(true)\n        }\n      />\n    );\n  }\n\n  return (\n    <Image\n      src={safeSrc}\n      alt={alt}\n      fill\n      sizes={sizes}\n      priority={priority}\n      className={className}\n      onError={() => setFailed(true)}\n    />\n  );\n}\n"
NEXT_CONFIG_OLD = "import type { NextConfig } from \"next\";\n\nconst nextConfig: NextConfig = {\n  /* config options here */\n};\n\nexport default nextConfig;\n"
NEXT_CONFIG_NEW = "import type { NextConfig } from \"next\";\n\nconst nextConfig: NextConfig = {\n  // BAOFLIX_PERF_PHASE2B_SMART_IMAGE\n  // Chỉ whitelist CDN ảnh phim công khai. Ảnh custom/domain lạ\n  // vẫn dùng <img> thường qua MoviePosterImage.\n  images: {\n    remotePatterns: [\n      {\n        protocol: \"https\",\n        hostname: \"phimimg.com\",\n        pathname: \"/**\",\n      },\n      {\n        protocol: \"https\",\n        hostname: \"**.phimimg.com\",\n        pathname: \"/**\",\n      },\n    ],\n  },\n};\n\nexport default nextConfig;\n"
MOVIECARD_IMPORT_ANCHOR = "import Link from \"next/link\";\n"
MOVIECARD_IMPORT_NEW = "import Link from \"next/link\";\nimport MoviePosterImage from \"@/components/MoviePosterImage\";\n"
MOVIECARD_IMG_OLD = "          <img\n            src={getCardImageUrl(movie.poster_url || movie.thumb_url)}\n            alt={movie.name}\n            className=\"h-full w-full object-cover transition duration-200 group-hover:scale-[1.035] group-focus-visible:scale-[1.035]\"\n            loading=\"lazy\"\n            decoding=\"async\"\n            onError={handleImageError}\n          />\n"
MOVIECARD_IMG_NEW = "          <MoviePosterImage\n            src={getCardImageUrl(movie.poster_url || movie.thumb_url)}\n            alt={movie.name}\n            className=\"h-full w-full object-cover transition duration-200 group-hover:scale-[1.035] group-focus-visible:scale-[1.035]\"\n            sizes=\"(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 20vw, (max-width: 1280px) 14vw, 220px\"\n          />\n"
MOVIECARD_ERROR_HANDLER = "  function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {\n    const image = event.currentTarget;\n\n    if (image.src.endsWith(PLACEHOLDER_IMAGE)) return;\n\n    image.src = PLACEHOLDER_IMAGE;\n  }\n\n"
COMPACT_IMPORT_ANCHOR = "import Link from \"next/link\";\n"
COMPACT_IMPORT_NEW = "import Link from \"next/link\";\nimport MoviePosterImage from \"@/components/MoviePosterImage\";\n"
COMPACT_IMG_OLD = "          <img\n            src={getImageUrl(image)}\n            alt={title}\n            className=\"h-full w-full object-cover transition duration-200 group-hover:scale-[1.025] group-focus-within:scale-[1.025]\"\n            loading=\"lazy\"\n            decoding=\"async\"\n          />\n"
COMPACT_IMG_NEW = "          <MoviePosterImage\n            src={getImageUrl(image)}\n            alt={title}\n            className=\"h-full w-full object-cover transition duration-200 group-hover:scale-[1.025] group-focus-within:scale-[1.025]\"\n            sizes=\"(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px\"\n          />\n"
CONTINUE_IMPORT_ANCHOR = "import Link from \"next/link\";\n"
CONTINUE_IMPORT_NEW = "import Link from \"next/link\";\nimport MoviePosterImage from \"@/components/MoviePosterImage\";\n"
CONTINUE_IMG_OLD = "              <img\n                src={getImageUrl(firstItem.poster_url || firstItem.thumb_url)}\n                alt={firstItem.name}\n                className=\"aspect-[2/3] w-full object-cover transition group-hover:scale-105\"\n                loading=\"lazy\"\n              />\n"
CONTINUE_IMG_NEW = "              <div className=\"relative aspect-[2/3] w-full\">\n                <MoviePosterImage\n                  src={getImageUrl(firstItem.poster_url || firstItem.thumb_url)}\n                  alt={firstItem.name}\n                  className=\"h-full w-full object-cover transition group-hover:scale-105\"\n                  sizes=\"(max-width: 640px) 120px, (max-width: 1280px) 280px, 140px\"\n                />\n              </div>\n"

def fail(message: str) -> None:
    raise RuntimeError(message)

def find_root(start: Path) -> Path:
    current = start.resolve()

    for candidate in [current, *current.parents]:
        if (
            (candidate / "package.json").exists()
            and (candidate / "next.config.ts").exists()
            and (candidate / "components").exists()
        ):
            return candidate

    fail(
        "Không tìm thấy repo BảoFlix. "
        "Đặt patcher trong repo hoặc dùng --root PATH."
    )

def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(
            f"{label}: cần đúng 1 block nguồn nhưng thấy {count}. "
            "Dừng để tránh sửa nhầm source."
        )
    return text.replace(old, new, 1)

def add_import_once(text: str, anchor: str, replacement: str, label: str) -> str:
    if 'MoviePosterImage from "@/components/MoviePosterImage"' in text:
        return text
    return replace_once(text, anchor, replacement, label)

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
        fail("npm run build thất bại.")

def build_changes(root: Path):
    changes = {}

    helper_path = root / HELPER_PATH
    if helper_path.exists():
        helper_text = read_text(helper_path)
        if MARKER not in helper_text:
            fail(
                "components/MoviePosterImage.tsx đã tồn tại nhưng không phải "
                "bản Phase 2B. Dừng để tránh ghi đè file riêng."
            )
    else:
        changes[helper_path] = HELPER

    config_path = root / "next.config.ts"
    config = read_text(config_path)
    if MARKER not in config:
        if config != NEXT_CONFIG_OLD:
            fail(
                "next.config.ts khác bản GitHub đã kiểm tra. "
                "Dừng để không ghi đè config riêng."
            )
        config = NEXT_CONFIG_NEW
        changes[config_path] = config

    card_path = root / "components/MovieCard.tsx"
    card = read_text(card_path)
    if "MoviePosterImage" not in card:
        card = add_import_once(
            card,
            MOVIECARD_IMPORT_ANCHOR,
            MOVIECARD_IMPORT_NEW,
            "MovieCard import",
        )
        card = replace_once(
            card,
            MOVIECARD_IMG_OLD,
            MOVIECARD_IMG_NEW,
            "MovieCard poster",
        )
        if MOVIECARD_ERROR_HANDLER in card:
            card = card.replace(MOVIECARD_ERROR_HANDLER, "", 1)
        changes[card_path] = card

    compact_path = root / "components/CompactMovieCard.tsx"
    compact = read_text(compact_path)
    if "MoviePosterImage" not in compact:
        compact = add_import_once(
            compact,
            COMPACT_IMPORT_ANCHOR,
            COMPACT_IMPORT_NEW,
            "CompactMovieCard import",
        )
        compact = replace_once(
            compact,
            COMPACT_IMG_OLD,
            COMPACT_IMG_NEW,
            "CompactMovieCard poster",
        )
        changes[compact_path] = compact

    continue_path = root / "components/ContinueWatching.tsx"
    cont = read_text(continue_path)
    if "MoviePosterImage" not in cont:
        cont = add_import_once(
            cont,
            CONTINUE_IMPORT_ANCHOR,
            CONTINUE_IMPORT_NEW,
            "ContinueWatching import",
        )
        cont = replace_once(
            cont,
            CONTINUE_IMG_OLD,
            CONTINUE_IMG_NEW,
            "ContinueWatching main poster",
        )
        changes[continue_path] = cont

    return changes

def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "BảoFlix Performance Phase 2B: smart Next/Image "
            "cho poster KKPhim, giữ fallback <img> cho nguồn custom."
        )
    )
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    root = find_root(args.root)
    print("Repo:", root)
    print()
    print("PHASE 2B:")
    print(" - phimimg.com -> next/image resize + lazy + modern format")
    print(" - custom/external image -> giữ <img> thường")
    print(" - MovieCard + CompactMovieCard + Xem tiếp")
    print(" - chưa đụng hero trang chủ")
    print(" - không sửa playback / Drive / TV / cloud sync")
    print()

    protected_before = snapshot(root, PROTECTED)
    changes = build_changes(root)

    if not changes:
        print("Phase 2B đã có sẵn; không cần sửa source.")
        verify_snapshot(root, protected_before, "Protected file")
        if args.check:
            run_build(root)
        return 0

    print("Files sẽ tạo/sửa:")
    for path in changes:
        action = "CREATE" if not path.exists() else "UPDATE"
        print(f" - {action} {path.relative_to(root)}")

    if args.dry_run:
        verify_snapshot(root, protected_before, "Protected file")
        print()
        print("Dry-run OK. Không file nào bị ghi.")
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_root = (
        root
        / ".baoflix_patch_backups"
        / f"perf_phase2b_image_{stamp}"
    )

    backups = {}
    created = []

    try:
        for path, content in changes.items():
            if path.exists():
                relative = path.relative_to(root)
                backup = backup_root / relative
                backup.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, backup)
                backups[path] = backup
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                created.append(path)

            path.write_text(
                content,
                encoding="utf-8",
                newline="\n",
            )

        verify_snapshot(root, protected_before, "Protected file")
        print()
        print("Source patch OK.")
        print("Backup:", backup_root)

        if args.check:
            run_build(root)
            verify_snapshot(root, protected_before, "Protected file")
            print("Build check OK.")

    except Exception:
        print("Có lỗi; rollback Phase 2B...", file=sys.stderr)

        for path in created:
            if path.exists():
                path.unlink()

        for path, backup in backups.items():
            if backup.exists():
                shutil.copy2(backup, path)

        try:
            verify_snapshot(root, protected_before, "Protected file")
        except Exception as protected_error:
            print(
                f"CẢNH BÁO protected file: {protected_error}",
                file=sys.stderr,
            )

        raise

    print()
    print("PHASE 2B HOÀN TẤT.")
    print("Test UI rồi chạy: git status")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"PATCH ABORTED: {exc}", file=sys.stderr)
        raise SystemExit(2)
