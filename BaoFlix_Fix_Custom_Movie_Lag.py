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

DRIVE = Path("components/CustomDrivePlayer.tsx")
HLS = Path("components/HlsPlayer.tsx")

DRIVE_MARKER = "BAOFLIX_CUSTOM_DRIVE_PERSONAL_PROGRESS"
HLS_MARKER = "BAOFLIX_CUSTOM_HLS_PERSONAL_PROGRESS"
FIX_MARKER = "BAOFLIX_CUSTOM_MOVIE_LAG_FIX"

PROTECTED = {
    Path("components/TvRemoteNavigator.tsx"),
    Path("components/TvWatchOverlay.tsx"),
    Path("components/TvRemoteKeyBridge.tsx"),
    Path("components/TvPlayerCommandBridge.tsx"),
    Path("components/NativeVideoPlayer.tsx"),
    Path("components/WatchHistoryCloudSync.tsx"),
}

class PatchError(RuntimeError):
    pass

def find_root(start: Path) -> Path:
    start = start.expanduser().resolve()
    for candidate in (start, *start.parents):
        if (
            (candidate / "package.json").is_file()
            and (candidate / DRIVE).is_file()
            and (candidate / HLS).is_file()
        ):
            return candidate
    raise PatchError("Không tìm thấy root repo BảoFlix.")

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0:
        raise PatchError(f"Không tìm thấy anchor: {label}.")
    if count > 1:
        raise PatchError(f"Anchor '{label}' xuất hiện {count} lần.")
    return text.replace(old, new, 1)

def patch_drive(text: str) -> str:
    if FIX_MARKER in text:
        return text
    if DRIVE_MARKER not in text:
        raise PatchError("CustomDrivePlayer chưa có patch phim riêng hiện tại.")

    text = replace_once(
        text,
        'const PROBE_TIMEOUT_MS = 3500;',
        '''const PROBE_TIMEOUT_MS = 3500;
const PERSONAL_PROBE_TIMEOUT_MS = 1800;
// BAOFLIX_CUSTOM_MOVIE_LAG_FIX''',
        "probe constants",
    )

    text = replace_once(
        text,
        '      if (subtitles.length === 0 || directCandidates.length === 0) return;',
        '      if (mode !== "native" || subtitles.length === 0) return;',
        "defer subtitles until native",
    )

    text = replace_once(
        text,
        '  }, [directCandidates.length, subtitles]);',
        '  }, [mode, subtitles]);',
        "subtitle dependencies",
    )

    text = replace_once(
        text,
        '''    const timeout = window.setTimeout(() => {
      tryNextCandidate("Nguồn direct tải quá lâu.", true);
    }, PROBE_TIMEOUT_MS);''',
        '''    const timeout = window.setTimeout(() => {
      tryNextCandidate("Nguồn direct tải quá lâu.", true);
    }, tvMode ? PROBE_TIMEOUT_MS : PERSONAL_PROBE_TIMEOUT_MS);''',
        "device-specific probe timeout",
    )

    text = replace_once(
        text,
        '  }, [activeCandidate, mode]);',
        '  }, [activeCandidate, mode, tvMode]);',
        "probe timeout dependencies",
    )

    old_render = '''      {mode === "native" && nativeSrc ? (
        <NativeVideoPlayer
          src={nativeSrc}
          title={title}
          subtitle={serverForOverlay.server_name}
          poster={poster}
          progressKey={progressKey}
          tvMode={tvMode}
          subtitleTracks={resolvedSubtitleTracks}
        />
      ) : (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          tabIndex={tvMode ? -1 : 0}
          data-tv-player="drive-iframe"
          data-tv-skip={tvMode ? true : undefined}
          className={[
            "h-full w-full border-0 bg-black outline-none",
            tvMode ? "pointer-events-none" : "",
          ].join(" ")}
          title={title}
        />
      )}'''

    new_render = '''      {mode === "native" && nativeSrc ? (
        <NativeVideoPlayer
          src={nativeSrc}
          title={title}
          subtitle={serverForOverlay.server_name}
          poster={poster}
          progressKey={progressKey}
          tvMode={tvMode}
          subtitleTracks={resolvedSubtitleTracks}
        />
      ) : mode === "iframe" ? (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          tabIndex={tvMode ? -1 : 0}
          data-tv-player="drive-iframe"
          data-tv-skip={tvMode ? true : undefined}
          className={[
            "h-full w-full border-0 bg-black outline-none",
            tvMode ? "pointer-events-none" : "",
          ].join(" ")}
          title={title}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black text-sm text-slate-400">
          Đang kiểm tra nguồn phát...
        </div>
      )}'''

    text = replace_once(
        text,
        old_render,
        new_render,
        "avoid iframe during probing",
    )

    return text

