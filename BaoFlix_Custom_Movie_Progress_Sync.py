#!/usr/bin/env python3
# -*- coding: utf-8 -*-
'''
BảoFlix - sync playback progress cho PHIM RIÊNG.

Mục tiêu:
1) Google Drive phim riêng:
   - PC/điện thoại cũng thử Drive Relay -> NativeVideoPlayer trước.
   - Nếu relay lỗi/timeout thì fallback iframe như cũ.
   - NativeVideoPlayer đã có cloud playback progress sync, nên resume xuyên
     PC <-> điện thoại tự hoạt động.
   - TV giữ nguyên overlay/remote hiện tại.

2) HLS phim riêng:
   - Giữ nguyên HlsPlayer để tránh đổi hành vi UI/player.
   - Mirror progress vào baoflix_video_progress_v1 để dùng chung Supabase sync.
   - Vẫn giữ raw localStorage cũ để tương thích progress local trước đây.
   - Khi cloud progress về lúc vừa mở video, tự seek đúng vị trí mới hơn.

KHÔNG cần chạy SQL mới.
KHÔNG sửa:
- TvRemoteNavigator.tsx
- TvWatchOverlay.tsx
- TvRemoteKeyBridge.tsx
- TvPlayerCommandBridge.tsx
- NativeVideoPlayer.tsx
- WatchHistoryCloudSync.tsx

Dùng:
    python BaoFlix_Custom_Movie_Progress_Sync.py --dry-run
    python BaoFlix_Custom_Movie_Progress_Sync.py
    python BaoFlix_Custom_Movie_Progress_Sync.py --verify
'''

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


CUSTOM_TARGET = Path("components/CustomDrivePlayer.tsx")
HLS_TARGET = Path("components/HlsPlayer.tsx")

MARKER_DRIVE = "BAOFLIX_CUSTOM_DRIVE_PERSONAL_PROGRESS"
MARKER_HLS = "BAOFLIX_CUSTOM_HLS_PERSONAL_PROGRESS"

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
            and (candidate / CUSTOM_TARGET).is_file()
            and (candidate / HLS_TARGET).is_file()
        ):
            return candidate

    raise PatchError("Không tìm thấy root repo BảoFlix.")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)

    if count == 0:
        raise PatchError(
            f"Không tìm thấy đoạn cần vá: {label}. "
            "Repo local có thể khác bản GitHub đã kiểm tra."
        )

    if count > 1:
        raise PatchError(
            f"Đoạn '{label}' xuất hiện {count} lần; dừng để tránh sửa nhầm."
        )

    return text.replace(old, new, 1)


def patch_custom_drive(text: str) -> tuple[str, list[str]]:
    if MARKER_DRIVE in text:
        return text, ["CustomDrivePlayer đã có patch progress phim riêng."]

    notes = []

    text = replace_once(
        text,
        'const EMPTY_SUBTITLES: EpisodeSubtitle[] = [];',
        'const EMPTY_SUBTITLES: EpisodeSubtitle[] = [];\n'
        f'// {MARKER_DRIVE}',
        "Drive marker",
    )

    text = replace_once(
        text,
        '      if (!tvMode || subtitles.length === 0) return;',
        '      if (subtitles.length === 0 || directCandidates.length === 0) return;',
        "cho phép subtitle native trên PC/điện thoại",
    )

    text = replace_once(
        text,
        '  }, [subtitles, tvMode]);',
        '  }, [directCandidates.length, subtitles]);',
        "subtitle effect dependencies",
    )

    text = replace_once(
        text,
        '''    if (!tvMode) {
      setMode("iframe");
      return;
    }

''',
        '',
        "bỏ ép non-TV vào iframe",
    )

    text = replace_once(
        text,
        '    if (!tvMode || mode !== "probing" || !activeCandidate) return;',
        '    if (mode !== "probing" || !activeCandidate) return;',
        "probe relay cho mọi thiết bị",
    )

    text = replace_once(
        text,
        '  }, [activeCandidate, mode, tvMode]);',
        '  }, [activeCandidate, mode]);',
        "probe effect dependencies",
    )

    text = replace_once(
        text,
        '{tvMode && mode === "probing" && activeCandidate && (',
        '{mode === "probing" && activeCandidate && (',
        "render hidden probe cho PC/điện thoại",
    )

    notes.extend([
        "PC/điện thoại sẽ thử Drive Relay/native trước thay vì ép iframe.",
        "Relay fail/timeout vẫn fallback Google Drive iframe như cũ.",
        "TV vẫn truyền tvMode=true vào NativeVideoPlayer, nên overlay/remote không đổi.",
        "Phụ đề ngoài cũng nạp được khi native chạy trên PC/điện thoại.",
    ])

    return text, notes


