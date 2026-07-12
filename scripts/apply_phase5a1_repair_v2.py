#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import shutil
import sys

ROOT = Path.cwd()
CHANGED: list[str] = []


def die(message: str) -> None:
    print(f"\n[ERROR] {message}")
    sys.exit(1)


def read(path: str) -> str:
    file_path = ROOT / path
    if not file_path.exists():
        die(f"Không tìm thấy {path}. Hãy chạy script ở thư mục gốc BảoFlix.")
    return file_path.read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    file_path = ROOT / path
    backup = file_path.with_suffix(file_path.suffix + ".phase5a1-repair.bak")

    if not backup.exists():
        shutil.copyfile(file_path, backup)

    file_path.write_text(content, encoding="utf-8")
    CHANGED.append(path)


def regex_once(
    content: str,
    pattern: str,
    replacement: str,
    label: str,
    *,
    flags: int = 0,
    allow_already_fixed: str | None = None,
) -> str:
    updated, count = re.subn(pattern, replacement, content, count=1, flags=flags)

    if count == 1:
        print(f"[OK] {label}")
        return updated

    if allow_already_fixed and allow_already_fixed in content:
        print(f"[SKIP] {label} đã được sửa.")
        return content

    die(f"Không tìm thấy block: {label}")


def remove_unused_constant(path: str, constant_name: str) -> None:
    content = read(path)

    pattern = rf'^[ \t]*const[ \t]+{re.escape(constant_name)}[ \t]*=[^\n]+;\r?\n'
    updated, count = re.subn(pattern, "", content, count=1, flags=re.MULTILINE)

    if count == 0:
        if re.search(rf'\b{re.escape(constant_name)}\b', content):
            die(
                f"{path}: vẫn còn {constant_name} nhưng không match declaration an toàn."
            )

        print(f"[SKIP] {path}: {constant_name} đã được xóa.")
        return

    print(f"[OK] {path}: xóa {constant_name} không dùng")
    write(path, updated)


def remove_unused_watch_store_imports(path: str) -> None:
    content = read(path)

    pattern = r'''import\s*\{\s*
readWatchHistory\s*,\s*
removeWatchHistoryItem\s*,\s*
clearWatchHistory\s*,?\s*
\}\s*from\s*["']@/lib/watchStore["'];\s*
'''

    updated, count = re.subn(
        pattern,
        "",
        content,
        count=1,
        flags=re.MULTILINE | re.VERBOSE,
    )

    if count == 0:
        names = (
            "readWatchHistory",
            "removeWatchHistoryItem",
            "clearWatchHistory",
        )
        if not any(re.search(rf'\b{name}\b', content) for name in names):
            print(f"[SKIP] {path}: imports thừa đã được xóa.")
            return

        die(f"{path}: không tìm thấy import watchStore theo format dự kiến.")

    print(f"[OK] {path}: xóa imports watchStore không dùng")
    write(path, updated)


def patch_watch_client_memoization() -> None:
    path = "components/WatchClient.tsx"
    content = read(path)

    pattern = r'''  const playerIframeSrc = useMemo\(\(\) => \{
    if \(!episode\?\.link_embed\) return "";
    if \(!tvOverlayEnabled\) return episode\.link_embed;

    try \{
      const url = new URL\(episode\.link_embed, window\.location\.origin\);
      url\.searchParams\.set\("autoplay", "1"\);
      url\.searchParams\.set\("autoPlay", "1"\);
      url\.searchParams\.set\("muted", "0"\);
      url\.searchParams\.set\("playsinline", "1"\);
      return url\.toString\(\);
    \} catch \{
      return episode\.link_embed;
    \}
  \}, \[episode\?\.link_embed, tvOverlayEnabled\]\);'''

    replacement = '''  const playerIframeSrc = (() => {
    const linkEmbed = episode?.link_embed;

    if (!linkEmbed) return "";
    if (!tvOverlayEnabled) return linkEmbed;

    try {
      const url = new URL(linkEmbed, window.location.origin);
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("autoPlay", "1");
      url.searchParams.set("muted", "0");
      url.searchParams.set("playsinline", "1");
      return url.toString();
    } catch {
      return linkEmbed;
    }
  })();'''

    content = regex_once(
        content,
        pattern,
        replacement,
        "WatchClient: bỏ manual useMemo gây React Compiler error",
        flags=re.MULTILINE,
        allow_already_fixed="const playerIframeSrc = (() => {",
    )

    write(path, content)


def main() -> None:
    remove_unused_constant("app/cai-dat/page.tsx", "TV_SESSION_KEY")
    remove_unused_constant("components/Header.tsx", "TV_SESSION_KEY")
    remove_unused_constant("components/TvRemoteNavigator.tsx", "TV_SESSION_KEY")
    remove_unused_constant("lib/kkphim.ts", "KKPHIM_FETCH_TIMEOUT_MS")

    remove_unused_watch_store_imports("components/MyTasteClient.tsx")
    remove_unused_watch_store_imports("components/PersonalDashboard.tsx")

    patch_watch_client_memoization()

    print("\n[OK] Phase 5A.1 repair v2 hoàn tất.")
    print("\nĐã sửa:")
    for path in CHANGED:
        print(f"- {path}")

    print("\nBackup tự tạo:")
    print("- *.phase5a1-repair.bak")

    print("\nChạy lại:")
    print("- npm run lint")
    print("- npm run build")


if __name__ == "__main__":
    main()
