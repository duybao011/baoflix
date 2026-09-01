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

OLD_MARKER = "// BAOFLIX_PC_SEEK_10S_ONLY_V2"
NEW_MARKER = "// BAOFLIX_PC_SEEK_10S_ONLY_V3_CAPTURE"
OLD_BLOCK = "  // BAOFLIX_PC_SEEK_10S_ONLY_V2\n  // Chỉ PC/điện thoại: ArrowLeft / ArrowRight = ±10 giây.\n  // TV giữ nguyên toàn bộ logic bridge/overlay/remote hiện tại.\n  useEffect(() => {\n    const player = videoRef.current;\n\n    if (!player || tvMode) return;\n\n    function handleDesktopSeekKey(event: KeyboardEvent) {\n      if (\n        event.key !== \"ArrowLeft\" &&\n        event.key !== \"ArrowRight\"\n      ) {\n        return;\n      }\n\n      event.preventDefault();\n      event.stopPropagation();\n\n      // Một lần nhấn = đúng một lần tua.\n      // Không cho key-repeat cộng dồn thành 20/30/40 giây.\n      if (event.repeat) return;\n\n      // Đọc ref lại trong callback để TypeScript biết rõ\n      // element có thể đã unmount giữa hai thời điểm.\n      const currentVideo = videoRef.current;\n      if (!currentVideo) return;\n\n      const duration =\n        Number.isFinite(currentVideo.duration) &&\n        currentVideo.duration > 0\n          ? currentVideo.duration\n          : Number.MAX_SAFE_INTEGER;\n\n      const delta =\n        event.key === \"ArrowRight\"\n          ? DEFAULT_SEEK_SECONDS\n          : -DEFAULT_SEEK_SECONDS;\n\n      currentVideo.currentTime = clamp(\n        currentVideo.currentTime + delta,\n        0,\n        duration\n      );\n    }\n\n    player.addEventListener(\n      \"keydown\",\n      handleDesktopSeekKey,\n      true\n    );\n\n    return () => {\n      player.removeEventListener(\n        \"keydown\",\n        handleDesktopSeekKey,\n        true\n      );\n    };\n  }, [tvMode]);\n\n"
NEW_BLOCK = "  // BAOFLIX_PC_SEEK_10S_ONLY_V3_CAPTURE\n  // PC/điện thoại: ArrowLeft / ArrowRight = đúng ±10 giây.\n  // Bắt ở document capture để chặn keyboard seek mặc định\n  // của browser controls trước khi browser tự cộng thêm bước tua.\n  // TV giữ nguyên hoàn toàn vì tvMode=true thoát ngay.\n  useEffect(() => {\n    if (tvMode) return;\n\n    function isSeekKey(event: KeyboardEvent) {\n      return (\n        event.key === \"ArrowLeft\" ||\n        event.key === \"ArrowRight\"\n      );\n    }\n\n    function belongsToCurrentVideo(event: KeyboardEvent) {\n      const currentVideo = videoRef.current;\n      if (!currentVideo) return false;\n\n      if (event.target === currentVideo) return true;\n      if (document.activeElement === currentVideo) return true;\n\n      try {\n        return event.composedPath().includes(currentVideo);\n      } catch {\n        return false;\n      }\n    }\n\n    function blockBrowserSeek(event: KeyboardEvent) {\n      event.preventDefault();\n      event.stopPropagation();\n      event.stopImmediatePropagation();\n    }\n\n    function handleDesktopSeekKeyDown(event: KeyboardEvent) {\n      if (!isSeekKey(event)) return;\n\n      if (\n        event.altKey ||\n        event.ctrlKey ||\n        event.metaKey\n      ) {\n        return;\n      }\n\n      if (!belongsToCurrentVideo(event)) return;\n\n      // Chặn default action của browser media controls trước.\n      blockBrowserSeek(event);\n\n      // Một lần nhấn vật lý = đúng một lần tua.\n      // Giữ phím không cộng dồn thành 20/30/40 giây.\n      if (event.repeat) return;\n\n      const currentVideo = videoRef.current;\n      if (!currentVideo) return;\n\n      const duration =\n        Number.isFinite(currentVideo.duration) &&\n        currentVideo.duration > 0\n          ? currentVideo.duration\n          : Number.MAX_SAFE_INTEGER;\n\n      const delta =\n        event.key === \"ArrowRight\"\n          ? DEFAULT_SEEK_SECONDS\n          : -DEFAULT_SEEK_SECONDS;\n\n      currentVideo.currentTime = clamp(\n        currentVideo.currentTime + delta,\n        0,\n        duration\n      );\n    }\n\n    function handleDesktopSeekKeyUp(event: KeyboardEvent) {\n      if (!isSeekKey(event)) return;\n      if (!belongsToCurrentVideo(event)) return;\n\n      // Một số browser controls hoàn tất hành động keyboard ở keyup.\n      // Chặn luôn để không phát sinh bước tua thứ hai.\n      blockBrowserSeek(event);\n    }\n\n    document.addEventListener(\n      \"keydown\",\n      handleDesktopSeekKeyDown,\n      true\n    );\n    document.addEventListener(\n      \"keyup\",\n      handleDesktopSeekKeyUp,\n      true\n    );\n\n    return () => {\n      document.removeEventListener(\n        \"keydown\",\n        handleDesktopSeekKeyDown,\n        true\n      );\n      document.removeEventListener(\n        \"keyup\",\n        handleDesktopSeekKeyUp,\n        true\n      );\n    };\n  }, [tvMode]);\n\n"

