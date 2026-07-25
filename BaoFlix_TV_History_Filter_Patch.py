#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BảoFlix - vá bộ lọc lịch sử và các lỗi focus nhỏ trên TV.

Cách dùng:
    python baoflix_tv_history_filter_patch.py
    python baoflix_tv_history_filter_patch.py --repo D:\\duong-dan\\baoflix
    python baoflix_tv_history_filter_patch.py --verify

Script chỉ sửa mã nguồn local, không gọi GitHub và không tự commit/push.

Nội dung vá:
1. Nút OK/Enter trên <select>:
   - Ưu tiên mở native picker bằng showPicker().
   - Nếu TV/WebView không hỗ trợ, tự chuyển sang lựa chọn kế tiếp và phát
     sự kiện input/change để React cập nhật bộ lọc.
2. Đánh dấu select trong trang lịch sử là điều khiển TV.
3. Không cho D-pad chui vào cây [data-tv-skip], inert, aria-hidden hoặc overlay ẩn.
4. Đồng bộ các phần tử [role="button"] và [data-tv-focus] với bộ điều hướng TV.
5. Hạn chế kích hoạt kép khi nhấn OK trên link/button.
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
PATCH_MARKER = "function activateTvSelect"


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
        "Không tìm thấy repo BảoFlix. Hãy đặt file cạnh package.json "
        "hoặc chạy với --repo DUONG_DAN."
    )


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)

    if count == 0:
        raise PatchError(
            f"Không tìm thấy đoạn mã cần vá: {label}. "
            "Repo có thể đã đổi cấu trúc; script dừng để tránh sửa nhầm."
        )

    if count > 1:
        raise PatchError(
            f"Đoạn mã '{label}' xuất hiện {count} lần; script dừng để tránh sửa nhầm."
        )

    return text.replace(old, new, 1)


