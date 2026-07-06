#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

ROOT = Path.cwd()
CHANGED = []


def die(message: str) -> None:
    print(f"\n[ERROR] {message}")
    sys.exit(1)


def read(path: str) -> str:
    file_path = ROOT / path
    if not file_path.exists():
        die(f"Không tìm thấy {path}. Hãy chạy script ở root project BảoFlix.")
    return file_path.read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    file_path = ROOT / path
    backup_path = file_path.with_suffix(file_path.suffix + ".phase2c.bak")
    if not backup_path.exists():
        shutil.copyfile(file_path, backup_path)
    file_path.write_text(content, encoding="utf-8")
    CHANGED.append(path)


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if new in content:
        print(f"[SKIP] {label} đã có.")
        return content

    if old not in content:
        print(f"[WARN] Không tìm thấy block: {label}. Bỏ qua.")
        return content

    print(f"[OK] {label}")
    return content.replace(old, new, 1)


def patch_tv_remote_navigator() -> None:
    path = "components/TvRemoteNavigator.tsx"
    content = read(path)

    old = '''  const rowContainer = current.closest<HTMLElement>("[data-tv-row]");
  const shouldLoop = rowContainer?.dataset.tvRowLoop === "true";

  if (direction === "right") {
    return currentRow[itemIndex + 1]?.element || (shouldLoop ? currentRow[0]?.element : current);
  }

  if (direction === "left") {
    return currentRow[itemIndex - 1]?.element || (shouldLoop ? currentRow[currentRow.length - 1]?.element : current);
  }

  if (direction === "down") {
    return nextRow ? getSmartRowCandidate(nextRow, currentEntry.rect, pathname) : current;
  }

  if (direction === "up") {
    return previousRow ? getSmartRowCandidate(previousRow, currentEntry.rect, pathname) : current;
  }
'''

    new = '''  const rowContainer = current.closest<HTMLElement>("[data-tv-row]");
  const shouldLoopX =
    rowContainer?.dataset.tvRowLoop === "true" ||
    rowContainer?.dataset.tvRowLoopX === "true" ||
    rowContainer?.dataset.tvRowLoopAll === "true";

  const shouldLoopY =
    rowContainer?.dataset.tvRowLoopY === "true" ||
    rowContainer?.dataset.tvRowLoopAll === "true";

  const shouldLoopDown = shouldLoopY || rowContainer?.dataset.tvRowLoopDown === "true";
  const shouldLoopUp = shouldLoopY || rowContainer?.dataset.tvRowLoopUp === "true";

  if (direction === "right") {
    return currentRow[itemIndex + 1]?.element || (shouldLoopX ? currentRow[0]?.element : current);
  }

  if (direction === "left") {
    return currentRow[itemIndex - 1]?.element || (shouldLoopX ? currentRow[currentRow.length - 1]?.element : current);
  }

  if (direction === "down") {
    if (nextRow) return getSmartRowCandidate(nextRow, currentEntry.rect, pathname);
    return shouldLoopDown && rows[0] ? getSmartRowCandidate(rows[0], currentEntry.rect, pathname) : current;
  }

  if (direction === "up") {
    if (previousRow) return getSmartRowCandidate(previousRow, currentEntry.rect, pathname);
    return shouldLoopUp && rows[rows.length - 1]
      ? getSmartRowCandidate(rows[rows.length - 1], currentEntry.rect, pathname)
      : current;
  }
'''

    content = replace_once(content, old, new, "TvRemoteNavigator controlled row loop X/Y")
    write(path, content)


def patch_tv_dashboard() -> None:
    path = "components/TvDashboard.tsx"
    content = read(path)

    old = '''      data-tv-row-key="tv-rail"
      data-tv-row-wrap="true"
      data-tv-focus-out-right="content"
'''
    new = '''      data-tv-row-key="tv-rail"
      data-tv-row-wrap="true"
      data-tv-row-loop-y="true"
      data-tv-focus-out-right="content"
'''
    content = replace_once(content, old, new, "TvDashboard rail vertical loop")
    write(path, content)