HLS_REPLACEMENT = r'''"use client";

// BAOFLIX_CUSTOM_HLS_PERSONAL_PROGRESS

import Hls from "hls.js";
import { useEffect, useRef } from "react";

type HlsPlayerProps = {
  src: string;
  storageKey?: string;
  autoResume?: boolean;
};

type StoredVideoProgress = {
  currentTime: number;
  duration: number;
  updatedAt: string;
};

type ProgressMap = Record<string, StoredVideoProgress>;

const VIDEO_PROGRESS_KEY = "baoflix_video_progress_v1";
const PLAYBACK_PROGRESS_CHANGE_EVENT =
  "baoflix-playback-progress-change";
const PLAYBACK_PROGRESS_URGENT_EVENT =
  "baoflix-playback-progress-urgent";
const PLAYBACK_PROGRESS_SYNCED_EVENT =
  "baoflix-playback-progress-synced";

function emitPlaybackEvent(type: "playing" | "paused") {
  try {
    window.dispatchEvent(new Event(`baoflix-tv-player-${type}`));
    window.dispatchEvent(
      new CustomEvent("baoflix-tv-player-state", {
        detail: {
          playing: type === "playing",
          paused: type === "paused",
        },
      })
    );
  } catch {
    // Ignore if the runtime blocks CustomEvent for any reason.
  }
}

function readProgressMap(): ProgressMap {
  try {
    const raw = localStorage.getItem(VIDEO_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    return parsed && typeof parsed === "object"
      ? (parsed as ProgressMap)
      : {};
  } catch {
    return {};
  }
}

function readCloudProgress(storageKey?: string) {
  if (!storageKey) return null;

  const item = readProgressMap()[storageKey];
  if (!item || typeof item !== "object") return null;

  const currentTime = Number(item.currentTime || 0);
  const duration = Number(item.duration || 0);
  const updatedAt = String(item.updatedAt || "");

  if (
    !Number.isFinite(currentTime) ||
    currentTime < 0 ||
    !updatedAt ||
    !Number.isFinite(Date.parse(updatedAt))
  ) {
    return null;
  }

  return {
    currentTime,
    duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
    updatedAt,
  };
}

function saveCloudProgress(
  storageKey: string | undefined,
  currentTime: number,
  duration: number
) {
  if (!storageKey) return;
  if (!Number.isFinite(currentTime) || currentTime < 1) return;

  try {
    const map = readProgressMap();

    map[storageKey] = {
      currentTime,
      duration:
        Number.isFinite(duration) && duration > 0
          ? duration
          : 0,
      updatedAt: new Date().toISOString(),
    };

    const trimmed = Object.entries(map)
      .sort(([, a], [, b]) => {
        return (
          Date.parse(b.updatedAt || "") -
          Date.parse(a.updatedAt || "")
        );
      })
      .slice(0, 120);

    const nextMap = Object.fromEntries(trimmed);

    localStorage.setItem(
      VIDEO_PROGRESS_KEY,
      JSON.stringify(nextMap)
    );

    window.dispatchEvent(
      new CustomEvent(PLAYBACK_PROGRESS_CHANGE_EVENT, {
        detail: {
          progressKey: storageKey,
          updatedAt: nextMap[storageKey]?.updatedAt,
        },
      })
    );
  } catch {
    // Bỏ qua lỗi storage.
  }
}

export default function HlsPlayer({
  src,
  storageKey,
  autoResume = true,
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasSeekedRef = useRef(false);
  const lastSaveRef = useRef(0);
  const sourceStartedAtRef = useRef(0);
  const lastAppliedUpdatedAtRef = useRef("");

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement || !src) return;

    const video = videoElement;

    hasSeekedRef.current = false;
    lastSaveRef.current = 0;
    sourceStartedAtRef.current = Date.now();
    lastAppliedUpdatedAtRef.current = "";

    function getLegacySavedTime() {
      if (!storageKey || !autoResume) return 0;

      try {
        const raw = localStorage.getItem(storageKey);
        const value = raw ? Number(raw) : 0;

        return Number.isFinite(value) && value > 5
          ? value
          : 0;
      } catch {
        return 0;
      }
    }

    function applySavedTime(
      seconds: number,
      updatedAt = ""
    ) {
      if (!Number.isFinite(seconds) || seconds <= 5) {
        return false;
      }

      const duration = Number.isFinite(video.duration)
        ? video.duration
        : 0;

      if (duration > 0 && seconds >= duration - 3) {
        return false;
      }

      try {
        video.currentTime =
          duration > 0
            ? Math.min(seconds, Math.max(duration - 3, 0))
            : seconds;

        hasSeekedRef.current = true;

        if (updatedAt) {
          lastAppliedUpdatedAtRef.current = updatedAt;
        }

        return true;
      } catch {
        return false;
      }
    }

    function seekToSavedTime() {
      if (hasSeekedRef.current || !autoResume) return;

      const cloud = readCloudProgress(storageKey);

      if (
        cloud &&
        applySavedTime(cloud.currentTime, cloud.updatedAt)
      ) {
        return;
      }

      applySavedTime(getLegacySavedTime());
    }

    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;

      video.addEventListener(
        "loadedmetadata",
        seekToSavedTime
      );
      video.addEventListener("canplay", seekToSavedTime);
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        seekToSavedTime();
      });

      video.addEventListener(
        "loadedmetadata",
        seekToSavedTime
      );
      video.addEventListener("canplay", seekToSavedTime);
    } else {
      video.src = src;
    }

    function saveTimeNow(urgent = false) {
      if (!storageKey) return;
      if (!video.currentTime || video.currentTime < 1) return;

      const currentTime = video.currentTime;
      const duration = Number.isFinite(video.duration)
        ? video.duration
        : 0;

      try {
        // Giữ key raw cũ để không làm mất resume local đời trước.
        localStorage.setItem(
          storageKey,
          String(Math.floor(currentTime))
        );
      } catch {
        // bỏ qua lỗi localStorage
      }

      saveCloudProgress(
        storageKey,
        currentTime,
        duration
      );

      const cloud = readCloudProgress(storageKey);
      lastAppliedUpdatedAtRef.current =
        cloud?.updatedAt || lastAppliedUpdatedAtRef.current;

      if (urgent) {
        window.dispatchEvent(
          new Event(PLAYBACK_PROGRESS_URGENT_EVENT)
        );
      }
    }

    function saveTimeThrottled() {
      const now = Date.now();

      if (now - lastSaveRef.current < 3000) {
        return;
      }

      lastSaveRef.current = now;
      saveTimeNow(false);
    }

    function saveTimeUrgent() {
      saveTimeNow(true);
    }

    function handleSyncedProgress(event: Event) {
      if (!storageKey || !autoResume) return;

      const detail = (
        event as CustomEvent<{ keys?: string[] }>
      ).detail;

      if (
        Array.isArray(detail?.keys) &&
        !detail.keys.includes(storageKey)
      ) {
        return;
      }

      // Chỉ auto-reseek trong cửa sổ khởi động.
      // Tránh đang xem giữa chừng lại bị thiết bị khác kéo timeline.
      if (
        Date.now() - sourceStartedAtRef.current >
        15000
      ) {
        return;
      }

      const cloud = readCloudProgress(storageKey);
      if (!cloud) return;

      const incomingStamp = Date.parse(
        cloud.updatedAt || ""
      );
      const appliedStamp = Date.parse(
        lastAppliedUpdatedAtRef.current || ""
      );

      if (!Number.isFinite(incomingStamp)) return;

      if (
        Number.isFinite(appliedStamp) &&
        incomingStamp <= appliedStamp
      ) {
        return;
      }

      applySavedTime(
        cloud.currentTime,
        cloud.updatedAt
      );
    }

    function handlePlay() {
      emitPlaybackEvent("playing");
    }

    function handlePause() {
      if (video.ended) return;
      emitPlaybackEvent("paused");
      saveTimeUrgent();
    }

    function handleEnded() {
      saveTimeUrgent();
    }

    video.addEventListener(
      "timeupdate",
      saveTimeThrottled
    );
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("play", handlePlay);

    window.addEventListener(
      PLAYBACK_PROGRESS_SYNCED_EVENT,
      handleSyncedProgress as EventListener
    );

    return () => {
      saveTimeUrgent();

      video.removeEventListener(
        "timeupdate",
        saveTimeThrottled
      );
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener(
        "loadedmetadata",
        seekToSavedTime
      );
      video.removeEventListener(
        "canplay",
        seekToSavedTime
      );

      window.removeEventListener(
        PLAYBACK_PROGRESS_SYNCED_EVENT,
        handleSyncedProgress as EventListener
      );

      if (hls) {
        hls.destroy();
      }
    };
  }, [src, storageKey, autoResume]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      tabIndex={0}
      data-tv-player="video"
      data-tv-skip
      className="h-full w-full bg-black object-contain outline-none"
    />
  );
}
'''


