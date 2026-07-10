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


def read(path: str) -> str:
    file_path = ROOT / path
    if not file_path.exists():
        die(f"Không tìm thấy {path}. Hãy chạy script ở root project BảoFlix.")
    return file_path.read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    file_path = ROOT / path
    backup_path = file_path.with_suffix(file_path.suffix + ".tv-keyboard-overlay.bak")
    if not backup_path.exists():
        shutil.copyfile(file_path, backup_path)
    file_path.write_text(content, encoding="utf-8")
    CHANGED.append(path)


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if new in content:
        print(f"[SKIP] {label} đã có.")
        return content
    if old not in content:
        die(f"Không thấy block: {label}")
    print(f"[OK] {label}")
    return content.replace(old, new, 1)


def replace_regex(content: str, pattern: str, replacement: str, label: str) -> str:
    next_content, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if not count:
        die(f"Không match: {label}")
    print(f"[OK] {label}")
    return next_content


def patch_search_box() -> None:
    path = "components/TvSearchBox.tsx"
    c = read(path)
    c = replace_once(c, "function requestKeyboard(input: HTMLInputElement | null) {", "function requestKeyboard(input: HTMLInputElement | null, openNativeKeyboard = true) {", "tách custom TV và native keyboard")
    c = replace_once(c, """  try {\n    input.click();\n  } catch {}\n""", """  if (!openNativeKeyboard) return;\n\n  try {\n    input.click();\n  } catch {}\n""", "chặn native keyboard trong TV mode")
    c = replace_once(c, """    if (!text) {\n      requestKeyboard(inputRef.current);\n      setFocused(true);\n      return;\n    }\n""", """    if (!text) {\n      const useTvKeyboard = isTvKeyboardEnabled();\n      setFocused(useTvKeyboard);\n      requestKeyboard(inputRef.current, !useTvKeyboard);\n      return;\n    }\n""", "submit rỗng mở đúng keyboard")
    c = replace_once(c, """  function schedule() {\n    if (suppressKeyboardRef.current) return;\n\n    setFocused(true);\n\n    if (timer.current) window.clearTimeout(timer.current);\n\n    timer.current = window.setTimeout(() => {\n      requestKeyboard(inputRef.current);\n      timer.current = null;\n    }, 60);\n  }\n""", """  function schedule() {\n    if (suppressKeyboardRef.current) return;\n\n    const useTvKeyboard = isTvKeyboardEnabled();\n    setFocused(useTvKeyboard);\n\n    if (timer.current) {\n      window.clearTimeout(timer.current);\n      timer.current = null;\n    }\n\n    if (useTvKeyboard) {\n      requestKeyboard(inputRef.current, false);\n      return;\n    }\n\n    timer.current = window.setTimeout(() => {\n      requestKeyboard(inputRef.current, true);\n      timer.current = null;\n    }, 60);\n  }\n""", "TV chỉ dùng custom keyboard")
    c = replace_once(c, """  function clearKeyword() {\n    setKeyword(\"\");\n    setFocused(true);\n    window.setTimeout(() => requestKeyboard(inputRef.current), 40);\n  }\n""", """  function clearKeyword() {\n    setKeyword(\"\");\n    setFocused(true);\n\n    if (!isTvKeyboardEnabled()) {\n      window.setTimeout(() => requestKeyboard(inputRef.current, true), 40);\n    }\n  }\n""", "xóa không giành focus")
    c = replace_once(c, """  function clearHistory() {\n    localStorage.removeItem(SEARCH_HISTORY_KEY);\n    setHistory([]);\n    setFocused(true);\n    window.setTimeout(() => requestKeyboard(inputRef.current), 40);\n  }\n""", """  function clearHistory() {\n    localStorage.removeItem(SEARCH_HISTORY_KEY);\n    setHistory([]);\n    setFocused(true);\n\n    if (!isTvKeyboardEnabled()) {\n      window.setTimeout(() => requestKeyboard(inputRef.current, true), 40);\n    }\n  }\n""", "xóa lịch sử không bật soft keyboard TV")
    c = replace_once(c, """            spellCheck={false}\n            data-tv-keyboard-input\n""", """            spellCheck={false}\n            readOnly={tvKeyboardEnabled}\n            data-tv-keyboard-input\n""", "input readonly ở TV mode")
    c = replace_once(c, """            onClick={() => requestKeyboard(inputRef.current)}\n""", """            onClick={() => {\n              const useTvKeyboard = isTvKeyboardEnabled();\n              setFocused(useTvKeyboard);\n              requestKeyboard(inputRef.current, !useTvKeyboard);\n            }}\n""", "click không mở hai keyboard")
    c = replace_once(c, """                 requestKeyboard(inputRef.current);\n                 setFocused(true);\n""", """                 const useTvKeyboard = isTvKeyboardEnabled();\n                 requestKeyboard(inputRef.current, !useTvKeyboard);\n                 setFocused(useTvKeyboard);\n""", "Enter rỗng không mở hai keyboard")
    c = replace_once(c, """        <div\n          data-tv-search-keyboard\n          data-tv-row\n          data-tv-row-key=\"search:keyboard\"\n          data-tv-row-wrap=\"true\"\n          data-tv-scroll-align=\"center\"\n""", """        <div\n          data-tv-search-keyboard\n          data-tv-scroll-align=\"center\"\n""", "bỏ nested row ở keyboard root")
    c = replace_once(c, """          className=\"mt-1.5 rounded-xl border border-white/10 bg-black/50 p-1.5 shadow-2xl shadow-black/35\"\n""", """          className=\"mt-2 rounded-2xl border border-white/10 bg-[#070b12]/95 p-2.5 shadow-2xl shadow-black/45\"\n""", "panel keyboard TV rõ hơn")
    c = replace_once(c, """                    data-tv-focus-key={`tv-search-keyboard:${rowIndex}:${keyValue}`}\n                    className={[\n                      \"min-h-8 min-w-8 rounded-lg border border-white/10 bg-white/5 px-1.5 text-xs font-black text-white hover:bg-white/10 min-[1280px]:min-h-9 min-[1280px]:min-w-9\",\n""", """                    data-tv-focus-key={`tv-search-keyboard:${rowIndex}:${keyValue}`}\n                    data-tv-default={rowIndex === 0 && keyValue === \"q\" ? true : undefined}\n                    className={[\n                      \"min-h-10 min-w-10 rounded-xl border border-white/10 bg-white/[0.07] px-2 text-sm font-black text-white hover:bg-white/[0.14] min-[1280px]:min-h-11 min-[1280px]:min-w-11\",\n""", "Q là default và key to hơn")
    c = c.replace('"min-h-8 rounded-lg border border-white/10 bg-white/5 px-1.5 text-xs font-black text-white hover:bg-white/10 min-[1280px]:min-h-9"', '"min-h-10 rounded-xl border border-white/10 bg-white/[0.07] px-2 text-xs font-black text-white hover:bg-white/[0.14] min-[1280px]:min-h-11"')
    c = c.replace('"min-h-8 rounded-lg bg-yellow-300 px-1.5 text-xs font-black text-black hover:bg-yellow-200 min-[1280px]:min-h-9"', '"min-h-10 rounded-xl bg-yellow-300 px-2 text-xs font-black text-black hover:bg-yellow-200 min-[1280px]:min-h-11"')
    write(path, c)


