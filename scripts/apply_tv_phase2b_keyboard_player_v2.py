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
        die(f"Không tìm thấy {path}. Hãy chạy script ở root project BảoFlix.")
    return file_path.read_text(encoding="utf-8")


def write(path, content):
    file_path = ROOT / path
    backup_path = file_path.with_suffix(file_path.suffix + ".phase2b.bak")
    if not backup_path.exists():
        shutil.copyfile(file_path, backup_path)
    file_path.write_text(content, encoding="utf-8")
    CHANGED.append(path)


def soft_replace(content, old, new, label):
    if new in content:
        print(f"[SKIP] {label} đã có.")
        return content
    if old not in content:
        print(f"[WARN] Không thấy block: {label}. Bỏ qua block này.")
        return content
    print(f"[OK] {label}")
    return content.replace(old, new, 1)


def add_after_marker(content, marker, insert, label, exists):
    if exists in content:
        print(f"[SKIP] {label} đã có.")
        return content
    if marker not in content:
        print(f"[WARN] Không thấy marker: {label}. Bỏ qua.")
        return content
    print(f"[OK] {label}")
    return content.replace(marker, marker + insert, 1)


def add_attr_to_row_key(content, row_key, attr, label):
    pattern = re.compile(r'(<div\\b(?=[^>]*data-tv-row-key="' + re.escape(row_key) + r'")[^>]*)(>)', re.S)

    def repl(match):
        tag = match.group(1)
        if attr in tag:
            return match.group(0)
        return f"{tag} {attr}{match.group(2)}"

    next_content, count = pattern.subn(repl, content, count=1)
    if count:
        if next_content == content:
            print(f"[SKIP] {label} đã có.")
        else:
            print(f"[OK] {label}")
        return next_content

    print(f"[WARN] Không thấy row-key {row_key}: {label}. Bỏ qua.")
    return content


def patch_tv_search_box():
    path = "components/TvSearchBox.tsx"
    content = read(path)

    if 'data-tv-keyboard-panel="search"' not in content:
        content = content.replace(
            '          data-tv-scroll-align="center"\n          data-tv-focus-out-up="selector:[data-tv-keyboard-input]"',
            '          data-tv-scroll-align="center"\n          data-tv-scroll-padding="72"\n          data-tv-keyboard-panel="search"\n          data-tv-focus-out-up="selector:[data-tv-keyboard-input]"',
            1,
        )
        content = content.replace(
            'className="mt-1.5 rounded-xl border border-white/10 bg-black/40 p-1.5"',
            'className="mt-1.5 rounded-xl border border-white/10 bg-black/50 p-1.5 shadow-2xl shadow-black/35"',
            1,
        )
        print("[OK] TvSearchBox keyboard root metadata")
    else:
        print("[SKIP] TvSearchBox keyboard root metadata đã có.")

    marker = '          <div className="grid gap-1">\n'
    insert = '''            <div
              data-tv-row
              data-tv-row-key="search-keyboard:header"
              className="mb-1 grid grid-cols-[1fr_auto] gap-1.5"
            >
              <div className="min-h-8 truncate rounded-lg border border-white/10 bg-white/[0.045] px-2.5 py-1.5 text-[11px] font-black text-slate-200">
                {keyword.trim() ? keyword : "Nhập tên phim..."}
              </div>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => dismissKeyboard("tv-search:input")}
                data-tv-focus-key="tv-search-keyboard:close"
                className={[
                  "min-h-8 rounded-lg border border-white/10 bg-white/5 px-3 text-[11px] font-black text-white hover:bg-white/10",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Đóng
              </button>
            </div>

            {hydrated && history.length > 0 && (
              <div
                data-tv-row
                data-tv-row-key="search-keyboard:suggestions"
                data-tv-row-wrap="true"
                data-tv-row-loop="true"
                className="mb-1 flex flex-wrap justify-center gap-1"
              >
                {history.slice(0, 4).map((item) => (
                  <button
                    key={`keyboard-suggestion-${item}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => go(item)}
                    data-tv-focus-key={`tv-search-keyboard:suggest:${item}`}
                    className={[
                      "max-w-[120px] truncate rounded-lg border border-yellow-300/25 bg-yellow-300/10 px-2 py-1.5 text-[10px] font-black text-yellow-100 hover:bg-yellow-300 hover:text-black",
                      TV_FOCUS_CLASS,
                    ].join(" ")}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

'''
    content = add_after_marker(content, marker, insert, "TvSearchBox keyboard header + suggestions", "search-keyboard:header")

    content = soft_replace(
        content,
        '''                data-tv-row
                data-tv-row-wrap="true"
                className="flex flex-wrap justify-center gap-1.5"
''',
        '''                data-tv-row
                data-tv-row-key={`search-keyboard:letters:${rowIndex}`}
                data-tv-row-wrap="true"
                data-tv-row-loop="true"
                className="flex flex-wrap justify-center gap-1.5"
''',
        "TvSearchBox letter row key/loop",
    )

    content = add_attr_to_row_key(content, "search-keyboard:actions", 'data-tv-row-loop="true"', "TvSearchBox action row loop")
    content = content.replace(">Space</button>", ">Cách</button>")

    write(path, content)


