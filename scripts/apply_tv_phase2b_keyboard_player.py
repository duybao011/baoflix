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
    backup_path = file_path.with_suffix(file_path.suffix + ".phase2b.bak")
    if not backup_path.exists():
        shutil.copyfile(file_path, backup_path)
    file_path.write_text(content, encoding="utf-8")
    CHANGED.append(path)


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if new in content:
        print(f"[SKIP] {label} đã có.")
        return content
    if old not in content:
        die(f"Không tìm thấy block cần thay: {label}. Có thể file đã khác nhiều, gửi lại lỗi build/log để mình sửa patch.")
    return content.replace(old, new, 1)


def patch_tv_search_box() -> None:
    path = "components/TvSearchBox.tsx"
    content = read(path)

    content = replace_once(
        content,
        """          data-tv-scroll-align="center"
          data-tv-focus-out-up="selector:[data-tv-keyboard-input]"
          className="mt-1.5 rounded-xl border border-white/10 bg-black/40 p-1.5"
""",
        """          data-tv-scroll-align="center"
          data-tv-scroll-padding="72"
          data-tv-keyboard-panel="search"
          data-tv-focus-out-up="selector:[data-tv-keyboard-input]"
          className="mt-1.5 rounded-xl border border-white/10 bg-black/50 p-1.5 shadow-2xl shadow-black/35"
""",
        "TvSearchBox keyboard root metadata",
    )

    content = replace_once(
        content,
        """          <div className="grid gap-1">
            {TV_KEYBOARD_ROWS.map((row, rowIndex) => (
""",
        """          <div className="grid gap-1">
            <div
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

            {TV_KEYBOARD_ROWS.map((row, rowIndex) => (
""",
        "TvSearchBox keyboard header + suggestions",
    )

    content = replace_once(
        content,
        """                data-tv-row
                data-tv-row-wrap="true"
                className="flex flex-wrap justify-center gap-1.5"
""",
        """                data-tv-row
                data-tv-row-key={`search-keyboard:letters:${rowIndex}`}
                data-tv-row-wrap="true"
                data-tv-row-loop="true"
                className="flex flex-wrap justify-center gap-1.5"
""",
        "TvSearchBox keyboard rows row-key/loop",
    )

    content = replace_once(
        content,
        """            <div data-tv-row data-tv-row-key="search-keyboard:actions" data-tv-row-wrap="true" className="mt-1 grid grid-cols-5 gap-1">
""",
        """            <div
              data-tv-row
              data-tv-row-key="search-keyboard:actions"
              data-tv-row-wrap="true"
              data-tv-row-loop="true"
              className="mt-1 grid grid-cols-5 gap-1"
            >
""",
        "TvSearchBox keyboard action row loop",
    )

    content = content.replace(">Space</button>", ">Cách</button>")

    write(path, content)