def patch_remote() -> None:
    path = "components/TvRemoteNavigator.tsx"
    c = read(path)
    c = replace_once(c, """function focusSearchKeyboard(pathname: string) {\n  const keyboard = getVisibleSearchKeyboard();\n  const target = keyboard ? getFocusableElements(keyboard)[0] : null;\n  if (!target) return false;\n\n  focusElement(target, pathname);\n  return true;\n}\n""", """function focusSearchKeyboard(pathname: string) {\n  const keyboard = getVisibleSearchKeyboard();\n  const target = keyboard\n    ? getDefaultFocusable(keyboard) || getFocusableElements(keyboard)[0]\n    : null;\n  if (!target) return false;\n\n  focusElement(target, pathname);\n  return true;\n}\n""", "Down từ input vào Q")
    write(path, c)


def patch_overlay() -> None:
    path = "components/TvWatchOverlay.tsx"
    c = read(path)
    c = replace_once(c, """  function openEpisodePanelFromOverlay() {\n    clearHideTimer();\n    setActiveChunkIndex(currentChunkIndex);\n    setOverlayMode(\"panel\");\n    window.setTimeout(onOpenEpisodePanel, 0);\n  }\n""", """  function openEpisodePanelFromOverlay() {\n    clearHideTimer();\n    hideOverlay({ focusPlayer: false });\n    window.setTimeout(onOpenEpisodePanel, 0);\n  }\n""", "ẩn overlay trong trước khi mở modal ngoài")
    c = replace_regex(c, r'<div data-tv-row data-tv-row-key="overlay:exit-confirm" className="mt-3 grid grid-cols-2 gap-2"\s+data-tv-row-loop="true">', '''<div\n              data-tv-row\n              data-tv-row-key="overlay:exit-confirm"\n              data-tv-row-loop="true"\n              className="mt-3 grid grid-cols-2 gap-2"\n            >''', "format confirm row")
    c = replace_regex(c, r'<div\s+data-tv-row\s+data-tv-row-key="overlay:transport"\s+className=\{\[\s+"grid grid-cols-3 gap-3",\s+overlayVisible \? "pointer-events-auto" : "pointer-events-none",\s+\]\.join\(" "\)\}\s+data-tv-row-loop="true">', '''<div\n              data-tv-row\n              data-tv-row-key="overlay:transport"\n              data-tv-row-loop="true"\n              className={[\n                "grid grid-cols-3 gap-3",\n                overlayVisible ? "pointer-events-auto" : "pointer-events-none",\n              ].join(" ")}\n            >''', "format transport row")
    c = replace_regex(c, r'<div\s+data-tv-row\s+data-tv-row-key="overlay:actions"\s+className=\{\[\s+"mt-3 grid grid-cols-4 gap-2\.5",\s+overlayVisible \? "pointer-events-auto" : "pointer-events-none",\s+\]\.join\(" "\)\}\s+data-tv-row-loop="true">', '''<div\n              data-tv-row\n              data-tv-row-key="overlay:actions"\n              data-tv-row-loop="true"\n              className={[\n                "mt-3 grid grid-cols-4 gap-2.5",\n                overlayVisible ? "pointer-events-auto" : "pointer-events-none",\n              ].join(" ")}\n            >''', "format action row")
    c = replace_regex(c, r'<div data-tv-row data-tv-row-key="overlay:panel-tabs" className="flex shrink-0 items-center gap-2"\s+data-tv-row-loop="true"\s+data-tv-focus-out-down=\{overlayPanel === "episodes" \? "selector:\[data-tv-episode-current=\'true\'\], \[data-tv-episode-grid\] a\[href\]" : "selector:\[data-tv-source-current=\'true\'\], \[data-tv-panel=\'sources\'\] a\[href\]"\}>', '''<div\n                  data-tv-row\n                  data-tv-row-key="overlay:panel-tabs"\n                  data-tv-row-loop="true"\n                  data-tv-focus-out-down={\n                    overlayPanel === "episodes"\n                      ? "selector:[data-tv-episode-current='true'], [data-tv-episode-grid] a[href]"\n                      : "selector:[data-tv-source-current='true'], [data-tv-panel='sources'] a[href]"\n                  }\n                  className="flex shrink-0 items-center gap-2"\n                >''', "format panel tabs")
    c = replace_regex(c, r'<div data-tv-episode-chunks data-tv-row data-tv-row-key="overlay:episode-chunks" data-tv-row-wrap="true" className="mb-2 flex gap-2 overflow-x-auto pb-1"\s+data-tv-row-loop="true"\s+data-tv-scroll-align="center"\s+data-tv-focus-out-up="focus-key:overlay-tab:episodes"\s+data-tv-focus-out-down="selector:\[data-tv-episode-current=\'true\'\], \[data-tv-episode-grid\] a\[href\]">', '''<div\n                    data-tv-episode-chunks\n                    data-tv-row\n                    data-tv-row-key="overlay:episode-chunks"\n                    data-tv-row-wrap="true"\n                    data-tv-row-loop="true"\n                    data-tv-scroll-align="center"\n                    data-tv-focus-out-up="focus-key:overlay-tab:episodes"\n                    data-tv-focus-out-down="selector:[data-tv-episode-current='true'], [data-tv-episode-grid] a[href]"\n                    className="mb-2 flex gap-2 overflow-x-auto pb-1"\n                  >''', "format episode chunks")
    write(path, c)


