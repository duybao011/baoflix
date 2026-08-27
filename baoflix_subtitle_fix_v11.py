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


def patch_storage(text: str) -> str:
    if "BAOFLIX_V11_VERIFY_PUBLIC_SUBTITLE" in text:
        return text

    old = '''  const publicUrl = String(data?.publicUrl || "").trim();
  if (!publicUrl) {
    await supabase.storage.from(CUSTOM_SUBTITLE_BUCKET).remove([storagePath]).catch(() => undefined);
    throw new Error("Upload thành công nhưng không lấy được public URL.");
  }

  rememberPendingUpload(storagePath);'''

    new = '''  const publicUrl = String(data?.publicUrl || "").trim();
  if (!publicUrl) {
    await supabase.storage.from(CUSTOM_SUBTITLE_BUCKET).remove([storagePath]).catch(() => undefined);
    throw new Error("Upload thành công nhưng không lấy được public URL.");
  }

  // BAOFLIX_V11_VERIFY_PUBLIC_SUBTITLE
  // getPublicUrl() chỉ tạo URL; nó không xác nhận bucket thật sự đang public.
  try {
    const verifyResponse = await fetch(publicUrl, {
      cache: "no-store",
    });

    if (!verifyResponse.ok) {
      throw new Error(`HTTP ${verifyResponse.status}`);
    }
  } catch (error) {
    await supabase.storage
      .from(CUSTOM_SUBTITLE_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);

    const reason =
      error instanceof Error ? error.message : "fetch failed";

    throw new Error(
      `File đã upload nhưng public URL không đọc được (${reason}). ` +
      `Kiểm tra bucket "${CUSTOM_SUBTITLE_BUCKET}" phải bật Public.`
    );
  }

  rememberPendingUpload(storagePath);'''

    return replace_once(
        text,
        old,
        new,
        "verify Supabase public subtitle URL",
    )


def patch_drive_player(text: str) -> str:
    if "BAOFLIX_V11_SUBTITLE_NATIVE_PRIORITY" in text:
        return text

    text = replace_once(
        text,
        '''const PROBE_TIMEOUT_MS = 3500;
const PERSONAL_PROBE_TIMEOUT_MS = 1800;''',
        '''const PROBE_TIMEOUT_MS = 3500;
const PERSONAL_PROBE_TIMEOUT_MS = 1800;
// BAOFLIX_V11_SUBTITLE_NATIVE_PRIORITY
const SUBTITLE_DESKTOP_PROBE_TIMEOUT_MS = 8000;
const SUBTITLE_TV_PROBE_TIMEOUT_MS = 10000;''',
        "Drive subtitle probe constants",
    )

    text = replace_once(
        text,
        '''  const activeCandidate = directCandidates[candidateIndex] || "";

  useEffect(() => {''',
        '''  const activeCandidate = directCandidates[candidateIndex] || "";
  const hasExternalSubtitles = useMemo(
    () =>
      subtitles.some((track) =>
        Boolean(String(track?.url || "").trim())
      ),
    [subtitles]
  );

  useEffect(() => {''',
        "Drive hasExternalSubtitles",
    )

    text = replace_once(
        text,
        '''      if (mode !== "native" || subtitles.length === 0) return;

      const relayBase = String(''',
        '''      if (subtitles.length === 0) return;

      if (mode !== "native") {
        if (mode === "iframe") {
          setSubtitleLoadError(
            "Phụ đề đã lưu nhưng video đang chạy bằng Google Drive iframe. " +
              "Iframe Drive không nhận track phụ đề từ BảoFlix; cần Drive Relay/native player."
          );
        }
        return;
      }

      const relayBase = String(''',
        "Drive iframe subtitle explanation",
    )

    text = replace_once(
        text,
        '''    if (!fileId || directCandidates.length === 0) {
      setMode("iframe");
      setFallbackReason(
        "Không lấy được file ID từ link Drive, đang dùng player Drive dự phòng."
      );
      return;
    }

    // BAOFLIX_PERF_PHASE1: relay vừa timeout thì đừng bắt tập kế tiếp chờ lại.
    if (isDriveRelayCoolingDown()) {
      setMode("iframe");
      setFallbackReason(
        "Drive Relay vừa phản hồi chậm, tạm dùng iframe để vào phim nhanh hơn."
      );
      return;
    }

    setMode("probing");
  }, [directCandidates.length, fileId, src, tvMode]);''',
        '''    if (!fileId) {
      setMode("iframe");
      setFallbackReason(
        "Không lấy được file ID từ link Drive, đang dùng player Drive dự phòng."
      );
      return;
    }

    if (directCandidates.length === 0) {
      setMode("iframe");
      setFallbackReason(
        hasExternalSubtitles
          ? "Thiếu NEXT_PUBLIC_DRIVE_RELAY_URL nên Drive đang chạy iframe. Phụ đề ngoài cần Native/Drive Relay."
          : "Không có Drive Relay, đang dùng player Drive dự phòng."
      );
      return;
    }

    if (isDriveRelayCoolingDown() && !hasExternalSubtitles) {
      setMode("iframe");
      setFallbackReason(
        "Drive Relay vừa phản hồi chậm, tạm dùng iframe để vào phim nhanh hơn."
      );
      return;
    }

    setMode("probing");
  }, [
    directCandidates.length,
    fileId,
    hasExternalSubtitles,
    src,
    tvMode,
  ]);''',
        "Drive native priority",
    )

    text = replace_once(
        text,
        '''    const timeout = window.setTimeout(() => {
      tryNextCandidate("Nguồn direct tải quá lâu.", true);
    }, tvMode ? PROBE_TIMEOUT_MS : PERSONAL_PROBE_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [activeCandidate, mode, tvMode]);''',
        '''    const timeoutMs = hasExternalSubtitles
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
    }, timeoutMs);

    return () => window.clearTimeout(timeout);
  }, [
    activeCandidate,
    hasExternalSubtitles,
    mode,
    tvMode,
  ]);''',
        "Drive subtitle-aware timeout",
    )

    text = replace_once(
        text,
        '''    setMode("iframe");
    setFallbackReason(
      "Drive Relay không trả về video native. Đã chuyển sang iframe dự phòng."
    );''',
        '''    setMode("iframe");
    setFallbackReason(
      hasExternalSubtitles
        ? "Drive Relay không trả về video native. Video đã chuyển sang iframe nên phụ đề ngoài không thể hiển thị."
        : "Drive Relay không trả về video native. Đã chuyển sang iframe dự phòng."
    );''',
        "Drive iframe fallback reason",
    )

    text = replace_once(
        text,
        '''      {tvMode && subtitleLoadError && (
        <div className="pointer-events-none absolute left-1/2 top-[18%] z-20 max-w-[70vw] -translate-x-1/2 rounded-xl border border-yellow-300/20 bg-black/75 px-4 py-2 text-center text-xs font-bold text-yellow-100 shadow-xl backdrop-blur">
          {subtitleLoadError}
        </div>
      )}''',
        '''      {subtitleLoadError && (
        <div className="pointer-events-none absolute left-1/2 top-[18%] z-20 max-w-[88vw] -translate-x-1/2 rounded-xl border border-yellow-300/20 bg-black/80 px-4 py-2 text-center text-xs font-bold text-yellow-100 shadow-xl backdrop-blur">
          {subtitleLoadError}
        </div>
      )}''',
        "Show subtitle errors everywhere",
    )

    return text