def patch_hls(text: str) -> str:
    if FIX_MARKER in text:
        return text
    if HLS_MARKER not in text:
        raise PatchError("HlsPlayer chưa có patch phim riêng hiện tại.")

    text = replace_once(
        text,
        '''const PLAYBACK_PROGRESS_SYNCED_EVENT =
  "baoflix-playback-progress-synced";''',
        '''const PLAYBACK_PROGRESS_SYNCED_EVENT =
  "baoflix-playback-progress-synced";
const LOCAL_PROGRESS_SAVE_INTERVAL_MS = 10_000;
// BAOFLIX_CUSTOM_MOVIE_LAG_FIX''',
        "HLS save interval",
    )

    text = replace_once(
        text,
        '''      if (now - lastSaveRef.current < 3000) {
        return;
      }''',
        '''      if (
        now - lastSaveRef.current <
        LOCAL_PROGRESS_SAVE_INTERVAL_MS
      ) {
        return;
      }''',
        "HLS throttle",
    )

    return text

def backup(root: Path, paths: list[Path]) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = root / "backup" / f"custom-movie-lag-fix-{stamp}"
    for rel in paths:
        src = root / rel
        dst = base / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    return base

def atomic_write(path: Path, content: str) -> None:
    tmp = path.with_name(f".{path.name}.lagfix.tmp")
    tmp.write_text(content, encoding="utf-8", newline="\n")
    os.replace(tmp, path)

def run(cmd: list[str], root: Path) -> bool:
    print(f"\n$ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=root, check=False).returncode == 0

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()

    try:
        root = find_root(args.repo)

        if {DRIVE, HLS} & PROTECTED:
            raise PatchError("Protected file nằm trong target.")

        drive_old = (root / DRIVE).read_text(encoding="utf-8")
        hls_old = (root / HLS).read_text(encoding="utf-8")

        outputs = {
            DRIVE: patch_drive(drive_old),
            HLS: patch_hls(hls_old),
        }

        changed = [
            rel for rel, new in outputs.items()
            if (root / rel).read_text(encoding="utf-8") != new
        ]

        print(f"Repo: {root}")
        print("\nFile sẽ thay đổi:")
        for rel in changed:
            print(f"- {rel}")

        print("\nSửa hiệu năng:")
        print("- Không tải Google Drive iframe và Drive Relay cùng lúc.")
        print("- Chỉ tải/convert subtitle sau khi native relay thành công.")
        print("- PC/phone probe relay tối đa 1.8s; TV vẫn 3.5s.")
        print("- HLS ghi progress map mỗi ~10s; pause/end vẫn ghi ngay.")

        print("\nProtected - KHÔNG sửa:")
        for rel in sorted(PROTECTED, key=str):
            print(f"- {rel}")

        if not changed:
            print("\nLag hotfix đã được áp dụng.")
            return 0

        if args.dry_run:
            print("\nDry-run OK. Chưa ghi file.")
            return 0

        backup_dir = backup(root, changed)
        for rel in changed:
            atomic_write(root / rel, outputs[rel])

        print(f"\nBackup: {backup_dir}")
        print("Đã áp dụng custom movie lag hotfix.")

        if args.verify:
            lint_ok = run(["npm", "run", "lint"], root)
            build_ok = run(["npm", "run", "build"], root)
            if not lint_ok or not build_ok:
                print(
                    "\nLint/build còn lỗi. Gửi output tiếp theo cho mình.",
                    file=sys.stderr,
                )
                return 2

        return 0

    except (PatchError, OSError) as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
