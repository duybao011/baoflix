#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def fail(message: str) -> None:
    raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"[{label}] expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


def read(path: Path) -> str:
    if not path.exists():
        fail(f"Missing file: {path}")
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def find_root(start: Path) -> Path:
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (
            (candidate / "package.json").exists()
            and (candidate / "components").exists()
            and (candidate / "lib").exists()
        ):
            return candidate
    fail("Không tìm thấy root repo BảoFlix.")


def patch_custom_drive_player(text: str) -> str:
    if "BAOFLIX_V13_NATIVE_FIRST" in text:
        return text

    old_constants = '''const PROBE_TIMEOUT_MS = 3500;
const PERSONAL_PROBE_TIMEOUT_MS = 1800;
// BAOFLIX_V11_SUBTITLE_NATIVE_PRIORITY
const SUBTITLE_DESKTOP_PROBE_TIMEOUT_MS = 8000;
const SUBTITLE_TV_PROBE_TIMEOUT_MS = 10000;
// BAOFLIX_CUSTOM_MOVIE_LAG_FIX
const DRIVE_RELAY_COOLDOWN_MS = 5 * 60 * 1000;
const DRIVE_RELAY_FAIL_UNTIL_KEY = "baoflix_drive_relay_fail_until";
const SAVE_INTERVAL_SECONDS = 5;'''

    new_constants = '''// BAOFLIX_V13_NATIVE_FIRST
// Relay/Drive có thể cold-start hoặc phản hồi metadata không đều.
// 1.8s trước đây quá gắt và làm file hợp lệ rơi iframe ngẫu nhiên.
const PROBE_TIMEOUT_MS = 6000;
const PERSONAL_PROBE_TIMEOUT_MS = 4500;
const SUBTITLE_DESKTOP_PROBE_TIMEOUT_MS = 7000;
const SUBTITLE_TV_PROBE_TIMEOUT_MS = 9000;
const DRIVE_NATIVE_RETRY_COUNT = 3;
const SAVE_INTERVAL_SECONDS = 5;'''

    text = replace_once(
        text,
        old_constants,
        new_constants,
        "V13 constants",
    )

    old_builder = '''function buildDirectCandidates(fileId: string) {
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

    new_builder = '''function buildDirectCandidates(fileId: string) {
  const relayBase = String(
    process.env.NEXT_PUBLIC_DRIVE_RELAY_URL || ""
  )
    .trim()
    .replace(/\\/+$/, "");

  if (!fileId || !relayBase) return [];

  const baseUrl =
    `${relayBase}/video/${encodeURIComponent(fileId)}`;

  return Array.from(
    { length: DRIVE_NATIVE_RETRY_COUNT },
    (_, index) => {
      if (index === 0) return baseUrl;

      try {
        const parsed = new URL(baseUrl);
        parsed.searchParams.set(
          "baoflix_native_retry",
          String(index)
        );
        return parsed.toString();
      } catch {
        return `${baseUrl}?baoflix_native_retry=${index}`;
      }
    }
  );
}'''

    text = replace_once(
        text,
        old_builder,
        new_builder,
        "V13 retry candidates",
    )

    old_cooldown = '''function isDriveRelayCoolingDown() {
  try {
    const failUntil = Number(
      sessionStorage.getItem(DRIVE_RELAY_FAIL_UNTIL_KEY) || 0
    );
    if (!Number.isFinite(failUntil) || failUntil <= Date.now()) {
      sessionStorage.removeItem(DRIVE_RELAY_FAIL_UNTIL_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function rememberDriveRelayTimeout() {
  try {
    sessionStorage.setItem(
      DRIVE_RELAY_FAIL_UNTIL_KEY,
      String(Date.now() + DRIVE_RELAY_COOLDOWN_MS)
    );
  } catch {
    // Bỏ qua storage bị chặn.
  }
}

function clearDriveRelayTimeout() {
  try {
    sessionStorage.removeItem(DRIVE_RELAY_FAIL_UNTIL_KEY);
  } catch {
    // Bỏ qua storage bị chặn.
  }
}

'''

    text = replace_once(
        text,
        old_cooldown,
        "",
        "V13 remove global cooldown",
    )

    old_mode_gate = '''    if (isDriveRelayCoolingDown() && !hasExternalSubtitles) {
      setMode("iframe");
      setFallbackReason(
        "Drive Relay vừa phản hồi chậm, tạm dùng iframe để vào phim nhanh hơn."
      );
      return;
    }

    setMode("probing");'''

    new_mode_gate = '''    // Luôn thử Native cho chính file hiện tại.
    // Timeout của phim/tập trước không được làm phim này rơi iframe.
    setMode("probing");'''

    text = replace_once(
        text,
        old_mode_gate,
        new_mode_gate,
        "V13 always try native",
    )

    old_timeout = '''    const timeoutMs = hasExternalSubtitles
      ? tvMode
        ? SUBTITLE_TV_PROBE_TIMEOUT_MS
        : SUBTITLE_DESKTOP_PROBE_TIMEOUT_MS
      : tvMode
        ? PROBE_TIMEOUT_MS
        : PERSONAL_PROBE_TIMEOUT_MS;

    const timeout = window.setTimeout(() => {
      tryNextCandidate(
        hasExternalSubtitles
          ? "Drive Relay chưa vào native kịp nên không thể gắn phụ đề ngoài."
          : "Nguồn direct tải quá lâu.",
        true
      );
    }, timeoutMs);'''

    new_timeout = '''    const baseTimeoutMs = hasExternalSubtitles
      ? tvMode
        ? SUBTITLE_TV_PROBE_TIMEOUT_MS
        : SUBTITLE_DESKTOP_PROBE_TIMEOUT_MS
      : tvMode
        ? PROBE_TIMEOUT_MS
        : PERSONAL_PROBE_TIMEOUT_MS;

    const timeoutMs =
      baseTimeoutMs + candidateIndex * 1000;

    const timeout = window.setTimeout(() => {
      tryNextCandidate(
        hasExternalSubtitles
          ? "Drive Relay đang chậm; thử lại Native trước khi dùng iframe."
          : "Nguồn Drive phản hồi chậm; đang thử lại Native."
      );
    }, timeoutMs);'''

    text = replace_once(
        text,
        old_timeout,
        new_timeout,
        "V13 adaptive timeout",
    )

    old_deps = '''  }, [
    activeCandidate,
    hasExternalSubtitles,
    mode,
    tvMode,
  ]);'''

    new_deps = '''  }, [
    activeCandidate,
    candidateIndex,
    hasExternalSubtitles,
    mode,
    tvMode,
  ]);'''

    text = replace_once(
        text,
        old_deps,
        new_deps,
        "V13 timeout deps",
    )

    old_flow = '''  function tryNextCandidate(
    reason: string,
    rememberTimeout = false
  ) {
    const nextIndex = candidateIndex + 1;

    if (nextIndex < directCandidates.length) {
      setCandidateIndex(nextIndex);
      setFallbackReason(reason);
      return;
    }

    if (rememberTimeout) rememberDriveRelayTimeout();

    setMode("iframe");
    setFallbackReason(
      hasExternalSubtitles
        ? "Drive Relay không trả về video native. Video đã chuyển sang iframe nên phụ đề ngoài không thể hiển thị."
        : "Drive Relay không trả về video native. Đã chuyển sang iframe dự phòng."
    );
  }

  function handleProbeReady() {
    if (!activeCandidate) return;

    clearDriveRelayTimeout();
    setNativeSrc(activeCandidate);
    setMode("native");
    setFallbackReason("");
  }'''

    new_flow = '''  function tryNextCandidate(reason: string) {
    const nextIndex = candidateIndex + 1;

    if (nextIndex < directCandidates.length) {
      setCandidateIndex(nextIndex);
      setNativeSrc("");
      setMode("probing");
      setFallbackReason(reason);
      return;
    }

    setMode("iframe");
    setFallbackReason(
      hasExternalSubtitles
        ? "Đã thử Native nhiều lần nhưng nguồn Drive vẫn không ổn định. Chuyển sang iframe; phụ đề ngoài sẽ không hoạt động."
        : "Đã thử Native nhiều lần nhưng nguồn Drive vẫn không ổn định. Chuyển sang iframe dự phòng."
    );
  }

  function handleProbeReady() {
    if (!activeCandidate) return;

    setNativeSrc(activeCandidate);
    setMode("native");
    setFallbackReason("");
  }'''

    text = replace_once(
        text,
        old_flow,
        new_flow,
        "V13 retry flow",
    )

    marker = '''  useEffect(() => {
    const saved = readEstimate(progressKey);'''

    fatal_effect = '''  useEffect(() => {
    function handleNativeFatal(event: Event) {
      if (mode !== "native") return;

      const detail = (
        event as CustomEvent<{
          progressKey?: string;
          src?: string;
        }>
      ).detail;

      if (
        detail?.progressKey &&
        detail.progressKey !== progressKey
      ) {
        return;
      }

      if (
        detail?.src &&
        nativeSrc &&
        detail.src !== nativeSrc
      ) {
        return;
      }

      const nextIndex = candidateIndex + 1;

      if (nextIndex < directCandidates.length) {
        setCandidateIndex(nextIndex);
        setNativeSrc("");
        setFallbackReason(
          "Native gặp lỗi khi phát; đang thử lại nguồn Drive."
        );
        setMode("probing");
        return;
      }

      setNativeSrc("");
      setFallbackReason(
        "Native gặp lỗi sau nhiều lần thử. Đã chuyển sang Drive iframe dự phòng."
      );
      setMode("iframe");
    }

    window.addEventListener(
      "baoflix-native-player-fatal",
      handleNativeFatal as EventListener
    );

    return () => {
      window.removeEventListener(
        "baoflix-native-player-fatal",
        handleNativeFatal as EventListener
      );
    };
  }, [
    candidateIndex,
    directCandidates.length,
    mode,
    nativeSrc,
    progressKey,
  ]);

''' + marker

    text = replace_once(
        text,
        marker,
        fatal_effect,
        "V13 runtime retry",
    )

    return text


def patch_native_player(text: str) -> str:
    if "BAOFLIX_V13_DIRECT_FATAL" in text:
        return text

    old_props = '''        controlsList={tvMode ? "nodownload nofullscreen noremoteplayback" : "nodownload"}
        className={['''

    new_props = '''        controlsList={tvMode ? "nodownload nofullscreen noremoteplayback" : "nodownload"}
        // BAOFLIX_V13_DIRECT_FATAL
        onError={() => {
          const currentSrc =
            videoRef.current?.currentSrc || src;

          setError(
            "Nguồn Native gặp lỗi. BảoFlix đang thử lại Drive..."
          );

          window.dispatchEvent(
            new CustomEvent(NATIVE_PLAYER_FATAL_EVENT, {
              detail: {
                progressKey,
                src: currentSrc || src,
              },
            })
          );
        }}
        onStalled={() => {
          setError(
            "Nguồn Drive đang phản hồi chậm, tiếp tục chờ dữ liệu..."
          );
        }}
        onCanPlay={() => {
          setError("");
        }}
        className={['''

    return replace_once(
        text,
        old_props,
        new_props,
        "V13 direct fatal recovery",
    )


def build(root: Path) -> dict[str, str]:
    return {
        "components/CustomDrivePlayer.tsx":
            patch_custom_drive_player(
                read(root / "components/CustomDrivePlayer.tsx")
            ),
        "components/NativeVideoPlayer.tsx":
            patch_native_player(
                read(root / "components/NativeVideoPlayer.tsx")
            ),
    }


def backup_files(root: Path, changed: list[str], backup_dir: Path) -> None:
    for rel in changed:
        src = root / rel
        dst = backup_dir / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def restore_files(root: Path, changed: list[str], backup_dir: Path) -> None:
    for rel in changed:
        saved = backup_dir / rel
        target = root / rel
        if saved.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(saved, target)


def run(root: Path, command: list[str]) -> int:
    print("$", " ".join(command))
    return subprocess.run(command, cwd=root).returncode


def main() -> int:
    parser = argparse.ArgumentParser(
        description="BảoFlix V13 Native-first Drive reliability"
    )
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    root = find_root(args.root)
    print("Repo:", root)

    package = json.loads(
        (root / "package.json").read_text(encoding="utf-8")
    )
    if package.get("name") != "baoflix":
        print("Cảnh báo package name:", repr(package.get("name")))

    patched = build(root)

    changed = [
        rel
        for rel, content in patched.items()
        if read(root / rel) != content
    ]

    if not changed:
        print("Không có thay đổi: V13 có thể đã được áp dụng.")
        return 0

    print("Sẽ sửa:")
    for rel in changed:
        print(" -", rel)

    if args.dry_run:
        print("Dry-run OK: marker khớp main hiện tại.")
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = (
        root.parent
        / f"{root.name}_patch_backups"
        / f"v13_native_first_{stamp}"
    )

    backup_files(root, changed, backup_dir)
    print("Backup:", backup_dir)

    try:
        for rel in changed:
            write(root / rel, patched[rel])

        print("Patch V13 hoàn tất.")

        if args.check:
            npm = "npm.cmd" if os.name == "nt" else "npm"

            lint_targets = [
                rel
                for rel in changed
                if Path(rel).suffix.lower()
                in {".ts", ".tsx", ".js", ".jsx", ".mts"}
            ]

            if lint_targets:
                if run(
                    root,
                    [npm, "exec", "--", "eslint", *lint_targets],
                ) != 0:
                    fail("Patched source lint failed")

            if run(root, [npm, "run", "build"]) != 0:
                fail("npm run build failed")

            print("Lint patched files + build: OK.")
        else:
            print("Nên chạy --check trước khi commit/push.")

        return 0

    except Exception as exc:
        print(f"Patch lỗi, rollback: {exc}", file=sys.stderr)
        restore_files(root, changed, backup_dir)
        print("Đã rollback.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"PATCH ABORTED: {exc}", file=sys.stderr)
        raise SystemExit(2)