def patch_hls(text: str) -> tuple[str, list[str]]:
    if MARKER_HLS in text:
        return text, ["HlsPlayer đã có patch progress phim riêng."]

    required = [
        '"use client";',
        'import Hls from "hls.js";',
        'type HlsPlayerProps = {',
        'localStorage.setItem(storageKey, String(Math.floor(video.currentTime)))',
    ]

    for marker in required:
        if marker not in text:
            raise PatchError(
                f"HlsPlayer.tsx thiếu marker '{marker}', không ghi đè."
            )

    return HLS_REPLACEMENT, [
        "Giữ HlsPlayer hiện tại, không đổi component/UI.",
        "Progress HLS được mirror vào baoflix_video_progress_v1.",
        "Raw localStorage cũ vẫn được cập nhật để tương thích dữ liệu cũ.",
        "Cloud progress mới hơn có thể reseek trong 15 giây đầu.",
        "Pause/ended kích hoạt sync khẩn.",
    ]


def make_backup(root: Path, changed: list[Path]) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = (
        root
        / "backup"
        / f"custom-movie-progress-{stamp}"
    )

    for relative in changed:
        source = root / relative
        if not source.is_file():
            continue

        dest = backup_root / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)

    return backup_root


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(
        f".{path.name}.custom-progress.tmp"
    )
    temp.write_text(
        content,
        encoding="utf-8",
        newline="\n",
    )
    os.replace(temp, path)


