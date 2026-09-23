#!/usr/bin/env python3
"""Add native-video frame capture to BảoFlix without touching Git.

Run from the BảoFlix repository root:
  py baoflix_video_screenshot_v1_patch.py --dry-run
  py baoflix_video_screenshot_v1_patch.py
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from datetime import datetime
from pathlib import Path


# Giữ thông báo tiếng Việt ổn định trên Windows PowerShell/cmd.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


PATCH_MARKER = "// BAOFLIX_VIDEO_SCREENSHOT_V1"
TARGET_RELATIVE_PATH = Path("components") / "NativeVideoPlayer.tsx"


STATE_ANCHOR = """  const [isFullscreen, setIsFullscreen] = useState(false);
  const [subtitleAppearance, setSubtitleAppearance] =
    useState<SubtitleAppearance>(DEFAULT_SUBTITLE_APPEARANCE);
"""

STATE_REPLACEMENT = """  const [isFullscreen, setIsFullscreen] = useState(false);
  const [screenshotNotice, setScreenshotNotice] = useState(\"\");
  const screenshotNoticeTimerRef = useRef<number | null>(null);
  const [subtitleAppearance, setSubtitleAppearance] =
    useState<SubtitleAppearance>(DEFAULT_SUBTITLE_APPEARANCE);
"""

RETURN_ANCHOR = """  return (
    <div
      ref={playerShellRef}
"""

RETURN_REPLACEMENT = """  // BAOFLIX_VIDEO_SCREENSHOT_V1
  const showScreenshotNotice = useCallback((message: string) => {
    setScreenshotNotice(message);

    if (screenshotNoticeTimerRef.current !== null) {
      window.clearTimeout(screenshotNoticeTimerRef.current);
    }

    screenshotNoticeTimerRef.current = window.setTimeout(() => {
      setScreenshotNotice(\"\");
      screenshotNoticeTimerRef.current = null;
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (screenshotNoticeTimerRef.current !== null) {
        window.clearTimeout(screenshotNoticeTimerRef.current);
      }
    };
  }, []);

  const captureVideoFrame = useCallback(() => {
    const video = videoRef.current;

    if (
      !video ||
      video.readyState < 2 ||
      video.videoWidth < 1 ||
      video.videoHeight < 1
    ) {
      showScreenshotNotice(\"Phim chưa sẵn sàng để chụp.\");
      return;
    }

    const canvas = document.createElement(\"canvas\");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext(\"2d\");
    if (!context) {
      showScreenshotNotice(\"Trình duyệt không hỗ trợ chụp ảnh.\");
      return;
    }

    try {
      // Chỉ vẽ pixel video: không kèm phụ đề, nút điều khiển hay overlay.
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) {
          showScreenshotNotice(\"Không thể tạo ảnh từ nguồn phim này.\");
          return;
        }

        const safeTitle = title
          .normalize(\"NFD\")
          .replace(/[\\u0300-\\u036f]/g, \"\")
          .replace(/đ/g, \"d\")
          .replace(/Đ/g, \"D\")
          .replace(/[^a-zA-Z0-9]+/g, \"-\")
          .replace(/^-+|-+$/g, \"\")
          .slice(0, 80)
          .toLowerCase();
        const capturedAt = new Date()
          .toISOString()
          .replace(/\\.\\d{3}Z$/, \"\")
          .replace(/[T:]/g, \"-\");
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement(\"a\");

        link.href = objectUrl;
        link.download = `baoflix-${safeTitle || \"phim\"}-${capturedAt}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        showScreenshotNotice(\"Đã lưu ảnh khung hình.\");
      }, \"image/png\");
    } catch {
      // Canvas bị khóa khi máy chủ video không cho phép đọc pixel qua CORS.
      showScreenshotNotice(\"Nguồn phim này không cho phép chụp ảnh.\");
    }
  }, [showScreenshotNotice, title]);

  return (
    <div
      ref={playerShellRef}
"""

BUTTON_ANCHOR = """          <button
            type=\"button\"
            onClick={() => void togglePlayerFullscreen()}
"""

BUTTON_REPLACEMENT = """          <button
            type=\"button\"
            onClick={captureVideoFrame}
            className=\"rounded-xl border border-white/15 bg-black/65 p-2 text-white shadow-xl backdrop-blur hover:bg-black/85\"
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

          <button
            type=\"button\"
            onClick={() => void togglePlayerFullscreen()}
"""

NOTICE_ANCHOR = """      {error && (
        <div className=\"pointer-events-none absolute left-1/2 top-[12%] z-20 max-w-[70vw] -translate-x-1/2 rounded-2xl bg-black/72 px-4 py-3 text-center text-sm font-bold text-yellow-100 shadow-2xl backdrop-blur\">
"""

NOTICE_REPLACEMENT = """      {screenshotNotice && !tvMode && (
        <div
          aria-live=\"polite\"
          className=\"pointer-events-none absolute left-3 top-3 z-40 max-w-[70vw] rounded-xl bg-black/75 px-3 py-2 text-sm font-bold text-white shadow-2xl backdrop-blur\"
        >
          {screenshotNotice}
        </div>
      )}

      {error && (
        <div className=\"pointer-events-none absolute left-1/2 top-[12%] z-20 max-w-[70vw] -translate-x-1/2 rounded-2xl bg-black/72 px-4 py-3 text-center text-sm font-bold text-yellow-100 shadow-2xl backdrop-blur\">
"""


class PatchError(RuntimeError):
    pass


def detect_newline(raw: bytes) -> str:
    return "\r\n" if b"\r\n" in raw else "\n"


def decode_source(raw: bytes) -> tuple[str, bool]:
    has_bom = raw.startswith(b"\xef\xbb\xbf")
    payload = raw[3:] if has_bom else raw
    try:
        return payload.decode("utf-8"), has_bom
    except UnicodeDecodeError as exc:
        raise PatchError("NativeVideoPlayer.tsx không phải UTF-8.") from exc


def encode_source(text: str, has_bom: bool) -> bytes:
    encoded = text.encode("utf-8")
    return (b"\xef\xbb\xbf" + encoded) if has_bom else encoded


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise PatchError(
            f"Không tìm thấy điểm chèn an toàn cho {label} (số lần khớp: {count}). "
            "File có thể khác phiên bản tương thích; patcher đã dừng và không ghi gì."
        )
    return source.replace(old, new, 1)


def validate_existing_patch(source: str) -> None:
    required = (
        PATCH_MARKER,
        "const captureVideoFrame = useCallback(() => {",
        'aria-label="Chụp khung hình phim"',
        "context.drawImage(video, 0, 0, canvas.width, canvas.height);",
        "screenshotNotice && !tvMode",
    )
    missing = [item for item in required if item not in source]
    if missing:
        raise PatchError(
            "Phát hiện patch chụp ảnh dang dở hoặc đã bị sửa tay. "
            "Hãy khôi phục backup trước khi chạy lại."
        )


def build_patched_source(source: str) -> str:
    if PATCH_MARKER in source:
        validate_existing_patch(source)
        return source

    if 'aria-label="Chụp khung hình phim"' in source:
        raise PatchError(
            "Đã có nút chụp ảnh không thuộc patch V1; patcher dừng để tránh chèn trùng."
        )

    patched = replace_once(
        source, STATE_ANCHOR, STATE_REPLACEMENT, "state chụp ảnh"
    )
    patched = replace_once(
        patched, RETURN_ANCHOR, RETURN_REPLACEMENT, "hàm chụp frame"
    )
    patched = replace_once(
        patched, BUTTON_ANCHOR, BUTTON_REPLACEMENT, "nút chụp ảnh"
    )
    patched = replace_once(
        patched, NOTICE_ANCHOR, NOTICE_REPLACEMENT, "thông báo chụp ảnh"
    )

    validate_existing_patch(patched)

    # Các bất biến bảo vệ TV Mode: không sửa video attributes hay điều kiện overlay.
    if patched.count("{!tvMode && (") != source.count("{!tvMode && ("):
        raise PatchError("Kiểm tra bảo vệ TV Mode thất bại; patcher không ghi gì.")
    if 'data-tv-player={tvMode ? "native-video" : undefined}' not in patched:
        raise PatchError("Không còn nhận diện được player TV; patcher không ghi gì.")

    return patched


def make_backup(target: Path, root: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = root / ".baoflix_patch_backups" / f"video-screenshot-v1-{stamp}"
    suffix = 1
    while backup_dir.exists():
        backup_dir = root / ".baoflix_patch_backups" / (
            f"video-screenshot-v1-{stamp}-{suffix}"
        )
        suffix += 1

    backup_target = backup_dir / TARGET_RELATIVE_PATH
    backup_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target, backup_target)
    return backup_target


def atomic_write(target: Path, payload: bytes) -> None:
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", delete=False, dir=target.parent, prefix=".baoflix-shot-"
        ) as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
            temp_path = Path(handle.name)
        os.replace(temp_path, target)
    finally:
        if temp_path is not None and temp_path.exists():
            temp_path.unlink()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Thêm nút chụp frame video native cho BảoFlix."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Chỉ kiểm tra tương thích, không tạo backup và không sửa file.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Thư mục gốc BảoFlix (mặc định: thư mục hiện tại).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.expanduser().resolve()
    target = root / TARGET_RELATIVE_PATH

    print("BảoFlix Video Screenshot V1")
    print(f"Root: {root}")
    print(f"File: {target}")
    print("Git: không commit, không push, không chạy lệnh Git")

    if not (root / "package.json").is_file():
        raise PatchError("Không thấy package.json. Hãy chạy file từ root dự án BảoFlix.")
    if not target.is_file():
        raise PatchError(f"Không thấy {TARGET_RELATIVE_PATH}.")

    raw = target.read_bytes()
    newline = detect_newline(raw)
    source, has_bom = decode_source(raw)
    normalized = source.replace("\r\n", "\n")
    patched = build_patched_source(normalized)

    if patched == normalized:
        print("OK: Video Screenshot V1 đã có đầy đủ; không cần sửa gì.")
        return 0

    print("Sẽ thêm:")
    print("- Nút camera cho player native trên PC/mobile")
    print("- Ảnh PNG đúng độ phân giải frame video, không kèm sub/overlay")
    print("- Thông báo thân thiện khi nguồn phim chặn chụp ảnh")
    print("- Không thay đổi TV Mode, iframe, nguồn phát hoặc logic phụ đề")

    if args.dry_run:
        print("DRY-RUN OK: file tương thích; chưa ghi hoặc backup bất kỳ file nào.")
        return 0

    backup_target = make_backup(target, root)
    output = patched.replace("\n", newline)
    atomic_write(target, encode_source(output, has_bom))
    print(f"Backup: {backup_target}")
    print("APPLY OK: đã thêm chức năng chụp khung hình.")
    print("Tiếp theo nên chạy: npm run lint")
    print("Và kiểm tra build: npm run build")
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
