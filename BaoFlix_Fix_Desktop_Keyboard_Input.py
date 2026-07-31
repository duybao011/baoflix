#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BảoFlix - sửa lỗi bàn phím máy tính nhập chữ được chữ mất.

Nguyên nhân: TvRemoteKeyBridge dùng keyCode của bàn phím máy tính làm mã Android TV.
Một số chữ bị nhầm thành phím remote, ví dụ B=66 (Enter), R=82 (Menu),
U=85 (Play/Pause), W=87, X=88, Y=89, Z=90.

Phạm vi:
- Chỉ sửa components/TvRemoteKeyBridge.tsx.
- Không sửa TvRemoteNavigator, overlay, player hoặc bàn phím TV ảo.
- Giữ nguyên sự kiện native baoflix-native-remote-key.

Cách dùng:
    python BaoFlix_Fix_Desktop_Keyboard_Input.py
    python BaoFlix_Fix_Desktop_Keyboard_Input.py --repo D:\\duong-dan\\baoflix
    python BaoFlix_Fix_Desktop_Keyboard_Input.py --dry-run
    python BaoFlix_Fix_Desktop_Keyboard_Input.py --verify
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

TARGET_PATH = Path("components/TvRemoteKeyBridge.tsx")
PATCH_MARKER = "function shouldUseLegacyAndroidKeyCode"


class PatchError(RuntimeError):
    pass


def find_repo_root(start: Path) -> Path:
    start = start.expanduser().resolve()
    for candidate in (start, *start.parents):
        if (candidate / "package.json").is_file() and (candidate / TARGET_PATH).is_file():
            return candidate
    raise PatchError(
        "Không tìm thấy repo BảoFlix. Đặt file cạnh package.json hoặc chạy với --repo DUONG_DAN."
    )


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0:
        raise PatchError(
            f"Không tìm thấy đoạn mã cần vá: {label}. Repo có thể đã đổi; script dừng để tránh sửa nhầm."
        )
    if count > 1:
        raise PatchError(
            f"Đoạn mã '{label}' xuất hiện {count} lần; script dừng để tránh sửa nhầm."
        )
    return text.replace(old, new, 1)