def patch_globals() -> None:
    path = "app/globals.css"
    content = read(path)

    marker = "/* =========================\n   TV Phase 2C Focus Surface\n========================= */"

    if marker in content:
        print("[SKIP] app/globals.css Phase 2C CSS đã có.")
        return

    addition = '''
/* =========================
   TV Phase 2C Focus Surface
========================= */

@media (min-width: 1024px) {
  [data-tv-scope] a:focus-visible,
  [data-tv-scope] button:focus-visible,
  [data-tv-scope] input:focus-visible,
  [data-tv-scope] select:focus-visible,
  [data-tv-scope] textarea:focus-visible {
    outline-width: 2px;
    outline-offset: 2px;
    transform: translateY(-1px) scale(1.018);
    transition:
      transform 90ms ease,
      box-shadow 90ms ease,
      border-color 90ms ease,
      background-color 90ms ease;
  }

  /* Poster/card focus: rõ khung hơn, ít phình layout hơn. */
  [data-tv-scope] [data-tv-card]:focus-within,
  [data-tv-scope] article:focus-within {
    border-color: rgba(250, 204, 21, 0.96);
    box-shadow:
      0 0 0 3px rgba(250, 204, 21, 0.20),
      0 18px 38px rgba(0, 0, 0, 0.48);
  }

  [data-tv-scope] [data-tv-card] a:focus-visible,
  [data-tv-scope] article a:focus-visible,
  [data-tv-section='filter-results'] a:focus-visible,
  [data-tv-section='history-results'] a:focus-visible,
  [data-tv-section='china-series'] a:focus-visible,
  [data-tv-section='custom'] a:focus-visible,
  [data-tv-section='favorites'] a:focus-visible {
    transform: translateY(-1px) scale(1.015);
    box-shadow:
      0 0 0 4px rgba(250, 204, 21, 0.16),
      0 16px 34px rgba(0, 0, 0, 0.50);
  }

  /* Rail/menu focus: nhìn rõ nhưng không giật to. */
  [data-tv-rail='true'] a:focus-visible,
  [data-tv-rail='true'] button:focus-visible {
    transform: translateX(2px) scale(1.025);
    border-color: rgba(250, 204, 21, 0.95);
    background: rgba(250, 204, 21, 0.16);
    box-shadow:
      0 0 0 3px rgba(250, 204, 21, 0.20),
      0 14px 32px rgba(0, 0, 0, 0.46);
  }

  /* Keyboard focus: nhỏ, gọn, biết đang ở bàn phím. */
  [data-tv-search-keyboard] button:focus-visible {
    transform: translateY(-1px) scale(1.04);
    border-color: rgba(250, 204, 21, 0.98);
    background: rgba(250, 204, 21, 0.16);
    box-shadow:
      0 0 0 3px rgba(250, 204, 21, 0.24),
      0 12px 26px rgba(0, 0, 0, 0.48);
  }

  /* Filter focus: ưu tiên viền rõ, scale nhẹ để không vỡ grid option. */
  [data-tv-filter-panel] button:focus-visible,
  [data-tv-filter-panel] a:focus-visible {
    transform: translateY(-1px) scale(1.012);
    border-color: rgba(250, 204, 21, 0.98);
    box-shadow:
      0 0 0 3px rgba(250, 204, 21, 0.18),
      0 12px 28px rgba(0, 0, 0, 0.42);
  }

  /* Player overlay focus: sáng hơn vì nền video tối/động. */
  [data-tv-overlay='watch'] a:focus-visible,
  [data-tv-overlay='watch'] button:focus-visible {
    outline-width: 2px;
    transform: translateY(-1px) scale(1.035);
    border-color: rgba(250, 204, 21, 1);
    box-shadow:
      0 0 0 4px rgba(250, 204, 21, 0.26),
      0 18px 42px rgba(0, 0, 0, 0.58);
  }

  [data-tv-overlay='watch'] [data-tv-panel] a:focus-visible,
  [data-tv-overlay='watch'] [data-tv-panel] button:focus-visible {
    transform: translateY(-1px) scale(1.02);
  }

  /* Không làm nút phụ data-tv-skip nổi focus. */
  [data-tv-scope] [data-tv-skip]:focus-visible {
    outline: none;
    box-shadow: none;
    transform: none;
  }
}
'''

    content = content.rstrip() + "\n" + addition
    print("[OK] app/globals.css Phase 2C focus surfaces")
    write(path, content)


def main() -> None:
    patch_tv_remote_navigator()
    patch_tv_dashboard()
    patch_globals()

    print("\n[OK] Phase 2C patch xong.")
    print("Đã ghi:")
    for path in CHANGED:
        print(f"- {path}")

    print("\nBackup tạo cạnh file gốc dạng *.phase2c.bak")
    print("Giờ chạy:")
    print("  npm run lint")
    print("  npm run build")


if __name__ == "__main__":
    main()