def patch_tv_watch_overlay() -> None:
    path = "components/TvWatchOverlay.tsx"
    content = read(path)

    content = replace_once(
        content,
        """            <div data-tv-row data-tv-row-key="overlay:exit-confirm" className="mt-3 grid grid-cols-2 gap-2">
""",
        """            <div data-tv-row data-tv-row-key="overlay:exit-confirm" data-tv-row-loop="true" className="mt-3 grid grid-cols-2 gap-2">
""",
        "TvWatchOverlay exit confirm row loop",
    )

    content = replace_once(
        content,
        """              <div
                data-tv-row
                data-tv-row-key="overlay:transport"
                className={[
""",
        """              <div
                data-tv-row
                data-tv-row-key="overlay:transport"
                data-tv-row-loop="true"
                className={[
""",
        "TvWatchOverlay transport row loop",
    )

    content = replace_once(
        content,
        """              <div
                data-tv-row
                data-tv-row-key="overlay:actions"
                className={[
                  "mt-2 grid grid-cols-3 gap-2",
""",
        """              <div
                data-tv-row
                data-tv-row-key="overlay:actions"
                data-tv-row-loop="true"
                className={[
                  "mt-2 grid grid-cols-4 gap-2",
""",
        "TvWatchOverlay actions row loop + 4 columns",
    )

    content = replace_once(
        content,
        """              <button
                type="button"
                data-tv-focus-key="overlay:player"
                {...hiddenFocusProps}
                onClick={handleFocusPlayer}
                className={[
                  "flex min-h-[32px] items-center justify-center px-3 text-[11px] font-black min-[1280px]:min-h-[36px] min-[1280px]:text-[12px]",
                  SURFACE_BUTTON_CLASS,
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Player
              </button>
""",
        """              <button
                type="button"
                data-tv-focus-key="overlay:player"
                {...hiddenFocusProps}
                onClick={handleFocusPlayer}
                className={[
                  "flex min-h-[32px] items-center justify-center px-3 text-[11px] font-black min-[1280px]:min-h-[36px] min-[1280px]:text-[12px]",
                  SURFACE_BUTTON_CLASS,
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Player
              </button>

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
""",
        "TvWatchOverlay add exit action button",
    )

    content = replace_once(
        content,
        """          <div
            data-tv-panel={overlayPanel || undefined}
            className="pointer-events-auto mx-auto max-h-[48vh] w-full max-w-[760px] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#070b12]/[0.92] p-3 shadow-[0_18px_56px_rgba(0,0,0,0.62)] backdrop-blur-xl min-[1280px]:max-w-[840px]"
""",
        """          <div
            data-tv-panel={overlayPanel || undefined}
            data-tv-scroll-align="center"
            data-tv-scroll-padding="72"
            className="pointer-events-auto mx-auto max-h-[48vh] w-full max-w-[760px] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#070b12]/[0.92] p-3 shadow-[0_18px_56px_rgba(0,0,0,0.62)] backdrop-blur-xl min-[1280px]:max-w-[840px]"
""",
        "TvWatchOverlay panel scroll metadata",
    )

    content = replace_once(
        content,
        """               <div data-tv-row data-tv-row-key="overlay:panel-tabs" className="flex shrink-0 items-center gap-2">
""",
        """               <div
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
""",
        "TvWatchOverlay panel tabs focus-out",
    )

    content = replace_once(
        content,
        """                   <div data-tv-episode-chunks data-tv-row data-tv-row-key="overlay:episode-chunks" data-tv-row-wrap="true" className="mb-2 flex gap-2 overflow-x-auto pb-1">
""",
        """                   <div
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
""",
        "TvWatchOverlay episode chunks focus-out",
    )

    content = replace_once(
        content,
        """                  data-tv-scroll-align="center"
                  className="grid max-h-[30vh] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6"
""",
        """                  data-tv-scroll-align="center"
                  data-tv-scroll-padding="56"
                  data-tv-focus-out-up="selector:[data-tv-episode-chunks] button:not([disabled]), [data-tv-focus-key='overlay-tab:episodes']"
                  data-tv-focus-out-down="focus-key:overlay:full-episode-list"
                  className="grid max-h-[30vh] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6"
""",
        "TvWatchOverlay episode grid focus-out",
    )

    content = replace_once(
        content,
        """              <div
                data-tv-panel="sources"
                data-tv-row
                data-tv-row-wrap="true"
                className="grid max-h-[34vh] gap-2 overflow-y-auto pr-1"
""",
        """              <div
                data-tv-panel="sources"
                data-tv-row
                data-tv-row-key="overlay:sources-grid"
                data-tv-row-wrap="true"
                data-tv-scroll-align="center"
                data-tv-scroll-padding="56"
                data-tv-focus-out-up="focus-key:overlay-tab:sources"
                className="grid max-h-[34vh] gap-2 overflow-y-auto pr-1"
""",
        "TvWatchOverlay sources grid metadata",
    )

    write(path, content)


def main() -> None:
    patch_tv_search_box()
    patch_tv_watch_overlay()

    print("\n[OK] Phase 2B patch xong.")
    print("Đã sửa:")
    for path in CHANGED:
        print(f"- {path}")
    print("\nBackup được tạo dạng *.phase2b.bak cạnh file gốc.")
    print("Giờ chạy:")
    print("  npm run lint")
    print("  npm run build")


if __name__ == "__main__":
    main()