def patch_navigator(text: str) -> tuple[str, list[str]]:
    notes: list[str] = []

    if PATCH_MARKER in text:
        notes.append("TvRemoteNavigator đã có logic kích hoạt select; bỏ qua phần vá chính.")
        return text, notes

    old_selector = '''const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");'''

    new_selector = '''const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[role='button']:not([aria-disabled='true'])",
  "[data-tv-focus]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");'''

    text = replace_once(
        text,
        old_selector,
        new_selector,
        "mở rộng danh sách phần tử focusable",
    )

    old_visibility = '''function isVisibleElement(element: HTMLElement) {
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

    new_visibility = '''function prepareTvFocusableElement(element: HTMLElement) {
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

    text = replace_once(
        text,
        old_visibility,
        new_visibility,
        "lọc phần tử ẩn và cây data-tv-skip",
    )

    old_click = '''function clickActiveElement(event: KeyboardEvent) {
  const active = document.activeElement;
  if (active instanceof HTMLAnchorElement || active instanceof HTMLButtonElement) {
    event.preventDefault();
    active.click();
  }
}'''

    new_click = '''function isRemoteActivatableInput(
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

    text = replace_once(
        text,
        old_click,
        new_click,
        "kích hoạt select/link/button bằng remote",
    )

    old_activation = '''      if (isActivationKey(event) && !isTextInput(activeElement)) {
        clickActiveElement(event);
        return;
      }'''

    new_activation = '''      if (
        isActivationKey(event) &&
        (!isTextInput(activeElement) ||
          activeElement instanceof HTMLSelectElement ||
          isRemoteActivatableInput(activeElement))
      ) {
        clickActiveElement(event);
        return;
      }'''

    text = replace_once(
        text,
        old_activation,
        new_activation,
        "nhánh xử lý nút OK/Enter",
    )

    notes.extend(
        [
            "Đã thêm picker/fallback cycle cho select.",
            "Đã chặn focus vào subtree bị skip/ẩn/inert.",
            "Đã hỗ trợ role=button, data-tv-focus và input dạng checkbox/radio/button.",
            "Đã chặn keydown tiếp tục nổi bọt sau khi kích hoạt link/button.",
        ]
    )
    return text, notes


def patch_history(text: str) -> tuple[str, list[str]]:
    notes: list[str] = []

    if 'data-tv-select-cycle="true"' in text:
        notes.append("Trang lịch sử đã được đánh dấu select TV; bỏ qua.")
        return text, notes

    old = '''      data-tv-focus-key={focusKey}
      className={['''

    new = '''      data-tv-focus-key={focusKey}
      data-tv-select-cycle="true"
      title="Trên TV: bấm OK để mở hoặc chuyển lựa chọn"
      className={['''

    text = replace_once(
        text,
        old,
        new,
        "đánh dấu select của bộ lọc lịch sử",
    )
    notes.append("Đã đánh dấu các select lịch sử và thêm hướng dẫn ngắn cho TV.")
    return text, notes


def make_backup(root: Path, paths: list[Path]) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = root / "backup" / f"tv-history-filter-{stamp}"

    for relative in paths:
        source = root / relative
        destination = backup_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    return backup_root


def atomic_write(path: Path, content: str) -> None:
    temp = path.with_name(f".{path.name}.baoflix-patch.tmp")
    temp.write_text(content, encoding="utf-8", newline="\n")
    os.replace(temp, path)


def run_command(command: list[str], cwd: Path) -> bool:
    print(f"\n$ {' '.join(command)}")
    completed = subprocess.run(command, cwd=cwd, check=False)
    return completed.returncode == 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Vá bộ lọc lịch sử và một số lỗi focus nhỏ trên BảoFlix TV."
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path.cwd(),
        help="Đường dẫn repo BảoFlix; mặc định là thư mục hiện tại.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Chỉ kiểm tra khả năng vá, không ghi file.",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Sau khi vá, chạy npm run lint và npm run build.",
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

        patched_navigator, navigator_notes = patch_navigator(original_navigator)
        patched_history, history_notes = patch_history(original_history)

        changed: dict[Path, str] = {}
        if patched_navigator != original_navigator:
            changed[NAVIGATOR_PATH] = patched_navigator
        if patched_history != original_history:
            changed[HISTORY_PATH] = patched_history

        print(f"Repo: {root}")
        for note in [*navigator_notes, *history_notes]:
            print(f"- {note}")

        if not changed:
            print("\nKhông có gì cần sửa; patch có vẻ đã được áp dụng trước đó.")
            return 0

        print("\nFile sẽ thay đổi:")
        for relative in changed:
            print(f"- {relative}")

        if args.dry_run:
            print("\nDry-run thành công. Chưa ghi file nào.")
            return 0

        backup_root = make_backup(root, list(changed))
        print(f"\nĐã sao lưu vào: {backup_root}")

        for relative, content in changed.items():
            atomic_write(root / relative, content)

        print("\nĐã áp dụng patch local thành công.")
        print("Không có thao tác GitHub, commit hoặc push nào được thực hiện.")

        if args.verify:
            lint_ok = run_command(["npm", "run", "lint"], root)
            build_ok = run_command(["npm", "run", "build"], root)

            if not lint_ok or not build_ok:
                print(
                    "\nCẢNH BÁO: verify chưa đạt. Mã đã được giữ nguyên để bạn xem log; "
                    f"bản sao lưu nằm tại {backup_root}.",
                    file=sys.stderr,
                )
                return 2

            print("\nLint và build đều thành công.")

        print("\nGợi ý test trên TV:")
        print("1. Mở Lịch sử xem và đưa focus vào từng bộ lọc.")
        print("2. Bấm OK: picker native mở; nếu TV không hỗ trợ thì giá trị tự chuyển.")
        print("3. Kiểm tra số kết quả đổi ngay sau khi chọn.")
        print("4. Thử D-pad quanh panel ẩn/modal để chắc focus không bị nhảy mất.")
        return 0

    except PatchError as exc:
        print(f"LỖI: {exc}", file=sys.stderr)
        return 1
    except FileNotFoundError as exc:
        print(f"LỖI: Thiếu file: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"LỖI KHÔNG MONG ĐỢI: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
