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

TARGETS = [
    "lib/kkphim.ts",
    "components/CustomMovieForm.tsx",
    "lib/customMoviesClient.ts",
    "components/MyTasteClient.tsx",
]


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
            and (candidate / "lib").exists()
            and (candidate / "components").exists()
        ):
            return candidate
    fail("Không tìm thấy root repo BảoFlix.")


def patch_kkphim(text: str) -> str:
    if "BAOFLIX_V9_ANIMATION_CLASSIFICATION" not in text:
        old_animation = '''function isSingleAnimation(movie: MovieItem) {
  const total = getEpisodeNumber(movie.episode_total);
  const current = String(movie.episode_current || "").toLowerCase();
  const type = String(movie.type || "").toLowerCase();

  if (type === "single") return true;
  if (type === "series") return false;

  if (total > 1) return false;

  if (current.includes("full")) return true;
  if (current.includes("1/1")) return true;
  if (current.includes("hoàn tất") && current.includes("1/1")) return true;

  if (current.includes("tập")) return false;
  if (current.includes("/") && !current.includes("1/1")) return false;

  // Metadata không đủ thì không đoán unknown thành phim lẻ.
  return total === 1;
}

function isSeriesAnimation(movie: MovieItem) {
  const total = getEpisodeNumber(movie.episode_total);
  const current = String(movie.episode_current || "").toLowerCase();
  const type = String(movie.type || "").toLowerCase();

  if (type === "series") return true;
  if (type === "single") return false;

  if (total > 1) return true;
  if (current.includes("tập")) return true;
  if (current.includes("/") && !current.includes("1/1")) return true;

  return false;
}'''

        new_animation = '''// BAOFLIX_V9_ANIMATION_CLASSIFICATION
function isSingleAnimation(movie: MovieItem) {
  const total = getEpisodeNumber(movie.episode_total);
  const current = String(movie.episode_current || "").toLowerCase();
  const type = String(movie.type || "").toLowerCase();

  if (type === "single") return true;
  if (type === "series") return false;

  // episode_total rõ ràng đáng tin hơn cách viết episode_current.
  // Ví dụ episode_total="1", episode_current="Tập 1" vẫn là phim lẻ.
  if (total === 1) return true;
  if (total > 1) return false;

  if (current.includes("full")) return true;
  if (current.includes("1/1")) return true;
  if (current.includes("hoàn tất") && current.includes("1/1")) return true;

  if (current.includes("tập")) return false;
  if (current.includes("/") && !current.includes("1/1")) return false;

  return false;
}

function isSeriesAnimation(movie: MovieItem) {
  const total = getEpisodeNumber(movie.episode_total);
  const current = String(movie.episode_current || "").toLowerCase();
  const type = String(movie.type || "").toLowerCase();

  if (type === "series") return true;
  if (type === "single") return false;

  if (total === 1) return false;
  if (total > 1) return true;
  if (current.includes("tập")) return true;
  if (current.includes("/") && !current.includes("1/1")) return true;

  return false;
}'''
        text = replace_once(text, old_animation, new_animation, "kkphim animation")

    if "BAOFLIX_V9_MULTI_FILTER_REQUESTS" not in text:
        old_sources = '''    if (categorySlugs.length && countrySlugs.length) {
      categorySlugs.forEach((categorySlug) => {
        countrySlugs.forEach((countrySlug) => {
          if (type && type !== "tat-ca") {
            tasks.push(getMoviesByList(type, sourcePage, sourceLimit, {
              ...baseFilters,
              category: categorySlug,
              country: countrySlug,
            }));
          } else {
            tasks.push(getMoviesByGenre(categorySlug, sourcePage, sourceLimit, {
              ...baseFilters,
              country: countrySlug,
            }));
          }
        });
      });
      return tasks;
    }'''
        new_sources = '''    // BAOFLIX_V9_MULTI_FILTER_REQUESTS
    // Không nhân chéo category x country. Chọn phía ít lựa chọn hơn làm nguồn,
    // rồi applyLocalMultiTagFilter() giữ AND giữa hai nhóm điều kiện.
    if (categorySlugs.length && countrySlugs.length) {
      const useCategorySources =
        categorySlugs.length <= countrySlugs.length;

      if (useCategorySources) {
        categorySlugs.forEach((categorySlug) => {
          if (type && type !== "tat-ca") {
            tasks.push(getMoviesByList(type, sourcePage, sourceLimit, {
              ...baseFilters,
              category: categorySlug,
            }));
          } else {
            tasks.push(
              getMoviesByGenre(
                categorySlug,
                sourcePage,
                sourceLimit,
                baseFilters
              )
            );
          }
        });
      } else {
        countrySlugs.forEach((countrySlug) => {
          if (type && type !== "tat-ca") {
            tasks.push(getMoviesByList(type, sourcePage, sourceLimit, {
              ...baseFilters,
              country: countrySlug,
            }));
          } else {
            tasks.push(
              getMoviesByCountry(
                countrySlug,
                sourcePage,
                sourceLimit,
                baseFilters
              )
            );
          }
        });
      }

      return tasks;
    }'''
        text = replace_once(text, old_sources, new_sources, "kkphim multi-filter sources")

        text = replace_once(
            text,
            '''  const targetCount = (page + 1) * limit;
  const minimumSourcePages = page + 1;''',
            '''  // Đủ current page + 1 item là đủ biết còn trang sau.
  const targetCount = page * limit + 1;''',
            "kkphim target count",
        )
        text = replace_once(
            text,
            '''    if (sourcePage >= minimumSourcePages && finalItems.length >= targetCount) break;
    if (!hasMoreSourcePages) break;''',
            '''    if (finalItems.length >= targetCount) break;
    if (!hasMoreSourcePages) break;''',
            "kkphim early stop",
        )

    return text