def patch_tv_watch_overlay():
    path = "components/TvWatchOverlay.tsx"
    content = read(path)

    content = add_attr_to_row_key(content, "overlay:exit-confirm", 'data-tv-row-loop="true"', "TvWatchOverlay exit confirm row loop")
    content = add_attr_to_row_key(content, "overlay:transport", 'data-tv-row-loop="true"', "TvWatchOverlay transport row loop")
    content = add_attr_to_row_key(content, "overlay:actions", 'data-tv-row-loop="true"', "TvWatchOverlay actions row loop")

    if '"mt-2 grid grid-cols-4 gap-2"' not in content:
        content = content.replace('"mt-2 grid grid-cols-3 gap-2"', '"mt-2 grid grid-cols-4 gap-2"', 1)
        print("[OK] TvWatchOverlay actions grid 4 cột")
    else:
        print("[SKIP] TvWatchOverlay actions grid 4 cột đã có.")

    if 'data-tv-focus-key="overlay:exit"' not in content:
        player_button_end = '''              >
                Player
              </button>
'''
        exit_button = '''
              <button
                type="button"
                data-tv-focus-key="overlay:exit"
                {...hiddenFocusProps}
                onClick={showExitConfirm}
                className={[
                  "flex min-h-[32px] items-center justify-center px-3 text-[11px] font-black min-[1280px]:min-h-[36px] min-[1280px]:text-[12px]",
                  SURFACE_BUTTON_CLASS,
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Thoát
              </button>
'''
        if player_button_end in content:
            content = content.replace(player_button_end, player_button_end + exit_button, 1)
            print("[OK] TvWatchOverlay thêm nút Thoát")
        else:
            print("[WARN] Không tìm thấy nút Player để thêm Thoát. Bỏ qua.")
    else:
        print("[SKIP] TvWatchOverlay nút Thoát đã có.")

    if 'data-tv-scroll-padding="72"' not in content:
        content = content.replace(
            '            data-tv-panel={overlayPanel || undefined}\n',
            '            data-tv-panel={overlayPanel || undefined}\n            data-tv-scroll-align="center"\n            data-tv-scroll-padding="72"\n',
            1,
        )
        print("[OK] TvWatchOverlay panel scroll metadata")
    else:
        print("[SKIP] TvWatchOverlay panel scroll metadata đã có.")

    if 'data-tv-focus-out-down={\n                    overlayPanel === "episodes"' not in content:
        old = '               <div data-tv-row data-tv-row-key="overlay:panel-tabs" className="flex shrink-0 items-center gap-2">\n'
        new = '''               <div
                  data-tv-row
                  data-tv-row-key="overlay:panel-tabs"
                  data-tv-row-loop="true"
                  data-tv-focus-out-down={
                    overlayPanel === "episodes"
                      ? "selector:[data-tv-episode-current='true'], [data-tv-episode-grid] a[href]"
                      : "selector:[data-tv-source-current='true'], [data-tv-panel='sources'] a[href]"
                  }
                  className="flex shrink-0 items-center gap-2"
                >
'''
        content = soft_replace(content, old, new, "TvWatchOverlay panel tabs focus-out")
    else:
        print("[SKIP] TvWatchOverlay panel tabs focus-out đã có.")

    if 'data-tv-focus-out-down="selector:[data-tv-episode-current' not in content:
        old = '                   <div data-tv-episode-chunks data-tv-row data-tv-row-key="overlay:episode-chunks" data-tv-row-wrap="true" className="mb-2 flex gap-2 overflow-x-auto pb-1">\n'
        new = '''                   <div
                    data-tv-episode-chunks
                    data-tv-row
                    data-tv-row-key="overlay:episode-chunks"
                    data-tv-row-wrap="true"
                    data-tv-row-loop="true"
                    data-tv-scroll-align="center"
                    data-tv-focus-out-up="focus-key:overlay-tab:episodes"
                    data-tv-focus-out-down="selector:[data-tv-episode-current='true'], [data-tv-episode-grid] a[href]"
                    className="mb-2 flex gap-2 overflow-x-auto pb-1"
                  >
'''
        content = soft_replace(content, old, new, "TvWatchOverlay episode chunks focus-out")
    else:
        print("[SKIP] TvWatchOverlay episode chunks focus-out đã có.")

    if 'data-tv-focus-out-down="focus-key:overlay:full-episode-list"' not in content:
        content = content.replace(
            '                  data-tv-scroll-align="center"\n                  className="grid max-h-[30vh] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6"\n',
            '                  data-tv-scroll-align="center"\n                  data-tv-scroll-padding="56"\n                  data-tv-focus-out-up="selector:[data-tv-episode-chunks] button:not([disabled]), [data-tv-focus-key=\'overlay-tab:episodes\']"\n                  data-tv-focus-out-down="focus-key:overlay:full-episode-list"\n                  className="grid max-h-[30vh] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6"\n',
            1,
        )
        print("[OK] TvWatchOverlay episode grid focus-out")
    else:
        print("[SKIP] TvWatchOverlay episode grid focus-out đã có.")

    if 'data-tv-row-key="overlay:sources-grid"' not in content:
        content = content.replace(
            '''              <div
                data-tv-panel="sources"
                data-tv-row
                data-tv-row-wrap="true"
                className="grid max-h-[34vh] gap-2 overflow-y-auto pr-1"
''',
            '''              <div
                data-tv-panel="sources"
                data-tv-row
                data-tv-row-key="overlay:sources-grid"
                data-tv-row-wrap="true"
                data-tv-scroll-align="center"
                data-tv-scroll-padding="56"
                data-tv-focus-out-up="focus-key:overlay-tab:sources"
                className="grid max-h-[34vh] gap-2 overflow-y-auto pr-1"
''',
            1,
        )
        print("[OK] TvWatchOverlay sources grid metadata")
    else:
        print("[SKIP] TvWatchOverlay sources grid metadata đã có.")

    write(path, content)


def main():
    patch_tv_search_box()
    patch_tv_watch_overlay()

    print("\n[OK] Phase 2B patch v2 chạy xong.")
    print("Đã ghi:")
    for path in CHANGED:
        print(f"- {path}")

    print("\nBackup nằm cạnh file gốc dạng *.phase2b.bak.")
    print("Giờ chạy:")
    print("  npm run lint")
    print("  npm run build")


if __name__ == "__main__":
    main()