def patch_modal() -> None:
    path = "components/EpisodePickerModal.tsx"
    c = read(path)
    c = replace_regex(c, r'function focusModalDefault\(\) \{.*?\n\}', '''function focusModalDefault(serverIndex: number, episodeIndex: number) {\n  window.setTimeout(() => {\n    const modal = document.querySelector<HTMLElement>(\n      "[data-tv-modal='episode-picker']"\n    );\n\n    if (!modal) return;\n\n    const target =\n      modal.querySelector<HTMLElement>(\n        `[data-tv-focus-key="episode-picker:episode:${serverIndex}:${episodeIndex}"]`\n      ) ||\n      modal.querySelector<HTMLElement>(\n        `[data-tv-focus-key="episode-picker:server:${serverIndex}"]`\n      ) ||\n      modal.querySelector<HTMLElement>("[data-tv-default]") ||\n      modal.querySelector<HTMLElement>("a[href], button:not([disabled])");\n\n    if (!target) return;\n\n    target.focus({ preventScroll: true });\n    target.scrollIntoView({\n      behavior: "auto",\n      block: "center",\n      inline: "center",\n    });\n  }, 80);\n}''', "focus đúng tập hiện tại")
    c = replace_regex(c, r'  useEffect\(\(\) => \{\s+focusModalDefault\(\);\s+\}, \[\]\);\s+\n\s+useEffect\(\(\) => \{\s+focusModalDefault\(\);\s+\}, \[selectedServerIndex, activeGroupIndex\]\);', '''  useEffect(() => {\n    focusModalDefault(safeServerIndex, safeEpisodeIndex);\n  }, [safeServerIndex, safeEpisodeIndex]);''', "bỏ effect giành focus")
    c = replace_once(c, '          <div className="flex items-start justify-between gap-4">', '''          <div\n            data-tv-row\n            data-tv-row-key="episode-picker:header"\n            data-tv-focus-out-down={`focus-key:episode-picker:server:${selectedServerIndex}`}\n            className="flex items-start justify-between gap-4"\n          >''', "header row")
    c = replace_once(c, '''              data-tv-close\n              onClick={onClose}''', '''              data-tv-close\n              data-tv-focus-key="episode-picker:close"\n              onClick={onClose}''', "close focus key")
    c = replace_once(c, '              <div className="flex flex-wrap gap-2">', '''              <div\n                data-tv-row\n                data-tv-row-key="episode-picker:quick-actions"\n                data-tv-row-loop="true"\n                data-tv-focus-out-down={`focus-key:episode-picker:server:${selectedServerIndex}`}\n                className="flex flex-wrap gap-2"\n              >''', "quick actions row")
    c = replace_once(c, '            <div data-tv-row className="flex flex-wrap gap-2">', '''            <div\n              data-tv-row\n              data-tv-row-key="episode-picker:servers"\n              data-tv-row-wrap="true"\n              data-tv-row-loop="true"\n              data-tv-scroll-align="center"\n              data-tv-focus-out-up="focus-key:episode-picker:close"\n              data-tv-focus-out-down={\n                groups.length > 1\n                  ? `focus-key:episode-picker:group:${selectedServerIndex}:${activeGroupIndex}`\n                  : "selector:[data-tv-episode-grid] a[href]"\n              }\n              className="flex flex-wrap gap-2"\n            >''', "server row logic")
    c = replace_once(c, '''                    onClick={() => selectServer(item.serverIndex)}\n                    data-tv-default={active ? true : undefined}''', '''                    onClick={() => selectServer(item.serverIndex)}\n                    data-tv-focus-key={`episode-picker:server:${item.serverIndex}`}\n                    data-tv-default={active ? true : undefined}''', "server focus key")
    c = replace_once(c, '                <div data-tv-row className="mb-4 flex flex-wrap gap-2">', '''                <div\n                  data-tv-row\n                  data-tv-row-key="episode-picker:groups"\n                  data-tv-row-wrap="true"\n                  data-tv-row-loop="true"\n                  data-tv-scroll-align="center"\n                  data-tv-focus-out-up={`focus-key:episode-picker:server:${selectedServerIndex}`}\n                  data-tv-focus-out-down="selector:[data-tv-episode-grid] a[href]"\n                  className="mb-4 flex flex-wrap gap-2"\n                >''', "group row logic")
    c = replace_once(c, '''                        type="button"\n                        onClick={() =>\n                          setActiveGroupByServer((old) => ({''', '''                        type="button"\n                        data-tv-focus-key={`episode-picker:group:${selectedServerIndex}:${groupIndex}`}\n                        onClick={() =>\n                          setActiveGroupByServer((old) => ({''', "group focus key")
    c = replace_once(c, '''              <div\n                data-tv-row\n                className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"\n              >''', '''              <div\n                data-tv-episode-grid\n                data-tv-row\n                data-tv-row-key="episode-picker:episodes"\n                data-tv-row-wrap="true"\n                data-tv-row-loop="true"\n                data-tv-scroll-align="center"\n                data-tv-scroll-padding="72"\n                data-tv-focus-out-up={\n                  groups.length > 1\n                    ? `focus-key:episode-picker:group:${selectedServerIndex}:${activeGroupIndex}`\n                    : `focus-key:episode-picker:server:${selectedServerIndex}`\n                }\n                className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"\n              >''', "episode grid logic")
    c = replace_once(c, '''                        href={getEpisodeUrl(movie.slug, selectedServerIndex, episodeIndex)}\n                        data-tv-default={active ? true : undefined}\n                        onClick={onClose}''', '''                        href={getEpisodeUrl(movie.slug, selectedServerIndex, episodeIndex)}\n                        data-tv-focus-key={`episode-picker:episode:${selectedServerIndex}:${episodeIndex}`}\n                        data-tv-episode-current={active ? "true" : undefined}\n                        data-tv-default={active ? true : undefined}\n                        onClick={onClose}''', "episode focus key")
    c = replace_once(c, '          <div data-tv-row className="mt-6 flex flex-wrap gap-3">', '''          <div\n            data-tv-row\n            data-tv-row-key="episode-picker:footer"\n            data-tv-row-loop="true"\n            className="mt-6 flex flex-wrap gap-3"\n          >''', "footer row")
    write(path, c)


def main() -> None:
    patch_search_box()
    patch_remote()
    patch_overlay()
    patch_modal()
    print("\n[OK] TV keyboard + overlay logic hotfix hoàn tất.")
    for item in CHANGED:
        print(f"- {item}")
    print("\nBackup: *.tv-keyboard-overlay.bak")
    print("Chạy tiếp: npm run lint && npm run build")


if __name__ == "__main__":
    main()