def patch_native_player(text: str) -> str:
    if "BAOFLIX_V11_TRACK_ONLOAD_SYNC" in text:
        return text

    old = '''            srcLang={track.lang || "vi"}
            label={track.label || `Phụ đề ${index + 1}`}
            default={Boolean(track.default && index === 0)}
          />'''

    new = '''            srcLang={track.lang || "vi"}
            label={track.label || `Phụ đề ${index + 1}`}
            default={Boolean(track.default && index === 0)}
            // BAOFLIX_V11_TRACK_ONLOAD_SYNC
            onLoad={() => {
              window.setTimeout(() => {
                applySubtitleMode(activeSubtitleIndex);
              }, 0);
            }}
          />'''

    return replace_once(
        text,
        old,
        new,
        "Native track onLoad sync",
    )


def build(root: Path) -> dict[str, str]:
    return {
        "lib/customSubtitleStorage.ts": patch_storage(
            read(root / "lib/customSubtitleStorage.ts")
        ),
        "components/CustomDrivePlayer.tsx": patch_drive_player(
            read(root / "components/CustomDrivePlayer.tsx")
        ),
        "components/NativeVideoPlayer.tsx": patch_native_player(
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
        description="BảoFlix V11 subtitle reliability fix"
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
        print("Không có thay đổi: V11 có thể đã được áp dụng.")
        return 0

    print("Sẽ sửa:")
    for rel in changed:
        print(" -", rel)

    if args.dry_run:
        print("Dry-run OK: marker khớp source hiện tại.")
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = (
        root.parent
        / f"{root.name}_patch_backups"
        / f"v11_subtitle_{stamp}"
    )

    backup_files(root, changed, backup_dir)
    print("Backup:", backup_dir)

    try:
        for rel in changed:
            write(root / rel, patched[rel])

        print("Patch V11 hoàn tất.")

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
            print("Nên chạy lại với --check trước khi commit/push.")

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
