#!/usr/bin/env python3
from pathlib import Path
import re
import shutil
import sys

ROOT = Path.cwd()
CHANGED = []


def die(message):
    print(f"\n[ERROR] {message}")
    sys.exit(1)


def read(path):
    file_path = ROOT / path
    if not file_path.exists():
        die(f"Không tìm thấy {path}. Chạy script ở root project BảoFlix nhé.")
    return file_path.read_text(encoding="utf-8")


def write(path, content):
    file_path = ROOT / path
    backup_path = file_path.with_suffix(file_path.suffix + ".remote-hotfix.bak")
    if not backup_path.exists():
        shutil.copyfile(file_path, backup_path)
    file_path.write_text(content, encoding="utf-8")
    CHANGED.append(path)


def add_attrs_to_tag_with_row_key(content, row_key, attrs, label):
    pattern = re.compile(
        r'(<div\b(?=[^>]*data-tv-row-key="' + re.escape(row_key) + r'")[^>]*)(>)',
        re.S,
    )

    def repl(match):
        tag = match.group(1)
        changed = False

        for attr in attrs:
            attr_name = attr.split("=", 1)[0].strip()
            if attr_name and attr_name not in tag:
                tag += "\n                " + attr
                changed = True

        return tag + match.group(2)

    next_content, count = pattern.subn(repl, content, count=1)

    if not count:
        print(f"[WARN] Không thấy row-key {row_key}: {label}")
        return content

    if next_content == content:
        print(f"[SKIP] {label} đã đủ.")
        return content

    print(f"[OK] {label}")
    return next_content


def patch_watch_overlay():
    path = "components/TvWatchOverlay.tsx"
    content = read(path)

    content = add_attrs_to_tag_with_row_key(
        content,
        "overlay:exit-confirm",
        ['data-tv-row-loop="true"'],
        "Exit confirm loop",
    )

    content = add_attrs_to_tag_with_row_key(
        content,
        "overlay:transport",
        ['data-tv-row-loop="true"'],
        "Transport row loop",
    )

    content = add_attrs_to_tag_with_row_key(
        content,
        "overlay:actions",
        ['data-tv-row-loop="true"'],
        "Overlay action row loop",
    )

    content = add_attrs_to_tag_with_row_key(
        content,
        "overlay:panel-tabs",
        [
            'data-tv-row-loop="true"',
            'data-tv-focus-out-down={overlayPanel === "episodes" ? "selector:[data-tv-episode-current=\'true\'], [data-tv-episode-grid] a[href]" : "selector:[data-tv-source-current=\'true\'], [data-tv-panel=\'sources\'] a[href]"}',
        ],
        "Panel tabs loop + focus-out down",
    )

    content = add_attrs_to_tag_with_row_key(
        content,
        "overlay:episode-chunks",
        [
            'data-tv-row-loop="true"',
            'data-tv-scroll-align="center"',
            'data-tv-focus-out-up="focus-key:overlay-tab:episodes"',
            'data-tv-focus-out-down="selector:[data-tv-episode-current=\'true\'], [data-tv-episode-grid] a[href]"',
        ],
        "Episode chunks loop + focus-out",
    )

    write(path, content)


def patch_search_box():
    path = "components/TvSearchBox.tsx"
    content = read(path)

    if ">Space" in content:
        content = content.replace(">Space", ">Cách")
        print("[OK] Đổi Space -> Cách")
    else:
        print("[SKIP] Space label đã đổi hoặc không còn.")

    write(path, content)


def main():
    patch_watch_overlay()
    patch_search_box()

    print("\n[OK] Remote logic final hotfix chạy xong.")
    print("Đã ghi:")
    for item in CHANGED:
        print(f"- {item}")

    print("\nBackup tạo cạnh file gốc dạng *.remote-hotfix.bak")
    print("Giờ chạy:")
    print("  npm run lint")
    print("  npm run build")


if __name__ == "__main__":
    main()
