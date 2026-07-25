#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BảoFlix - khôi phục TV overlay cũ và vá bộ lọc lịch sử cục bộ.

Mục tiêu:
1. Đảo toàn bộ thay đổi mà BaoFlix_TV_History_Filter_Patch.py đã áp vào
   components/TvRemoteNavigator.tsx.
2. Trả logic điều hướng/overlay khi xem phim về đúng bản cũ đang ổn.
3. Sửa nút OK trên các <select> của trang lịch sử ngay trong
   app/lich-su/page.tsx, không sửa navigator dùng chung và không đụng overlay.

Cách dùng:
    python BaoFlix_Restore_TV_Overlay_And_Local_History_Filter.py
    python BaoFlix_Restore_TV_Overlay_And_Local_History_Filter.py --repo D:\\duong-dan\\baoflix
    python BaoFlix_Restore_TV_Overlay_And_Local_History_Filter.py --dry-run
    python BaoFlix_Restore_TV_Overlay_And_Local_History_Filter.py --verify

Script chỉ sửa repo local, không gọi GitHub, không commit và không push.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


NAVIGATOR_PATH = Path("components/TvRemoteNavigator.tsx")
HISTORY_PATH = Path("app/lich-su/page.tsx")
OLD_GLOBAL_PATCH_MARKER = "function activateTvSelect"
LOCAL_HISTORY_PATCH_MARKER = "function handleHistorySelectKeyDown"


class PatchError(RuntimeError):
    pass


def find_repo_root(start: Path) -> Path:
    start = start.expanduser().resolve()

    for candidate in (start, *start.parents):
        if (
            (candidate / "package.json").is_file()
            and (candidate / NAVIGATOR_PATH).is_file()
            and (candidate / HISTORY_PATH).is_file()
        ):
            return candidate

    raise PatchError(
        "Không tìm thấy repo BảoFlix. Đặt file cạnh package.json "
        "hoặc chạy với --repo DUONG_DAN."
    )


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)

    if count == 0:
        raise PatchError(
            f"Không tìm thấy đoạn mã cần xử lý: {label}. "
            "Script dừng để tránh sửa nhầm phiên bản khác."
        )

    if count > 1:
        raise PatchError(
            f"Đoạn mã '{label}' xuất hiện {count} lần. "
            "Script dừng để tránh sửa nhầm."
        )

    return text.replace(old, new, 1)


