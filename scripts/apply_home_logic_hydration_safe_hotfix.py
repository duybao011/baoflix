#!/usr/bin/env python3
from pathlib import Path
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
        die(f"Không tìm thấy {path}. Hãy chạy script ở root project BảoFlix.")
    return file_path.read_text(encoding="utf-8")

def write(path, content):
    file_path = ROOT / path
    backup_path = file_path.with_suffix(file_path.suffix + ".home-logic-hotfix.bak")
    if not backup_path.exists():
        shutil.copyfile(file_path, backup_path)
    file_path.write_text(content, encoding="utf-8")
    CHANGED.append(path)

def replace_once(content, old, new, label):
    if new in content:
        print(f"[SKIP] {label} đã có.")
        return content
    if old not in content:
        print(f"[WARN] Không thấy block: {label}. Bỏ qua.")
        return content
    print(f"[OK] {label}")
    return content.replace(old, new, 1)

def patch_home_page():
    path = "app/page.tsx"
    content = read(path)

    content = replace_once(
        content,
        '<MovieGrid title="Phim bộ" href="/danh-sach/phim-bo" movies={phimBo.items} />',
        '<MovieGrid sectionId="home-phim-bo" title="Phim bộ" href="/danh-sach/phim-bo" movies={phimBo.items} />',
        "Home MovieGrid Phim bộ unique sectionId",
    )

    content = replace_once(
        content,
        '<MovieGrid title="Phim lẻ" href="/danh-sach/phim-le" movies={phimLe.items} />',
        '<MovieGrid sectionId="home-phim-le" title="Phim lẻ" href="/danh-sach/phim-le" movies={phimLe.items} />',
        "Home MovieGrid Phim lẻ unique sectionId",
    )

    content = replace_once(
        content,
        '<MovieGrid title="Hoạt hình" href="/danh-sach/hoat-hinh" movies={hoatHinh.items} />',
        '<MovieGrid sectionId="home-hoat-hinh" title="Hoạt hình" href="/danh-sach/hoat-hinh" movies={hoatHinh.items} />',
        "Home MovieGrid Hoạt hình unique sectionId",
    )

    write(path, content)

def main():
    patch_home_page()
    print("\n[OK] Home logic hotfix chạy xong.")
    print("Đã ghi:")
    for path in CHANGED:
        print(f"- {path}")
    print("\nBackup tạo cạnh file gốc dạng *.home-logic-hotfix.bak")
    print("Giờ chạy:")
    print("  npm run lint")
    print("  npm run build")
    print("\nGhi chú: warning bis_skin_checked là do extension trình duyệt chèn vào DOM, không vá bằng code app.")

if __name__ == "__main__":
    main()
