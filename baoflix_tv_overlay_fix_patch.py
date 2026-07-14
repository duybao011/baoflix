#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BảoFlix TV Overlay Fix Patcher

Chạy trong thư mục gốc repo BảoFlix:
    python baoflix_tv_overlay_fix_patch.py

Script sẽ:
1. Tìm repo từ thư mục hiện tại.
2. Backup components/TvWatchOverlay.tsx.
3. Thêm nút "Cài đặt" vào overlay TV khi đang xem phim.
4. Sửa lỗi chọn nhóm tập 25-48, 49-72... bị tự nhảy về nhóm chứa tập hiện tại.
5. Kiểm tra patch và chạy npm run build.

Có thể chạy lại nhiều lần; script không chèn trùng.
Script chỉ sửa file trên máy, không commit/push GitHub.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


OLD_CHUNK_EFFECT = '  useEffect(() => {\n    if (overlayMode !== "panel" || overlayPanel !== "episodes") return;\n\n    if (safeChunkIndex !== currentChunkIndex) {\n      pendingCurrentEpisodeFocusRef.current = true;\n      setActiveChunkIndex(currentChunkIndex);\n      return;\n    }\n\n    if (pendingCurrentEpisodeFocusRef.current) {\n      focusCurrentEpisodeSoon();\n    }\n  }, [overlayMode, overlayPanel, safeChunkIndex, currentChunkIndex, safeEpisodeIndex, episodeItems.length]);'
NEW_CHUNK_EFFECT = '  useEffect(() => {\n    if (overlayMode !== "panel" || overlayPanel !== "episodes") return;\n\n    // Chỉ tự đưa focus về tập đang xem khi chính overlay đang yêu cầu.\n    // Khi người dùng chọn nhóm 25-48, 49-72..., pending đã được tắt nên\n    // không được ép activeChunkIndex quay lại currentChunkIndex.\n    if (!pendingCurrentEpisodeFocusRef.current) return;\n\n    if (safeChunkIndex !== currentChunkIndex) {\n      setActiveChunkIndex(currentChunkIndex);\n      return;\n    }\n\n    focusCurrentEpisodeSoon();\n  }, [\n    overlayMode,\n    overlayPanel,\n    safeChunkIndex,\n    currentChunkIndex,\n    safeEpisodeIndex,\n    episodeItems.length,\n  ]);'
PLAYER_BUTTON = '              <button\n                type="button"\n                data-tv-focus-key="overlay:player"\n                {...hiddenFocusProps}\n                onClick={handleFocusPlayer}\n                className={[\n                  "flex min-h-[40px] items-center justify-center rounded-2xl px-3 text-[11px] font-black min-[1280px]:min-h-[44px] min-[1280px]:text-[12px]",\n                  SURFACE_BUTTON_CLASS,\n                  TV_FOCUS_CLASS,\n                ].join(" ")}\n              >\n                Player\n              </button>'
SETTINGS_BUTTON = '              <Link\n                href="/cai-dat?tv=1"\n                data-tv-focus-key="overlay:settings"\n                {...hiddenFocusProps}\n                className={[\n                  "flex min-h-[40px] items-center justify-center rounded-2xl px-3 text-[11px] font-black min-[1280px]:min-h-[44px] min-[1280px]:text-[12px]",\n                  SURFACE_BUTTON_CLASS,\n                  TV_FOCUS_CLASS,\n                ].join(" ")}\n              >\n                Cài đặt\n              </Link>'


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Thêm nút Cài đặt và sửa lỗi phân nhóm tập trong TV overlay."
    )
    parser.add_argument(
        "--repo",
        type=Path,
        help="Đường dẫn repo BảoFlix. Mặc định tự dò từ thư mục hiện tại.",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Không chạy npm run build sau khi patch.",
    )
    return parser.parse_args()


def find_repo_root(start: Path) -> Path:
    start = start.resolve()

    for candidate in [start, *start.parents]:
        target = candidate / "components" / "TvWatchOverlay.tsx"

        if (candidate / "package.json").is_file() and target.is_file():
            return candidate

    raise FileNotFoundError(
        "Không tìm thấy repo BảoFlix. Hãy đặt file Python cạnh package.json "
        "hoặc dùng --repo DUONG_DAN."
    )


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    normalized = content.replace("\r\n", "\n").rstrip() + "\n"
    path.write_text(normalized, encoding="utf-8")


def create_backup(target: Path, repo_root: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = repo_root / "backup" / f"tv-overlay-fix-{timestamp}"
    destination = backup_root / target.relative_to(repo_root)

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target, destination)

    return backup_root