def restore_navigator(text: str) -> tuple[str, list[str]]:
    notes: list[str] = []

    if OLD_GLOBAL_PATCH_MARKER not in text:
        notes.append("TvRemoteNavigator không còn patch select toàn cục; giữ nguyên.")
        return text, notes

    patched_selector = '''const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[role='button']:not([aria-disabled='true'])",
  "[data-tv-focus]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");'''

    original_selector = '''const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");'''

    text = replace_once(text, patched_selector, original_selector, "khôi phục FOCUSABLE_SELECTOR cũ")

    patched_visibility = '''function prepareTvFocusableElement(element: HTMLElement) {
  if (element.hasAttribute("data-tv-focus") && element.tabIndex < 0) {
    element.tabIndex = 0;
  }
}

function isVisibleElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  if (element.closest("[inert]")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.closest("[aria-hidden='true']")) return false;
  if (element.hasAttribute("disabled")) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  if (
    element.closest(
      "[data-tv-overlay='watch'][data-tv-overlay-visible='false']"
    )
  ) {
    return false;
  }
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;
  if (rect.width < 2 || rect.height < 2) return false;
  return true;
}

function getFocusableElements(root: ParentNode = document) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => {
      prepareTvFocusableElement(element);
      return true;
    })
    .filter(isVisibleElement)
    .filter((element) => element.tabIndex !== -1)
    .filter((element) => !element.hasAttribute("data-tv-skip"))
    .filter((element) => !element.closest("[data-tv-skip]"));
}'''

    original_visibility = '''function isVisibleElement(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  if (element.getAttribute("aria-hidden") === "true") return false;
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;
  if (rect.width < 2 || rect.height < 2) return false;
  return true;
}

function getFocusableElements(root: ParentNode = document) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(isVisibleElement)
    .filter((element) => element.tabIndex !== -1)
    .filter((element) => !element.hasAttribute("data-tv-skip"));
}'''

    text = replace_once(text, patched_visibility, original_visibility, "khôi phục bộ lọc focus/visibility cũ")

    patched_click = '''function isRemoteActivatableInput(
  element: Element | null
): element is HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) return false;

  return ["button", "checkbox", "radio", "reset", "submit"].includes(
    element.type
  );
}

function cycleTvSelectOption(select: HTMLSelectElement, direction = 1) {
  const availableOptions = Array.from(select.options)
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.disabled && !option.hidden);

  if (availableOptions.length === 0) return false;

  const currentIndex = availableOptions.findIndex(
    ({ index }) => index === select.selectedIndex
  );
  const startIndex =
    currentIndex >= 0 ? currentIndex : direction >= 0 ? -1 : 0;
  const nextIndex =
    (startIndex + direction + availableOptions.length) %
    availableOptions.length;
  const nextOption = availableOptions[nextIndex];

  if (!nextOption) return false;

  select.selectedIndex = nextOption.index;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  select.focus({ preventScroll: true });

  return true;
}

function activateTvSelect(event: KeyboardEvent, select: HTMLSelectElement) {
  event.preventDefault();
  event.stopPropagation();

  const showPicker = (
    select as HTMLSelectElement & { showPicker?: () => void }
  ).showPicker;

  if (typeof showPicker === "function") {
    try {
      showPicker.call(select);
      return;
    } catch {
      // Nhiều TV WebView chưa hỗ trợ showPicker dù API có tồn tại.
    }
  }

  cycleTvSelectOption(select, event.shiftKey ? -1 : 1);
}

function clickActiveElement(event: KeyboardEvent) {
  const active = document.activeElement;

  if (active instanceof HTMLSelectElement) {
    activateTvSelect(event, active);
    return;
  }

  if (
    active instanceof HTMLAnchorElement ||
    active instanceof HTMLButtonElement ||
    isRemoteActivatableInput(active)
  ) {
    event.preventDefault();
    event.stopPropagation();
    active.click();
  }
}'''

    original_click = '''function clickActiveElement(event: KeyboardEvent) {
  const active = document.activeElement;
  if (active instanceof HTMLAnchorElement || active instanceof HTMLButtonElement) {
    event.preventDefault();
    active.click();
  }
}'''

    text = replace_once(text, patched_click, original_click, "khôi phục clickActiveElement cũ")

    patched_activation = '''      if (
        isActivationKey(event) &&
        (!isTextInput(activeElement) ||
          activeElement instanceof HTMLSelectElement ||
          isRemoteActivatableInput(activeElement))
      ) {
        clickActiveElement(event);
        return;
      }'''

    original_activation = '''      if (isActivationKey(event) && !isTextInput(activeElement)) {
        clickActiveElement(event);
        return;
      }'''

    text = replace_once(text, patched_activation, original_activation, "khôi phục nhánh nút OK/Enter cũ")

    if OLD_GLOBAL_PATCH_MARKER in text:
        raise PatchError(
            "Đã đảo các khối chính nhưng marker patch toàn cục vẫn còn. "
            "Script dừng để không để lại navigator nửa cũ nửa mới."
        )

    notes.extend([
        "Đã trả FOCUSABLE_SELECTOR về bản cũ.",
        "Đã trả logic visibility/focus về bản cũ.",
        "Đã trả clickActiveElement về bản cũ.",
        "Đã trả nhánh xử lý OK/Enter về bản cũ.",
        "Overlay và D-pad khi xem phim không còn dùng patch select toàn cục.",
    ])
    return text, notes


