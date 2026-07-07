#!/usr/bin/env python3
from pathlib import Path
import re
import shutil
import sys

ROOT = Path.cwd()
CHANGED = []


def die(message: str) -> None:
    print(f"\n[ERROR] {message}")
    sys.exit(1)


def read_file(path: str) -> str:
    file_path = ROOT / path
    if not file_path.exists():
        die(f"Không tìm thấy {path}. Hãy chạy script ở root project BảoFlix.")
    return file_path.read_text(encoding="utf-8")


def write_file(path: str, content: str) -> None:
    file_path = ROOT / path
    backup_path = file_path.with_suffix(file_path.suffix + ".phase4b.bak")
    if not backup_path.exists():
        shutil.copyfile(file_path, backup_path)
    file_path.write_text(content, encoding="utf-8")
    CHANGED.append(path)


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if old not in content:
        print(f"[WARN] Không thấy: {label}")
        return content
    print(f"[OK] {label}")
    return content.replace(old, new, 1)


def replace_all(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count == 0:
        print(f"[WARN] Không thấy: {label}")
        return content
    print(f"[OK] {label}: {count} chỗ")
    return content.replace(old, new)


def patch_watch_overlay() -> None:
    path = "components/TvWatchOverlay.tsx"
    content = read_file(path)

    pairs_once = [
        (
            'className="pointer-events-auto mx-auto mb-2 w-full max-w-[440px] rounded-2xl border border-white/10 bg-black/[0.76] p-3 text-center shadow-2xl backdrop-blur-md"',
            'className="pointer-events-auto mx-auto mb-2 w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#080c14]/[0.94] p-4 text-center shadow-[0_18px_54px_rgba(0,0,0,0.66)] backdrop-blur-xl"',
            "Overlay confirm surface",
        ),
        (
            '"grid grid-cols-3 gap-2"',
            '"grid grid-cols-3 gap-3"',
            "Overlay transport gap",
        ),
        (
            '"mt-2 grid grid-cols-4 gap-2"',
            '"mt-3 grid grid-cols-4 gap-2.5"',
            "Overlay action gap",
        ),
        (
            'className="pointer-events-auto mx-auto max-h-[48vh] w-full max-w-[760px] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#070b12]/[0.92] p-3 shadow-[0_18px_56px_rgba(0,0,0,0.62)] backdrop-blur-xl min-[1280px]:max-w-[840px]"',
            'className="pointer-events-auto mx-auto max-h-[54vh] w-full max-w-[780px] overflow-hidden rounded-3xl border border-white/[0.12] bg-[#070b12]/[0.96] p-4 shadow-[0_22px_68px_rgba(0,0,0,0.68)] backdrop-blur-xl min-[1280px]:max-w-[880px]"',
            "Overlay panel surface",
        ),
        (
            'className="rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black text-white transition hover:bg-white/[0.16] min-[1280px]:text-[11px]"',
            'className="rounded-2xl bg-white/10 px-3.5 py-2.5 text-[10px] font-black text-white transition hover:bg-white/[0.16] min-[1280px]:text-[11px]"',
            "Overlay close tab density",
        ),
        (
            'className="grid max-h-[30vh] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6"',
            'className="grid max-h-[34vh] grid-cols-4 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-5 min-[1280px]:grid-cols-6"',
            "Overlay episode grid density",
        ),
        (
            '"relative flex min-h-[34px] items-center justify-center rounded-xl border px-2 text-center text-[10px] font-black transition"',
            '"relative flex min-h-[40px] items-center justify-center rounded-2xl border px-2 text-center text-[11px] font-black transition"',
            "Overlay episode item density",
        ),
        (
            '"mt-3 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-black text-slate-200 hover:bg-white/[0.12]"',
            '"mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2.5 text-[11px] font-black text-slate-200 hover:bg-white/[0.13]"',
            "Overlay full list button",
        ),
        (
            'className="grid max-h-[34vh] gap-2 overflow-y-auto pr-1"',
            'className="grid max-h-[36vh] gap-2.5 overflow-y-auto pr-1"',
            "Overlay source grid density",
        ),
        (
            '"rounded-xl border px-3 py-3 text-left text-[12px] font-black transition"',
            '"rounded-2xl border px-4 py-3.5 text-left text-[12px] font-black transition"',
            "Overlay source item density",
        ),
    ]

    pairs_all = [
        (
            '"flex min-h-[34px] items-center justify-center px-3 text-[12px] font-black min-[1280px]:min-h-[38px] min-[1280px]:text-[13px]"',
            '"flex min-h-[44px] items-center justify-center rounded-2xl px-4 text-[13px] font-black min-[1280px]:min-h-[48px] min-[1280px]:text-sm"',
            "Overlay transport button density",
        ),
        (
            '"flex min-h-[32px] items-center justify-center px-3 text-[11px] font-black min-[1280px]:min-h-[36px] min-[1280px]:text-[12px]"',
            '"flex min-h-[40px] items-center justify-center rounded-2xl px-3 text-[11px] font-black min-[1280px]:min-h-[44px] min-[1280px]:text-[12px]"',
            "Overlay action button density",
        ),
        (
            'className="rounded-xl px-3 py-2 text-[10px] font-black transition min-[1280px]:text-[11px]"',
            'className="rounded-2xl px-3.5 py-2.5 text-[10px] font-black transition min-[1280px]:text-[11px]"',
            "Overlay tab density",
        ),
        (
            '"flex min-h-[34px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] px-3 text-center text-[11px] font-black text-white transition hover:bg-white/15"',
            '"flex min-h-[40px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] px-3 text-center text-[11px] font-black text-white transition hover:bg-white/15"',
            "Overlay prev-next density",
        ),
        (
            'className="flex min-h-[34px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-center text-[11px] font-black text-white opacity-35"',
            'className="flex min-h-[40px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-center text-[11px] font-black text-white opacity-35"',
            "Overlay disabled prev-next density",
        ),
    ]

    for old, new, label in pairs_once:
        content = replace_once(content, old, new, label)
    for old, new, label in pairs_all:
        content = replace_all(content, old, new, label)

    write_file(path, content)


def patch_filter_panel() -> None:
    path = "components/FilterPanel.tsx"
    content = read_file(path)

    pairs_once = [
        (
            'const TV_FOCUS_CLASS =\n  "focus-visible:scale-[1.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";',
            'const TV_FOCUS_CLASS =\n  "focus-visible:scale-[1.018] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/85 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:shadow-[0_0_0_5px_rgba(250,204,21,0.15),0_16px_36px_rgba(0,0,0,0.48)]";',
            "Filter focus class",
        ),
        (
            '"min-h-[32px] rounded-lg border px-2.5 py-1 text-[11px] font-black leading-tight transition min-[1280px]:min-h-[34px]"',
            '"min-h-[40px] rounded-xl border px-3 py-2 text-[11px] font-black leading-tight transition min-[1280px]:min-h-[44px]"',
            "Filter chip density",
        ),
        (
            'className="rounded-2xl border border-white/10 bg-white/[0.035] p-2.5 shadow-[0_20px_70px_rgba(0,0,0,0.18)] min-[1280px]:p-3"',
            'className="rounded-3xl border border-white/10 bg-[#070b12] p-3.5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] min-[1280px]:p-4"',
            "Filter surface",
        ),
        ("TV Filter", "Bộ lọc TV", "Filter eyebrow"),
        (
            'className="mt-0.5 text-lg font-black leading-tight min-[1280px]:text-xl"',
            'className="mt-0.5 text-2xl font-black leading-tight min-[1280px]:text-3xl"',
            "Filter title size",
        ),
        (
            'className="grid gap-2.5 xl:grid-cols-[168px_1fr_132px]"',
            'className="grid gap-3 xl:grid-cols-[164px_1fr_136px]"',
            "Filter main grid spacing",
        ),
        (
            '"min-h-[38px] rounded-lg border px-2.5 py-1.5 text-left transition"',
            '"min-h-[46px] rounded-2xl border px-3 py-2 text-left transition"',
            "Filter group button density",
        ),
        (
            'className="min-h-[176px] rounded-xl border border-white/10 bg-black/20 p-2.5 min-[1280px]:min-h-[192px]"',
            'className="min-h-[206px] rounded-2xl border border-white/10 bg-black/35 p-3 min-[1280px]:min-h-[224px]"',
            "Filter option panel surface",
        ),
        (
            '"rounded-lg bg-yellow-300 px-3 py-2 text-[11px] font-black text-black hover:bg-yellow-200 xl:min-h-[40px]"',
            '"rounded-2xl bg-yellow-300 px-3 py-3 text-[12px] font-black text-black hover:bg-yellow-200 xl:min-h-[48px]"',
            "Filter apply button density",
        ),
    ]

    pairs_all = [
        (
            '"min-h-[38px] rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left text-[11px] font-black text-white hover:bg-white/10"',
            '"min-h-[44px] rounded-2xl border border-white/10 bg-black/35 px-3.5 py-2.5 text-left text-[11px] font-black text-white hover:border-white/20 hover:bg-white/[0.08]"',
            "Filter preset density",
        ),
        ("gap-2 overflow-y-auto pr-1", "gap-2.5 overflow-y-auto pr-1", "Filter scroll grid gap"),
        (
            '"rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-white hover:bg-white/10 xl:min-h-[40px]"',
            '"rounded-2xl border border-white/10 bg-[#111827] px-3 py-3 text-[12px] font-black text-white hover:border-white/20 hover:bg-white/[0.08] xl:min-h-[48px]"',
            "Filter side secondary buttons",
        ),
    ]

    for old, new, label in pairs_once:
        content = replace_once(content, old, new, label)
    for old, new, label in pairs_all:
        content = replace_all(content, old, new, label)

    write_file(path, content)


def patch_compact_movie_card() -> None:
    path = "components/CompactMovieCard.tsx"
    content = read_file(path)

    pairs_once = [
        (
            'const TV_CARD_FOCUS_CLASS =\n  "focus-visible:scale-[1.018] focus-visible:border-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:shadow-[0_0_0_5px_rgba(250,204,21,0.16),0_18px_38px_rgba(0,0,0,0.55)]";',
            'const TV_CARD_FOCUS_CLASS =\n  "focus-visible:scale-[1.014] focus-visible:border-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:shadow-[0_0_0_5px_rgba(250,204,21,0.15),0_18px_38px_rgba(0,0,0,0.55)]";',
            "Compact card focus scale",
        ),
        (
            'className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] transition hover:-translate-y-0.5 hover:bg-white/[0.07] focus-within:border-yellow-300 focus-within:ring-2 focus-within:ring-yellow-300/90 focus-within:ring-offset-2 focus-within:ring-offset-black focus-within:shadow-[0_0_0_4px_rgba(250,204,21,0.16),0_16px_34px_rgba(0,0,0,0.5)]"',
            'className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#10141f] transition hover:-translate-y-0.5 hover:border-yellow-300/70 hover:bg-[#151b2a] focus-within:border-yellow-300 focus-within:ring-2 focus-within:ring-yellow-300/90 focus-within:ring-offset-2 focus-within:ring-offset-black focus-within:shadow-[0_0_0_4px_rgba(250,204,21,0.16),0_16px_34px_rgba(0,0,0,0.5)]"',
            "Compact card surface",
        ),
        ('className={["block rounded-lg", TV_CARD_FOCUS_CLASS].join(" ")}', 'className={["block rounded-2xl", TV_CARD_FOCUS_CLASS].join(" ")}', "Compact link radius"),
        (
            'className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.035] group-focus-within:scale-[1.035]"',
            'className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.025] group-focus-within:scale-[1.025]"',
            "Compact poster scale",
        ),
        (
            'className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent p-1.5 pt-10"',
            'className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent p-2 pt-10"',
            "Compact bottom overlay",
        ),
        ('className="min-h-[52px] space-y-0.5 p-1.5"', 'className="min-h-[50px] space-y-0.5 p-2"', "Compact text area"),
        (
            'className="line-clamp-2 text-[11px] font-black leading-tight text-white min-[1280px]:text-[12px]"',
            'className="line-clamp-2 text-[12px] font-black leading-tight text-white min-[1280px]:text-[13px]"',
            "Compact title size",
        ),
        ('visibleMeta.slice(0, 3).map((item, index) => (', 'visibleMeta.slice(0, 2).map((item, index) => (', "Compact meta count"),
    ]

    for old, new, label in pairs_once:
        content = replace_once(content, old, new, label)

    write_file(path, content)


def patch_search_box_label() -> None:
    path = "components/TvSearchBox.tsx"
    content = read_file(path)
    next_content = re.sub(r'(\n\s*)Space(\n\s*</button>)', r'\1Cách\2', content, count=1)
    if next_content != content:
        print("[OK] Keyboard Space -> Cách")
        content = next_content
    else:
        print("[WARN] Không thấy label Space.")
    write_file(path, content)


def main() -> None:
    patch_watch_overlay()
    patch_filter_panel()
    patch_compact_movie_card()
    patch_search_box_label()

    print("\n[OK] Phase 4B polish patch xong.")
    print("Đã ghi:")
    for path in CHANGED:
        print(f"- {path}")
    print("\nBackup tạo cạnh file gốc dạng *.phase4b.bak")
    print("Giờ chạy:")
    print("  npm run lint")
    print("  npm run build")


if __name__ == "__main__":
    main()