def patch_chunk_effect(text: str) -> tuple[str, bool]:
    if OLD_CHUNK_EFFECT in text:
        return text.replace(OLD_CHUNK_EFFECT, NEW_CHUNK_EFFECT, 1), True

    if (
        "if (!pendingCurrentEpisodeFocusRef.current) return;" in text
        and "không được ép activeChunkIndex" in text
    ):
        return text, False

    raise RuntimeError(
        "Không nhận diện được useEffect phân nhóm tập. "
        "File TvWatchOverlay.tsx có thể đã khác bản GitHub được kiểm tra."
    )


def patch_settings_button(text: str) -> tuple[str, bool]:
    changed = False

    if 'data-tv-focus-key="overlay:settings"' not in text:
        if PLAYER_BUTTON not in text:
            raise RuntimeError(
                "Không tìm thấy nút Player trong hàng action của TV overlay."
            )

        text = text.replace(
            PLAYER_BUTTON,
            PLAYER_BUTTON + "\n\n" + SETTINGS_BUTTON,
            1,
        )
        changed = True

    old_grid = '"mt-3 grid grid-cols-4 gap-2.5"'
    new_grid = '"mt-3 grid grid-cols-5 gap-2.5"'

    if old_grid in text:
        text = text.replace(old_grid, new_grid, 1)
        changed = True
    elif new_grid not in text:
        raise RuntimeError(
            "Không tìm thấy class grid-cols-4/grid-cols-5 của hàng action overlay."
        )

    return text, changed


def validate_patch(text: str) -> None:
    required = [
        'data-tv-focus-key="overlay:settings"',
        'href="/cai-dat?tv=1"',
        '"mt-3 grid grid-cols-5 gap-2.5"',
        "if (!pendingCurrentEpisodeFocusRef.current) return;",
        "setActiveChunkIndex(index);",
        "const episodeIndex = activeChunk.start + index;",
    ]

    missing = [marker for marker in required if marker not in text]

    if missing:
        raise RuntimeError(
            "Patch chưa đủ marker bắt buộc:\n- " + "\n- ".join(missing)
        )

    if OLD_CHUNK_EFFECT in text:
        raise RuntimeError("Logic cũ gây reset nhóm tập vẫn còn trong file.")


def get_npm_command() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def run_build(repo_root: Path) -> None:
    command = [get_npm_command(), "run", "build"]

    print("\n> " + " ".join(command))
    result = subprocess.run(command, cwd=repo_root)

    if result.returncode != 0:
        raise RuntimeError(
            f"Build thất bại với mã {result.returncode}. "
            "File backup vẫn còn để khôi phục."
        )


def main() -> int:
    args = parse_args()

    try:
        repo_root = find_repo_root(args.repo or Path.cwd())
    except Exception as error:
        print(f"\nLỖI: {error}", file=sys.stderr)
        return 1

    target = repo_root / "components" / "TvWatchOverlay.tsx"
    print(f"Repo: {repo_root}")
    print(f"File sửa: {target.relative_to(repo_root)}")

    backup_root: Path | None = None

    try:
        original = read_text(target)
        backup_root = create_backup(target, repo_root)

        patched, _ = patch_chunk_effect(original)
        patched, _ = patch_settings_button(patched)

        validate_patch(patched)

        if patched != original:
            write_text(target, patched)
            print("✓ Đã sửa lỗi chuyển nhóm tập trong TV overlay.")
            print("✓ Đã thêm nút Cài đặt vào overlay TV.")
        else:
            print("✓ File đã được patch trước đó, không chèn trùng.")

        print(f"✓ Backup: {backup_root}")

        if not args.skip_build:
            run_build(repo_root)
            print("✓ Build thành công.")
        else:
            print("! Đã bỏ qua build theo yêu cầu.")

        print(
            "\nHOÀN TẤT.\n"
            "Kiểm tra trên máy:\n"
            "1. npm run dev\n"
            "2. Mở một phim có hơn 24 tập trong TV Mode.\n"
            "3. Mở overlay > Tập > chọn nhóm 25-48 hoặc nhóm cuối.\n"
            "4. Chọn một tập và xác nhận URL có tap=24 trở lên.\n"
            "5. Kiểm tra nút Cài đặt mở /cai-dat?tv=1.\n\n"
            "Script không commit hoặc push GitHub."
        )
        return 0

    except Exception as error:
        print(f"\nLỖI: {error}", file=sys.stderr)

        if backup_root:
            print(f"Backup: {backup_root}", file=sys.stderr)

        return 1


if __name__ == "__main__":
    raise SystemExit(main())