def run_command(command: list[str], root: Path) -> bool:
    print(f"\n$ {' '.join(command)}")
    result = subprocess.run(
        command,
        cwd=root,
        check=False,
    )
    return result.returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Sync playback progress cho phim riêng Drive + HLS."
        )
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path.cwd(),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
    )
    args = parser.parse_args()

    try:
        root = find_root(args.repo)

        targets = {
            CUSTOM_TARGET,
            HLS_TARGET,
        }

        if targets & PROTECTED:
            raise PatchError(
                "Lỗi nội bộ: protected file nằm trong target."
            )

        drive_original = (
            root / CUSTOM_TARGET
        ).read_text(encoding="utf-8")

        hls_original = (
            root / HLS_TARGET
        ).read_text(encoding="utf-8")

        drive_new, drive_notes = patch_custom_drive(
            drive_original
        )
        hls_new, hls_notes = patch_hls(
            hls_original
        )

        outputs = {
            CUSTOM_TARGET: drive_new,
            HLS_TARGET: hls_new,
        }

        changed: list[Path] = []

        for relative, desired in outputs.items():
            current = (
                root / relative
            ).read_text(encoding="utf-8")

            if current != desired:
                changed.append(relative)

        print(f"Repo: {root}")

        print(f"\n[{CUSTOM_TARGET}]")
        for note in drive_notes:
            print(f"- {note}")

        print(f"\n[{HLS_TARGET}]")
        for note in hls_notes:
            print(f"- {note}")

        print("\nProtected - KHÔNG sửa:")
        for relative in sorted(
            PROTECTED,
            key=str,
        ):
            print(f"- {relative}")

        print("\nFile sẽ thay đổi:")
        for relative in changed:
            print(f"- {relative}")

        if not changed:
            print(
                "\nCustom movie progress sync đã được áp dụng."
            )
            return 0

        if args.dry_run:
            print("\nDry-run OK. Chưa ghi file.")
            return 0

        backup_root = make_backup(
            root,
            changed,
        )

        for relative in changed:
            atomic_write(
                root / relative,
                outputs[relative],
            )

        print(f"\nBackup: {backup_root}")
        print(
            "Đã áp dụng progress sync cho phim riêng Drive + HLS."
        )

        if args.verify:
            lint_ok = run_command(
                ["npm", "run", "lint"],
                root,
            )
            build_ok = run_command(
                ["npm", "run", "build"],
                root,
            )

            if not lint_ok or not build_ok:
                print(
                    "\nLint/build còn lỗi. "
                    "Gửi output tiếp theo cho mình.",
                    file=sys.stderr,
                )
                return 2

        return 0

    except PatchError as error:
        print(
            f"LỖI: {error}",
            file=sys.stderr,
        )
        return 1

    except OSError as error:
        print(
            f"LỖI HỆ THỐNG: {error}",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