def patch_history_locally(text: str) -> tuple[str, list[str]]:
    notes: list[str] = []

    if LOCAL_HISTORY_PATCH_MARKER not in text:
        anchor = '''function SelectBox({
  value,
  onChange,
  children,
  focusKey,
}: {'''

        helper = '''function isHistorySelectActivationKey(
  event: React.KeyboardEvent<HTMLSelectElement>
) {
  const nativeEvent = event.nativeEvent as KeyboardEvent;

  return (
    event.key === "Enter" ||
    event.key === "NumpadEnter" ||
    event.key === " " ||
    event.key === "Spacebar" ||
    event.key === "OK" ||
    event.key === "Accept" ||
    nativeEvent.keyCode === 13 ||
    nativeEvent.keyCode === 23 ||
    nativeEvent.keyCode === 66
  );
}

function handleHistorySelectKeyDown(
  event: React.KeyboardEvent<HTMLSelectElement>
) {
  if (!isHistorySelectActivationKey(event)) return;

  event.preventDefault();
  event.stopPropagation();

  if (event.repeat) return;

  const select = event.currentTarget as HTMLSelectElement & {
    showPicker?: () => void;
  };

  if (typeof select.showPicker === "function") {
    try {
      select.showPicker();
      return;
    } catch {
      // TV WebView có thể khai báo showPicker nhưng không cho gọi.
    }
  }

  const options = Array.from(select.options)
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.disabled && !option.hidden);

  if (!options.length) return;

  const current = options.findIndex(
    ({ index }) => index === select.selectedIndex
  );
  const next = options[(Math.max(current, 0) + 1) % options.length];

  if (!next) return;

  select.selectedIndex = next.index;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  select.focus({ preventScroll: true });
}

function SelectBox({
  value,
  onChange,
  children,
  focusKey,
}: {'''

        text = replace_once(text, anchor, helper, "thêm handler cục bộ cho select lịch sử")
        notes.append("Đã thêm handler OK riêng cho select trang lịch sử.")
    else:
        notes.append("Trang lịch sử đã có handler select cục bộ.")

    select_anchor = '''      value={value}
      onChange={(event) => onChange(event.target.value)}
      data-tv-focus-key={focusKey}'''

    select_with_keydown = '''      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleHistorySelectKeyDown}
      data-tv-focus-key={focusKey}'''

    if "onKeyDown={handleHistorySelectKeyDown}" not in text:
        text = replace_once(text, select_anchor, select_with_keydown, "gắn handler vào SelectBox lịch sử")
        notes.append("Đã gắn handler cục bộ vào SelectBox.")
    else:
        notes.append("SelectBox đã gắn handler cục bộ.")

    return text, notes


def make_backup(root: Path, paths: list[Path]) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = root / "backup" / f"restore-tv-overlay-{stamp}"

    for relative in paths:
        source = root / relative
        destination = backup_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    return backup_root


def atomic_write(path: Path, content: str) -> None:
    temp = path.with_name(f".{path.name}.restore-overlay.tmp")
    temp.write_text(content, encoding="utf-8", newline="\n")
    os.replace(temp, path)


def run_command(command: list[str], cwd: Path) -> bool:
    print(f"\n$ {' '.join(command)}")
    completed = subprocess.run(command, cwd=cwd, check=False)
    return completed.returncode == 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Khôi phục TV overlay cũ và vá select lịch sử cục bộ, "
            "không đụng navigator dùng chung."
        )
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path.cwd(),
        help="Đường dẫn repo BảoFlix; mặc định là thư mục hiện tại.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Chỉ kiểm tra, không ghi file.")
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Sau khi sửa, chạy npm run lint và npm run build.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        root = find_repo_root(args.repo)
        navigator_file = root / NAVIGATOR_PATH
        history_file = root / HISTORY_PATH

        original_navigator = navigator_file.read_text(encoding="utf-8")
        original_history = history_file.read_text(encoding="utf-8")

        next_navigator, navigator_notes = restore_navigator(original_navigator)
        next_history, history_notes = patch_history_locally(original_history)

        changed_paths: list[Path] = []
        if next_navigator != original_navigator:
            changed_paths.append(NAVIGATOR_PATH)
        if next_history != original_history:
            changed_paths.append(HISTORY_PATH)

        print(f"Repo: {root}")
        print("\nTvRemoteNavigator:")
        for note in navigator_notes:
            print(f"- {note}")

        print("\nTrang lịch sử:")
        for note in history_notes:
            print(f"- {note}")

        if not changed_paths:
            print("\nKhông có thay đổi cần ghi.")
            return 0

        print("\nFile sẽ được sửa:")
        for path in changed_paths:
            print(f"- {path}")

        if args.dry_run:
            print("\nDry-run hoàn tất, chưa ghi file.")
            return 0

        backup_root = make_backup(root, changed_paths)
        if NAVIGATOR_PATH in changed_paths:
            atomic_write(navigator_file, next_navigator)
        if HISTORY_PATH in changed_paths:
            atomic_write(history_file, next_history)

        print(f"\nĐã sao lưu bản cũ tại: {backup_root}")
        print("Đã khôi phục overlay/navigator cũ.")
        print("Bộ lọc lịch sử hiện được xử lý riêng trong app/lich-su/page.tsx.")

        if args.verify:
            lint_ok = run_command(["npm", "run", "lint"], root)
            build_ok = run_command(["npm", "run", "build"], root)
            if not lint_ok or not build_ok:
                print(
                    "\nLint hoặc build chưa đạt. Mã cũ đã nằm trong thư mục backup.",
                    file=sys.stderr,
                )
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