TV_FILES = [
    Path("components") / "TvRemoteNavigator.tsx",
    Path("components") / "TvWatchOverlay.tsx",
    Path("components") / "TvPlayerCommandBridge.tsx",
]

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
        "Đặt patcher trong repo hoặc dùng --root PATH."
    )

def snapshot_tv_files(root: Path):
    result = {}
    for relative in TV_FILES:
        path = root / relative
        if path.exists():
            result[relative.as_posix()] = path.read_bytes()
    return result

def verify_tv_untouched(root: Path, before) -> None:
    for relative, old_bytes in before.items():
        path = root / relative
        if not path.exists():
            fail(f"File TV bị mất ngoài dự kiến: {relative}")
        if path.read_bytes() != old_bytes:
            fail(f"File TV bị thay đổi ngoài dự kiến: {relative}")

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
            "BảoFlix PC seek V3 Capture: "
            "ArrowLeft/ArrowRight đúng ±10 giây, TV untouched."
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
    print("V3 Capture:")
    print(" - PC ArrowLeft  = -10 giây")
    print(" - PC ArrowRight = +10 giây")
    print(" - chặn default seek của browser ở capture phase")
    print(" - chặn keydown + keyup")
    print(" - bỏ key repeat")
    print(" - Native MP4/Drive và Native HLS dùng chung")
    print(" - tvMode=true thoát ngay")
    print(" - không sửa file TV")

    if NEW_MARKER in current:
        print()
        print("Patch V3 đã có sẵn.")
        if args.check:
            run_build(root)
        return 0

    if OLD_MARKER not in current:
        fail(
            "Không thấy marker PC seek V2 trong source hiện tại. "
            "Patcher dừng để tránh sửa nhầm phiên bản."
        )

    if OLD_BLOCK not in current:
        fail(
            "Có marker V2 nhưng block không khớp chính xác source hiện tại. "
            "Patcher dừng để không ghi đè thay đổi khác."
        )

    patched = current.replace(
        OLD_BLOCK,
        NEW_BLOCK,
        1,
    )

    if patched.count(NEW_MARKER) != 1:
        fail("Kết quả patch không có đúng 1 marker V3.")

    if OLD_MARKER in patched:
        fail("Marker V2 vẫn còn sau patch.")

    if args.dry_run:
        print()
        print("Dry-run OK: V2 có thể nâng an toàn lên V3.")
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = (
        root
        / ".baoflix_patch_backups"
        / f"pc_seek_v3_capture_{stamp}"
        / TARGET
    )
    backup.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    tv_before = snapshot_tv_files(root)
    shutil.copy2(target, backup)

    print()
    print("Backup:", backup)

    try:
        target.write_text(
            patched,
            encoding="utf-8",
            newline="\n",
        )

        verify_tv_untouched(root, tv_before)
        print("Đã nâng NativeVideoPlayer: V2 -> V3 Capture.")
        print("Đã kiểm tra: các file TV không thay đổi.")

        if args.check:
            run_build(root)
            verify_tv_untouched(root, tv_before)
            print("Build check OK.")
            print("TV vẫn nguyên sau build.")

        print()
        print("PATCH HOÀN TẤT.")
        return 0

    except Exception:
        shutil.copy2(backup, target)
        print(
            "Có lỗi; đã rollback NativeVideoPlayer.tsx về bản gốc.",
            file=sys.stderr,
        )

        try:
            verify_tv_untouched(root, tv_before)
        except Exception as tv_error:
            print(
                f"CẢNH BÁO kiểm tra TV: {tv_error}",
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
