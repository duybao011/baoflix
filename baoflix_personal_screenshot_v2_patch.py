#!/usr/bin/env python3
"""Enable frame-only screenshots for BảoFlix personal Drive and HLS movies.

Run from the BảoFlix project root:
    py baoflix_personal_screenshot_v2_patch.py --dry-run
    py baoflix_personal_screenshot_v2_patch.py

This patcher never runs Git commands and never contacts a server.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from datetime import datetime
from pathlib import Path


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


NATIVE_FILE = Path("components/NativeVideoPlayer.tsx")
DRIVE_FILE = Path("components/CustomDrivePlayer.tsx")
HLS_FILE = Path("components/HlsPlayer.tsx")
FILES = (NATIVE_FILE, DRIVE_FILE, HLS_FILE)

NATIVE_MARKER = "// BAOFLIX_PERSONAL_SCREENSHOT_V2_NATIVE"
DRIVE_MARKER = "// BAOFLIX_PERSONAL_SCREENSHOT_V2_DRIVE"
HLS_MARKER = "// BAOFLIX_PERSONAL_SCREENSHOT_V2_HLS"
MARKERS = {
    NATIVE_FILE: NATIVE_MARKER,
    DRIVE_FILE: DRIVE_MARKER,
    HLS_FILE: HLS_MARKER,
}


class PatchError(RuntimeError):
    pass


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise PatchError(
            f"Điểm chèn {label} không khớp bản BảoFlix hiện tại ({count} lần). "
            "Chưa có file nào bị sửa."
        )
    return source.replace(before, after, 1)


def patch_native(source: str) -> str:
    if "// BAOFLIX_VIDEO_SCREENSHOT_V1" not in source:
        raise PatchError(
            "NativeVideoPlayer.tsx chưa có bản chụp ảnh V1. "
            "Hãy cài patch chụp ảnh V1 trước."
        )

    source = replace_once(
        source,
        "  tvMode?: boolean;\n};",
        "  tvMode?: boolean;\n  captureCors?: boolean;\n};",
        "prop CORS của player native",
    )
    source = replace_once(
        source,
        "  subtitleTracks = EMPTY_SUBTITLE_TRACKS,\n  tvMode = false,\n}: NativeVideoPlayerProps) {",
        "  subtitleTracks = EMPTY_SUBTITLE_TRACKS,\n  tvMode = false,\n  captureCors = false,\n}: NativeVideoPlayerProps) {",
        "tham số CORS của player native",
    )
    source = replace_once(
        source,
        "      <video\n        ref={videoRef}\n        data-tv-player={tvMode ? \"native-video\" : undefined}",
        f"      <video\n        ref={{videoRef}}\n"
        f"        {NATIVE_MARKER}\n"
        "        crossOrigin={captureCors && !tvMode ? \"anonymous\" : undefined}\n"
        "        data-tv-player={tvMode ? \"native-video\" : undefined}",
        "thuộc tính CORS trước khi video tải nguồn",
    )
    return source


def patch_drive(source: str) -> str:
    source = replace_once(
        source,
        "  const [nativeSrc, setNativeSrc] = useState(\"\");\n"
        "  const [iframeSrc, setIframeSrc] = useState(src);",
        "  const [nativeSrc, setNativeSrc] = useState(\"\");\n"
        f"  {DRIVE_MARKER}\n"
        "  const [captureCorsEnabled, setCaptureCorsEnabled] = useState(true);\n"
        "  const [iframeSrc, setIframeSrc] = useState(src);",
        "state CORS của Drive",
    )
    source = replace_once(
        source,
        "    setCandidateIndex(0);\n    setNativeSrc(\"\");\n    setFallbackReason(\"\");",
        "    setCandidateIndex(0);\n    setNativeSrc(\"\");\n"
        "    setCaptureCorsEnabled(true);\n    setFallbackReason(\"\");",
        "reset CORS khi đổi phim",
    )
    source = replace_once(
        source,
        "      const nextIndex = candidateIndex + 1;",
        "      // Nếu một relay khác chặn CORS, phát lại nguồn cũ không CORS.\n"
        "      if (!tvMode && captureCorsEnabled && detail?.reason === \"media-error\") {\n"
        "        setCaptureCorsEnabled(false);\n"
        "        return;\n"
        "      }\n\n"
        "      const nextIndex = candidateIndex + 1;",
        "fallback phát Drive khi CORS bị chặn",
    )
    source = replace_once(
        source,
        "    candidateIndex,\n    directCandidates,\n    mode,\n"
        "    nativeSrc,\n    progressKey,\n  ]);",
        "    candidateIndex,\n    captureCorsEnabled,\n    directCandidates,\n"
        "    mode,\n    nativeSrc,\n    progressKey,\n    tvMode,\n  ]);",
        "dependencies của fallback Drive",
    )
    source = replace_once(
        source,
        "          key={`${fileId}:${candidateIndex}`}\n          src={nativeSrc}",
        "          key={`${fileId}:${candidateIndex}:${captureCorsEnabled ? \"capture\" : \"play\"}`}\n"
        "          src={nativeSrc}",
        "remount player khi fallback CORS",
    )
    source = replace_once(
        source,
        "          tvMode={tvMode}\n          subtitleTracks={resolvedSubtitleTracks}",
        "          tvMode={tvMode}\n"
        "          captureCors={!tvMode && captureCorsEnabled}\n"
        "          subtitleTracks={resolvedSubtitleTracks}",
        "bật CORS riêng cho Drive phim riêng trên PC/mobile",
    )
    return source


HLS_CAPTURE_CODE = """  // BAOFLIX_PERSONAL_SCREENSHOT_V2_HLS
  function showCaptureNotice(message: string) {
    setCaptureNotice(message);
    if (captureNoticeTimerRef.current !== null) {
      window.clearTimeout(captureNoticeTimerRef.current);
    }
    captureNoticeTimerRef.current = window.setTimeout(() => {
      setCaptureNotice(\"\");
      captureNoticeTimerRef.current = null;
    }, 2600);
  }

  function captureVideoFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      showCaptureNotice(\"Phim chưa sẵn sàng để chụp.\");
      return;
    }

    const canvas = document.createElement(\"canvas\");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext(\"2d\");
    if (!context) {
      showCaptureNotice(\"Trình duyệt không hỗ trợ chụp ảnh.\");
      return;
    }

    try {
      // Chỉ xuất pixel của video; không vẽ sub hoặc nút điều khiển.
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          showCaptureNotice(\"Không thể tạo ảnh từ nguồn phim này.\");
          return;
        }

        const capturedAt = new Date()
          .toISOString()
          .replace(/\\.\\d{3}Z$/, \"\")
          .replace(/[T:]/g, \"-\");
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement(\"a\");
        link.href = objectUrl;
        link.download = `baoflix-phim-rieng-${capturedAt}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        showCaptureNotice(\"Đã lưu ảnh khung hình.\");
      }, \"image/png\");
    } catch {
      showCaptureNotice(\"Nguồn phim này không cho phép chụp ảnh.\");
    }
  }

"""


HLS_RETURN_BEFORE = """  return (
    <video
      ref={videoRef}
      controls
      playsInline
      tabIndex={0}
      data-tv-player=\"video\"
      data-tv-skip
      className=\"h-full w-full bg-black object-contain outline-none\"
    />
  );
}"""

HLS_RETURN_AFTER = """  return (
    <div className=\"relative h-full w-full bg-black\">
      <video
        ref={videoRef}
        controls
        playsInline
        tabIndex={0}
        data-tv-player=\"video\"
        data-tv-skip
        className=\"h-full w-full bg-black object-contain outline-none\"
      />

      {!tvMode && (
        <button
          type=\"button\"
          onClick={captureVideoFrame}
          className=\"absolute right-3 top-3 z-30 rounded-xl border border-white/15 bg-black/65 p-2 text-white shadow-xl backdrop-blur hover:bg-black/85\"
          aria-label=\"Chụp khung hình phim\"
          title=\"Chụp khung hình phim\"
        >
          <svg
            aria-hidden=\"true\"
            viewBox=\"0 0 24 24\"
            className=\"h-4 w-4\"
            fill=\"none\"
            stroke=\"currentColor\"
            strokeWidth=\"2\"
            strokeLinecap=\"round\"
            strokeLinejoin=\"round\"
          >
            <path d=\"M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3h5Z\" />
            <circle cx=\"12\" cy=\"13\" r=\"3\" />
          </svg>
        </button>
      )}

      {captureNotice && !tvMode && (
        <div
          aria-live=\"polite\"
          className=\"pointer-events-none absolute left-3 top-3 z-40 max-w-[70vw] rounded-xl bg-black/75 px-3 py-2 text-sm font-bold text-white shadow-2xl backdrop-blur\"
        >
          {captureNotice}
        </div>
      )}
    </div>
  );
}"""


def patch_hls(source: str) -> str:
    source = replace_once(
        source,
        'import { useEffect, useRef } from "react";',
        'import { useEffect, useRef, useState } from "react";\n'
        'import { isTvModeActive } from "@/lib/tvMode";',
        "imports của HLS",
    )
    source = replace_once(
        source,
        '  const lastAppliedUpdatedAtRef = useRef("");\n\n  useEffect(() => {',
        '  const lastAppliedUpdatedAtRef = useRef("");\n'
        '  const captureNoticeTimerRef = useRef<number | null>(null);\n'
        '  const [captureNotice, setCaptureNotice] = useState("");\n'
        '  const [tvMode, setTvMode] = useState(false);\n\n'
        '  useEffect(() => {\n'
        '    function refreshTvMode() {\n'
        '      setTvMode(isTvModeActive({ allowSessionOnDesktop: false }));\n'
        '    }\n\n'
        '    refreshTvMode();\n'
        '    window.addEventListener("baoflix-tv-mode-change", refreshTvMode);\n'
        '    window.addEventListener("storage", refreshTvMode);\n'
        '    window.addEventListener("focus", refreshTvMode);\n\n'
        '    return () => {\n'
        '      window.removeEventListener("baoflix-tv-mode-change", refreshTvMode);\n'
        '      window.removeEventListener("storage", refreshTvMode);\n'
        '      window.removeEventListener("focus", refreshTvMode);\n'
        '      if (captureNoticeTimerRef.current !== null) {\n'
        '        window.clearTimeout(captureNoticeTimerRef.current);\n'
        '      }\n'
        '    };\n'
        '  }, []);\n\n'
        '  useEffect(() => {',
        "state và TV guard của HLS",
    )
    source = replace_once(
        source,
        '  }, [src, storageKey, autoResume]);\n\n  return (',
        '  }, [src, storageKey, autoResume]);\n\n' + HLS_CAPTURE_CODE + '  return (',
        "hàm chụp frame của HLS",
    )
    source = replace_once(
        source, HLS_RETURN_BEFORE, HLS_RETURN_AFTER, "nút chụp HLS"
    )
    return source


PATCHERS = {
    NATIVE_FILE: patch_native,
    DRIVE_FILE: patch_drive,
    HLS_FILE: patch_hls,
}


def decode_file(raw: bytes, path: Path) -> tuple[str, str, bool]:
    has_bom = raw.startswith(b"\xef\xbb\xbf")
    payload = raw[3:] if has_bom else raw
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise PatchError(f"{path} không phải UTF-8.") from exc
    newline = "\r\n" if b"\r\n" in payload else "\n"
    return text.replace("\r\n", "\n"), newline, has_bom


def encode_file(text: str, newline: str, has_bom: bool) -> bytes:
    body = text.replace("\n", newline).encode("utf-8")
    return (b"\xef\xbb\xbf" + body) if has_bom else body


def atomic_write(path: Path, content: bytes) -> None:
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", delete=False, dir=path.parent, prefix=".baoflix-shot-v2-"
        ) as temp:
            temp.write(content)
            temp.flush()
            os.fsync(temp.fileno())
            temp_path = Path(temp.name)
        os.replace(temp_path, path)
    finally:
        if temp_path is not None and temp_path.exists():
            temp_path.unlink()


def backup_files(root: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = root / ".baoflix_patch_backups" / f"personal-screenshot-v2-{stamp}"
    suffix = 1
    while backup_dir.exists():
        backup_dir = root / ".baoflix_patch_backups" / (
            f"personal-screenshot-v2-{stamp}-{suffix}"
        )
        suffix += 1
    for relative in FILES:
        destination = backup_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / relative, destination)
    return backup_dir


def read_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Thêm chụp ảnh frame cho phim riêng Drive native và HLS."
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Kiểm tra mà không sửa file."
    )
    parser.add_argument(
        "--root", type=Path, default=Path.cwd(), help="Root của dự án BảoFlix."
    )
    return parser.parse_args()


def main() -> int:
    args = read_arguments()
    root = args.root.expanduser().resolve()
    if not (root / "package.json").is_file():
        raise PatchError("Không thấy package.json; hãy chạy từ root BảoFlix.")
    for relative in FILES:
        if not (root / relative).is_file():
            raise PatchError(f"Không thấy {relative}.")

    originals: dict[Path, bytes] = {}
    prepared: dict[Path, bytes] = {}
    markers_found: dict[Path, bool] = {}

    for relative in FILES:
        raw = (root / relative).read_bytes()
        source, newline, has_bom = decode_file(raw, relative)
        originals[relative] = raw
        markers_found[relative] = MARKERS[relative] in source
        if not markers_found[relative]:
            patched = PATCHERS[relative](source)
            if patched.count(MARKERS[relative]) != 1:
                raise PatchError(f"Kiểm tra marker thất bại: {relative}.")
            prepared[relative] = encode_file(patched, newline, has_bom)

    if any(markers_found.values()):
        if not all(markers_found.values()):
            raise PatchError(
                "V2 đã được cài một phần. Patcher dừng để tránh ghi đè; "
                "hãy kiểm tra backup hoặc các file đã sửa."
            )
        expected = {
            NATIVE_FILE: 'crossOrigin={captureCors && !tvMode ? "anonymous" : undefined}',
            DRIVE_FILE: 'captureCors={!tvMode && captureCorsEnabled}',
            HLS_FILE: 'aria-label="Chụp khung hình phim"',
        }
        for relative, fragment in expected.items():
            if fragment.encode("utf-8") not in originals[relative]:
                raise PatchError(f"V2 trong {relative} không đầy đủ; cần kiểm tra tay.")
        print("OK: V2 đã cài đầy đủ; không ghi đè hay tạo backup.")
        return 0

    print("BảoFlix Personal Screenshot V2")
    print(f"Root: {root}")
    print("Thay đổi: phim riêng Drive native + HLS chụp frame PNG trên PC/mobile.")
    print("TV Mode và Drive iframe giữ nguyên; nếu CORS lỗi, Drive phát lại như cũ.")
    print("Git: không commit, không push, không chạy lệnh Git.")

    if args.dry_run:
        print("DRY-RUN OK: 3 file tương thích, chưa sửa gì.")
        return 0

    backup_dir = backup_files(root)
    written: list[Path] = []
    try:
        for relative in FILES:
            atomic_write(root / relative, prepared[relative])
            written.append(relative)
    except OSError as exc:
        restore_errors: list[str] = []
        for relative in written:
            try:
                atomic_write(root / relative, originals[relative])
            except OSError as restore_exc:
                restore_errors.append(f"{relative}: {restore_exc}")
        if restore_errors:
            raise PatchError(
                f"Ghi file lỗi: {exc}. Khôi phục chưa hết: "
                + "; ".join(restore_errors)
                + f". Backup: {backup_dir}"
            ) from exc
        raise PatchError(
            f"Ghi file lỗi: {exc}. Đã khôi phục các file đã ghi. Backup: {backup_dir}"
        ) from exc

    print(f"Backup: {backup_dir}")
    print("APPLY OK: đã thêm chụp frame cho phim riêng.")
    print("Kiểm tra tiếp: npm run lint; npm run build")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except PatchError as exc:
        print(f"LỖI: {exc}", file=sys.stderr)
        raise SystemExit(1)
    except OSError as exc:
        print(f"LỖI hệ thống file: {exc}", file=sys.stderr)
        raise SystemExit(1)