def patch_custom_movie_form(text: str) -> str:
    if "BAOFLIX_V9_CUSTOM_SLUG_FORM" in text:
        return text
    return replace_once(
        text,
        '''  const autoSlug = useMemo(() => slugify(name), [name]);
  const finalSlug = slug.trim() || autoSlug;''',
        '''  // BAOFLIX_V9_CUSTOM_SLUG_FORM
  // Không gọi slugify("") trong render vì slugify có fallback theo thời gian.
  const autoSlug = useMemo(
    () => (name.trim() ? slugify(name) : ""),
    [name]
  );
  const normalizedManualSlug = useMemo(
    () => (slug.trim() ? slugify(slug) : ""),
    [slug]
  );
  const finalSlug = normalizedManualSlug || autoSlug;''',
        "CustomMovieForm slug",
    )


def patch_custom_movies_client(text: str) -> str:
    if "BAOFLIX_V9_CUSTOM_SLUG_SAVE" in text:
        return text
    return replace_once(
        text,
        '''  const name = input.name.trim();
  const slug = input.slug?.trim() || slugify(name);''',
        '''  const name = input.name.trim();
  // BAOFLIX_V9_CUSTOM_SLUG_SAVE
  // Normalize cả slug nhập tay để caller ngoài form cũng không lưu route bẩn.
  const slug = slugify(input.slug?.trim() || name);''',
        "customMoviesClient slug",
    )


def patch_my_taste(text: str) -> str:
    if "BAOFLIX_V9_MY_TASTE_ABORT" in text:
        return text
    old = '''  useEffect(() => {
    async function loadTasteMovies() {
      setLoading(true);

      const params = new URLSearchParams();

      if (topCountry?.slug) params.set("country", topCountry.slug);
      if (topCategory?.slug) params.set("category", topCategory.slug);

      if (!params.toString()) {
        setMovies([]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/my-taste?${params.toString()}`);
        const data = await res.json();
        setMovies(data.items || []);
      } catch {
        setMovies([]);
      } finally {
        setLoading(false);
      }
    }

    loadTasteMovies();
  }, [topCountry?.slug, topCategory?.slug]);'''
    new = '''  useEffect(() => {
    // BAOFLIX_V9_MY_TASTE_ABORT
    let cancelled = false;
    const controller = new AbortController();

    async function loadTasteMovies() {
      const params = new URLSearchParams();

      if (topCountry?.slug) params.set("country", topCountry.slug);
      if (topCategory?.slug) params.set("category", topCategory.slug);

      if (!params.toString()) {
        setMovies([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const res = await fetch(
          `/api/my-taste?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error("Không lấy được gợi ý theo gu.");
        }

        const data = await res.json();
        if (!cancelled) {
          setMovies(Array.isArray(data?.items) ? data.items : []);
        }
      } catch {
        if (!cancelled) setMovies([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTasteMovies();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [topCountry?.slug, topCategory?.slug]);'''
    return replace_once(text, old, new, "MyTasteClient abort")


def build(root: Path) -> dict[str, str]:
    return {
        "lib/kkphim.ts": patch_kkphim(read(root / "lib/kkphim.ts")),
        "components/CustomMovieForm.tsx": patch_custom_movie_form(read(root / "components/CustomMovieForm.tsx")),
        "lib/customMoviesClient.ts": patch_custom_movies_client(read(root / "lib/customMoviesClient.ts")),
        "components/MyTasteClient.tsx": patch_my_taste(read(root / "components/MyTasteClient.tsx")),
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
        if saved.exists():
            target = root / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(saved, target)


def run(root: Path, command: list[str]) -> int:
    print("$", " ".join(command))
    return subprocess.run(command, cwd=root).returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="BảoFlix V9 selected logic fixes")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    root = find_root(args.root)
    print("Repo:", root)

    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    if package.get("name") != "baoflix":
        print("Cảnh báo package name:", repr(package.get("name")))

    patched = build(root)
    changed = [rel for rel, content in patched.items() if read(root / rel) != content]

    if not changed:
        print("Không có thay đổi: V9 có thể đã được áp dụng.")
        return 0

    print("Sẽ sửa:")
    for rel in changed:
        print(" -", rel)

    if args.dry_run:
        print("Dry-run OK: tất cả marker khớp main hiện tại.")
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = root.parent / f"{root.name}_patch_backups" / f"v9_{stamp}"
    backup_files(root, changed, backup_dir)
    print("Backup:", backup_dir)

    try:
        for rel in changed:
            write(root / rel, patched[rel])

        print("Patch V9 hoàn tất.")

        if args.check:
            npm = "npm.cmd" if os.name == "nt" else "npm"
            lint_targets = [rel for rel in changed if Path(rel).suffix.lower() in {".ts", ".tsx", ".js", ".jsx", ".mts"}]
            if lint_targets and run(root, [npm, "exec", "--", "eslint", *lint_targets]) != 0:
                fail("Patched source lint failed")
            if run(root, [npm, "run", "build"]) != 0:
                fail("npm run build failed")
            print("Lint patched files + build: OK.")
        else:
            print("Nên chạy --check trước khi commit/push.")

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
