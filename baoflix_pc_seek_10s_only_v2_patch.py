#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import datetime as dt
import shutil
import subprocess
import sys
from pathlib import Path

TARGET = Path("components") / "NativeVideoPlayer.tsx"

PATCH_MARKER = "// BAOFLIX_PC_SEEK_10S_ONLY_V2"
ANCHOR = "  useEffect(() => {\n    if (!progressKey) return;\n\n    // Gi\u1eef m\u1ed9t string \u0111\u00e3 \u0111\u01b0\u1ee3c narrow \u1ed5n \u0111\u1ecbnh cho callback ch\u1ea1y v\u1ec1 sau."
INSERT = "  // BAOFLIX_PC_SEEK_10S_ONLY_V2\n  // Chỉ PC/điện thoại: ArrowLeft / ArrowRight = ±10 giây.\n  // TV giữ nguyên toàn bộ logic bridge/overlay/remote hiện tại.\n  useEffect(() => {\n    const player = videoRef.current;\n\n    if (!player || tvMode) return;\n\n    function handleDesktopSeekKey(event: KeyboardEvent) {\n      if (\n        event.key !== \"ArrowLeft\" &&\n        event.key !== \"ArrowRight\"\n      ) {\n        return;\n      }\n\n      event.preventDefault();\n      event.stopPropagation();\n\n      // Một lần nhấn = đúng một lần tua.\n      // Không cho key-repeat cộng dồn thành 20/30/40 giây.\n      if (event.repeat) return;\n\n      // Đọc ref lại trong callback để TypeScript biết rõ\n      // element có thể đã unmount giữa hai thời điểm.\n      const currentVideo = videoRef.current;\n      if (!currentVideo) return;\n\n      const duration =\n        Number.isFinite(currentVideo.duration) &&\n        currentVideo.duration > 0\n          ? currentVideo.duration\n          : Number.MAX_SAFE_INTEGER;\n\n      const delta =\n        event.key === \"ArrowRight\"\n          ? DEFAULT_SEEK_SECONDS\n          : -DEFAULT_SEEK_SECONDS;\n\n      currentVideo.currentTime = clamp(\n        currentVideo.currentTime + delta,\n        0,\n        duration\n      );\n    }\n\n    player.addEventListener(\n      \"keydown\",\n      handleDesktopSeekKey,\n      true\n    );\n\n    return () => {\n      player.removeEventListener(\n        \"keydown\",\n        handleDesktopSeekKey,\n        true\n      );\n    };\n  }, [tvMode]);\n\n"

OLD_MARKER = "// BAOFLIX_PC_SEEK_10S_ONLY"

def fail(message: str) -> None:
    raise RuntimeError(message)

def find_root(start: Path) -> Path:
    current = start.resolve()

    for candidate in [current, *current.parents]:
        if (
            (candidate / "package.json").exists()
            and (candidate / TARGET).exists()
        ):
            return candidate

    fail(
        "Không tìm thấy repo BảoFlix. "
        "Đặt patcher cạnh package.json hoặc dùng --root PATH."
    )

def run_build(root: Path) -> None:
    npm = "npm.cmd" if sys.platform.startswith("win") else "npm"

    print("$ npm run build")

    result = subprocess.run(
        [npm, "run", "build"],
        cwd=root,
    )

    if result.returncode != 0:
        fail("npm run build thất bại.")

def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "BảoFlix PC seek 10s V2: "
            "fix TypeScript null narrowing, TV untouched."
        )
    )

    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
    )
    parser.add_argument(
        "--check",
        action="store_true",
    )

    args = parser.parse_args()

    root = find_root(args.root)
    target = root / TARGET
    current = target.read_text(encoding="utf-8")

    print("Repo  :", root)
    print("Target:", target)
    print()
    print("Patch V2:")
    print(" - PC ArrowLeft  = -10 giây")
    print(" - PC ArrowRight = +10 giây")
    print(" - bỏ key repeat")
    print(" - fix TypeScript: đọc videoRef.current trong callback")
    print(" - tvMode=true không thay đổi")
    print(" - KHÔNG sửa bất kỳ file TV nào")

    if PATCH_MARKER in current:
        print()
        print("Patch PC seek 10s V2 đã có sẵn.")

        if args.check:
            run_build(root)

        return 0

    # Bản cũ nếu từng apply nhưng chưa rollback thì không tự chồng patch.
    if OLD_MARKER in current:
        fail(
            "Phát hiện patch PC seek bản cũ vẫn còn trong source. "
            "Hãy rollback bản cũ trước rồi chạy V2."
        )

    if ANCHOR not in current:
        fail(
            "Không tìm thấy anchor đúng với NativeVideoPlayer hiện tại. "
            "Source có thể đã đổi; patcher dừng để tránh sửa nhầm."
        )

    patched = current.replace(
        ANCHOR,
        INSERT + ANCHOR,
        1,
    )

    if args.dry_run:
        print()
        print("Dry-run OK.")
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")

    backup = (
        root
        / ".baoflix_patch_backups"
        / f"pc_seek_10s_v2_{stamp}"
        / TARGET
    )

    backup.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    shutil.copy2(target, backup)
    print("Backup:", backup)

    try:
        target.write_text(
            patched,
            encoding="utf-8",
            newline="\n",
        )

        print("Đã patch NativeVideoPlayer.tsx.")

        if args.check:
            run_build(root)
            print("Build check OK.")

        print()
        print("Patch hoàn tất.")
        print("TV không bị thay đổi.")

        return 0

    except Exception:
        shutil.copy2(backup, target)

        print(
            "Có lỗi; đã rollback file gốc.",
            file=sys.stderr,
        )

        raise

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(
            f"PATCH ABORTED: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(2)