def patch_bridge(text: str) -> tuple[str, list[str]]:
    if PATCH_MARKER in text:
        return text, ["TvRemoteKeyBridge đã có bản sửa bàn phím; không vá lại."]

    old_input_guard = '''function shouldLetTextInputHandle(event: KeyboardEvent) {
  const active = document.activeElement;

  if (!(active instanceof HTMLElement)) return false;

  const tagName = active.tagName.toLowerCase();
  const isTextInput =
    tagName === "input" || tagName === "textarea" || active.isContentEditable;

  if (!isTextInput) return false;

  return event.key === "ArrowLeft" || event.key === "ArrowRight";
}'''

    new_input_guard = '''function shouldLetEditableHandle(event: KeyboardEvent) {
  const active = document.activeElement;

  if (!(active instanceof HTMLElement)) return false;

  if (event.isComposing || event.key === "Process" || event.keyCode === 229) {
    return true;
  }

  if (active.isContentEditable) return true;

  if (active instanceof HTMLTextAreaElement) {
    return !active.readOnly && !active.disabled;
  }

  if (active instanceof HTMLInputElement) {
    const nonTextTypes = new Set([
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "image",
      "radio",
      "range",
      "reset",
      "submit",
    ]);

    if (nonTextTypes.has(active.type)) return false;
    return !active.readOnly && !active.disabled;
  }

  return false;
}'''

    text = replace_once(
        text,
        old_input_guard,
        new_input_guard,
        "cho ô nhập và bộ gõ xử lý phím trực tiếp",
    )

    old_mapper = '''function getMappedKeyFromKeyboardEvent(event: KeyboardEvent) {
  const alias = WEB_KEY_ALIASES[event.key];

  if (alias) {
    return {
      key: alias,
      keyCode: getAndroidKeyCode(event),
    };
  }

  const keyCode = getAndroidKeyCode(event);
  const mappedKey = ANDROID_TV_KEY_TO_WEB_KEY[keyCode];

  if (!mappedKey) return null;

  return {
    key: mappedKey,
    keyCode,
  };
}'''

    new_mapper = '''function shouldUseLegacyAndroidKeyCode(event: KeyboardEvent) {
  const key = String(event.key || "");

  // Bàn phím máy tính có event.key rõ ràng ("b", "r", "u"...).
  // Chỉ fallback sang keyCode khi TV/WebView không cung cấp tên phím.
  return key === "" || key === "Unidentified";
}

function getMappedKeyFromKeyboardEvent(event: KeyboardEvent) {
  const alias = WEB_KEY_ALIASES[event.key];

  if (alias) {
    return {
      key: alias,
      keyCode: getAndroidKeyCode(event),
    };
  }

  if (!shouldUseLegacyAndroidKeyCode(event)) return null;

  const keyCode = getAndroidKeyCode(event);
  const mappedKey = ANDROID_TV_KEY_TO_WEB_KEY[keyCode];

  if (!mappedKey) return null;

  return {
    key: mappedKey,
    keyCode,
  };
}'''

    text = replace_once(
        text,
        old_mapper,
        new_mapper,
        "chỉ dùng keyCode fallback cho phím TV không xác định",
    )

    text = replace_once(
        text,
        '''      if (remoteEvent.__baoflixSyntheticRemoteKey) return;
      if (shouldLetTextInputHandle(event)) return;

      if (WEB_KEYS_ALREADY_OK.has(event.key)) return;''',
        '''      if (remoteEvent.__baoflixSyntheticRemoteKey) return;
      if (shouldLetEditableHandle(event)) return;

      if (WEB_KEYS_ALREADY_OK.has(event.key)) return;''',
        "đổi guard trong handleKeyDown",
    )

    if PATCH_MARKER not in text:
        raise PatchError("Không tìm thấy marker xác nhận sau khi vá.")

    return text, [
        "Ô input/textarea/contenteditable bình thường không còn bị bridge chặn.",
        "Bộ gõ tiếng Việt và composition event được đi thẳng qua trình duyệt.",
        "Phím chữ máy tính không còn bị ánh xạ bằng mã Android TV.",
        "Remote có event.key chuẩn vẫn hoạt động như cũ.",
        "Remote/WebView trả key='Unidentified' vẫn dùng keyCode fallback.",
        "Sự kiện native baoflix-native-remote-key không thay đổi.",
    ]


def make_backup(root: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = root / "backup" / f"desktop-keyboard-input-{stamp}"
    source = root / TARGET_PATH
    destination = backup_root / TARGET_PATH
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return backup_root


def atomic_write(path: Path, content: str) -> None:
    temp = path.with_name(f".{path.name}.desktop-keyboard.tmp")
    temp.write_text(content, encoding="utf-8", newline="\n")
    os.replace(temp, path)


def run_command(command: list[str], cwd: Path) -> bool:
    print(f"\n$ {' '.join(command)}")
    return subprocess.run(command, cwd=cwd, check=False).returncode == 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sửa lỗi BảoFlix nhập bàn phím máy tính bị mất chữ."
    )
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        root = find_repo_root(args.repo)
        target_file = root / TARGET_PATH
        original = target_file.read_text(encoding="utf-8")
        patched, notes = patch_bridge(original)

        print(f"Repo: {root}")
        print(f"File: {TARGET_PATH}")
        for note in notes:
            print(f"- {note}")

        if patched == original:
            print("\nKhông có thay đổi cần ghi.")
            return 0

        if args.dry_run:
            print("\nDry-run hoàn tất, chưa ghi file.")
            return 0

        backup_root = make_backup(root)
        atomic_write(target_file, patched)
        print(f"\nĐã sao lưu bản cũ tại: {backup_root}")
        print("Đã sửa lỗi bàn phím máy tính nhập chữ bị mất.")

        if args.verify:
            lint_ok = run_command(["npm", "run", "lint"], root)
            build_ok = run_command(["npm", "run", "build"], root)
            if not lint_ok or not build_ok:
                print("\nLint hoặc build chưa đạt. Bản cũ nằm trong thư mục backup.", file=sys.stderr)
                return 2

        return 0
    except PatchError as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1
    except OSError as error:
        print(f"LỖI HỆ THỐNG: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
