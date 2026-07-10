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
    p = ROOT / path
    if not p.exists():
        die(f"Không tìm thấy {path}. Hãy chạy script ở root project BảoFlix.")
    return p.read_text(encoding="utf-8")

def write(path: str, content: str) -> None:
    p = ROOT / path
    backup = p.with_suffix(p.suffix + ".phase5a.bak")
    if not backup.exists():
        shutil.copyfile(p, backup)
    p.write_text(content, encoding="utf-8")
    CHANGED.append(path)

def replace_once(content: str, old: str, new: str, label: str) -> str:
    if new in content:
        print(f"[SKIP] {label} đã có.")
        return content
    if old not in content:
        die(f"Không thấy block: {label}")
    print(f"[OK] {label}")
    return content.replace(old, new, 1)

def patch_tv_mode() -> None:
    path = "lib/tvMode.ts"
    content = read(path)
    content = replace_once(
        content,
        "export function clearTvModeForNormalDevice() {",
        '''export function setTvModeSession(enabled: boolean) {
  if (typeof window === "undefined") return;

  try {
    if (enabled) {
      sessionStorage.setItem(TV_SESSION_KEY, "1");
      document.documentElement.dataset.baoflixTvMode = "1";
    } else {
      sessionStorage.removeItem(TV_SESSION_KEY);
      document.documentElement.dataset.baoflixTvMode = "0";
    }

    window.dispatchEvent(new Event("baoflix-tv-mode-change"));
  } catch {
    // Ignore storage restrictions.
  }
}

export function clearTvModeForNormalDevice() {''',
        "tvMode: thêm setter session dùng chung",
    )
    write(path, content)

def patch_tv_search_box() -> None:
    path = "components/TvSearchBox.tsx"
    content = read(path)
    content = replace_once(
        content,
        'import { useRouter } from "next/navigation";',
        'import { useRouter } from "next/navigation";\nimport { isTvModeActive } from "@/lib/tvMode";',
        "TvSearchBox: dùng tvMode chung",
    )

    old_fn = '''function isTvKeyboardEnabled() {
  if (typeof window === "undefined") return false;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tv") === "0") return false;
    if (params.get("tv") === "1") return true;
    if (window.location.pathname === "/tv") return true;

    const ua = navigator.userAgent.toLowerCase();
    if (
      /baoflixtv|baoflix tv|baoflixwebview|baoflix-webview|android tv|google tv|smart-tv|smarttv|tizen|webos|appletv|aft|bravia|crkey|shield|netcast|viera|hisense|vidaa|roku/.test(
        ua
      )
    ) {
      return true;
    }

    return sessionStorage.getItem("baoflix_tv_mode") === "1";
  } catch {
    return false;
  }
}'''
    new_fn = '''function isTvKeyboardEnabled() {
  if (typeof window === "undefined") return false;
  if (window.location.pathname === "/tv") return true;
  return isTvModeActive();
}'''
    content = replace_once(content, old_fn, new_fn, "TvSearchBox: bỏ regex TV trùng lặp")

    content = replace_once(content, "function requestKeyboard(input: HTMLInputElement | null) {", "function requestKeyboard(input: HTMLInputElement | null, openNativeKeyboard = true) {", "TvSearchBox: tách custom/native keyboard")

    content = replace_once(
        content,
        '''  try {
    input.click();
  } catch {}

  try {
    (navigator as KeyboardNavigator).virtualKeyboard?.show?.();
  } catch {}
''',
        '''  if (!openNativeKeyboard) return;

  try {
    input.click();
  } catch {}

  try {
    (navigator as KeyboardNavigator).virtualKeyboard?.show?.();
  } catch {}
''',
        "TvSearchBox: TV không bật soft keyboard hệ thống",
    )

    content = replace_once(
        content,
        '''    if (!text) {
      requestKeyboard(inputRef.current);
      setFocused(true);
      return;
    }
''',
        '''    if (!text) {
      const useTvKeyboard = isTvKeyboardEnabled();
      requestKeyboard(inputRef.current, !useTvKeyboard);
      setFocused(useTvKeyboard);
      return;
    }
''',
        "TvSearchBox: submit rỗng mở đúng keyboard",
    )

    content = replace_once(
        content,
        '''  function schedule() {
    if (suppressKeyboardRef.current) return;

    setFocused(true);

    if (timer.current) window.clearTimeout(timer.current);

    timer.current = window.setTimeout(() => {
      requestKeyboard(inputRef.current);
      timer.current = null;
    }, 60);
  }
''',
        '''  function schedule() {
    if (suppressKeyboardRef.current) return;

    const useTvKeyboard = isTvKeyboardEnabled();
    setFocused(useTvKeyboard);

    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    if (useTvKeyboard) {
      requestKeyboard(inputRef.current, false);
      return;
    }

    timer.current = window.setTimeout(() => {
      requestKeyboard(inputRef.current, true);
      timer.current = null;
    }, 60);
  }
''',
        "TvSearchBox: tránh hai keyboard cùng lúc",
    )

    content = replace_once(
        content,
        '''  function clearKeyword() {
    setKeyword("");
    setFocused(true);
    window.setTimeout(() => requestKeyboard(inputRef.current), 40);
  }
''',
        '''  function clearKeyword() {
    setKeyword("");
    setFocused(true);

    if (!isTvKeyboardEnabled()) {
      window.setTimeout(() => requestKeyboard(inputRef.current, true), 40);
    }
  }
''',
        "TvSearchBox: clear không gọi soft keyboard TV",
    )

    content = replace_once(
        content,
        '''  function clearHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    setHistory([]);
    setFocused(true);
    window.setTimeout(() => requestKeyboard(inputRef.current), 40);
  }
''',
        '''  function clearHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    setHistory([]);
    setFocused(true);

    if (!isTvKeyboardEnabled()) {
      window.setTimeout(() => requestKeyboard(inputRef.current, true), 40);
    }
  }
''',
        "TvSearchBox: clear history không gọi soft keyboard TV",
    )

    content = replace_once(content, '            spellCheck={false}\n            data-tv-keyboard-input', '            spellCheck={false}\n            readOnly={tvKeyboardEnabled}\n            data-tv-keyboard-input', "TvSearchBox: input readonly khi dùng custom TV keyboard")

    content = replace_once(
        content,
        '            onClick={() => requestKeyboard(inputRef.current)}',
        '''            onClick={() => {
              const useTvKeyboard = isTvKeyboardEnabled();
              setFocused(useTvKeyboard);
              requestKeyboard(inputRef.current, !useTvKeyboard);
            }}''',
        "TvSearchBox: click không gọi native keyboard ở TV",
    )

    content = replace_once(
        content,
        '''                requestKeyboard(inputRef.current);
                setFocused(true);''',
        '''                const useTvKeyboard = isTvKeyboardEnabled();
                requestKeyboard(inputRef.current, !useTvKeyboard);
                setFocused(useTvKeyboard);''',
        "TvSearchBox: Enter rỗng không mở hai keyboard",
    )

    content = replace_once(
        content,
        '''        <div
          data-tv-search-keyboard
          data-tv-row
          data-tv-row-key="search:keyboard"
          data-tv-row-wrap="true"
          data-tv-scroll-align="center"''',
        '''        <div
          data-tv-search-keyboard
          data-tv-scroll-align="center"''',
        "TvSearchBox: bỏ row cha bọc row con",
    )

    content = replace_once(
        content,
        '                    data-tv-focus-key={`tv-search-keyboard:${rowIndex}:${keyValue}`}\n                    className={[',
        '                    data-tv-focus-key={`tv-search-keyboard:${rowIndex}:${keyValue}`}\n                    data-tv-default={rowIndex === 0 && keyValue === "q" ? true : undefined}\n                    className={[',
        "TvSearchBox: phím Q làm điểm vào mặc định",
    )

    write(path, content)

def patch_header() -> None:
    path = "components/Header.tsx"
    content = read(path)

    content = replace_once(content, 'import { getImageUrl } from "@/lib/kkphim";', 'import { getImageUrl } from "@/lib/kkphim";\nimport { isTvModeActive } from "@/lib/tvMode";', "Header: dùng tvMode chung")

    old_fn = '''function isTvSearchKeyboardEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tv") === "0") return false;
    if (params.get("tv") === "1") return true;
    if (window.location.pathname === "/tv") return true;
    const ua = navigator.userAgent.toLowerCase();
    if (/baoflixtv|baoflix tv|baoflixwebview|baoflix-webview|android tv|google tv|smart-tv|smarttv|tizen|webos|appletv|aft|bravia|crkey|shield|netcast|viera|hisense|vidaa|roku/.test(ua)) return true;
    return sessionStorage.getItem(TV_SESSION_KEY) === "1";
  } catch { return false; }
}'''
    new_fn = '''function isTvSearchKeyboardEnabled() {
  if (typeof window === "undefined") return false;
  return isTvModeActive();
}'''
    content = replace_once(content, old_fn, new_fn, "Header: bỏ regex TV trùng lặp")

    content = replace_once(content, '{tvKeyboardEnabled && focused && <div data-tv-search-keyboard data-tv-row data-tv-row-wrap="true" className="mt-2 rounded-2xl border border-white/10 bg-black/35 p-2">', '{tvKeyboardEnabled && focused && <div data-tv-search-keyboard className="mt-2 rounded-2xl border border-white/10 bg-black/35 p-2">', "Header keyboard: bỏ row cha bọc row con")

    content = replace_once(content, 'data-tv-focus-key={`header-keyboard:${rowIndex}:${keyValue}`} className=', 'data-tv-focus-key={`header-keyboard:${rowIndex}:${keyValue}`} data-tv-default={rowIndex === 0 && keyValue === "q" ? true : undefined} className=', "Header keyboard: Q làm default")

    content = replace_once(content, '>Space</button>', '>Cách</button>', "Header keyboard: đổi Space thành Cách")

    content = replace_once(content, 'const isTvMode = pathname === "/tv";', 'const isTvMode = pathname === "/tv";\n  const hideRegularHeader = pathname === "/tv";', "Header: đánh dấu TV hub dùng chrome riêng")

    content = replace_once(content, 'return <><header className={["sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/95 backdrop-blur-xl", isWatchPage ? "hidden lg:block" : ""].join(" ")}>', 'return <><header className={["sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/95 backdrop-blur-xl", isWatchPage ? "hidden lg:block" : "", hideRegularHeader ? "hidden" : ""].join(" ")}>', "Header: ẩn header thường trên /tv")

    write(path, content)

def patch_dashboard() -> None:
    path = "components/TvDashboard.tsx"
    content = read(path)
    content = replace_once(content, 'import { readCustomMovies, type StoredCustomMovie } from "@/lib/customMoviesClient";', 'import { readCustomMovies, type StoredCustomMovie } from "@/lib/customMoviesClient";\nimport { isTvModeActive } from "@/lib/tvMode";', "TvDashboard: import tvMode chung")
    content = replace_once(content, '    input.click();', '    if (!isTvModeActive()) {\n      input.click();\n    }', "TvDashboard search: không bật soft keyboard TV")
    content = replace_once(content, '      <main className="baoflix-tv-page min-w-0 flex-1 space-y-6 pb-6">', '      <div className="baoflix-tv-page min-w-0 flex-1 space-y-6 pb-6">', "TvDashboard: bỏ nested main")
    content = replace_once(content, '      </main>\n    </div>', '      </div>\n    </div>', "TvDashboard: đóng div thay main")
    write(path, content)

def patch_settings() -> None:
    path = "app/cai-dat/page.tsx"
    content = read(path)
    content = replace_once(
        content,
        '''      if (value === "always_tv" || value === "auto_detect") {
        sessionStorage.setItem(TV_SESSION_KEY, "1");
        document.documentElement.dataset.baoflixTvMode = "1";
      }
''',
        '''      if (value === "always_tv") {
        sessionStorage.setItem(TV_SESSION_KEY, "1");
        document.documentElement.dataset.baoflixTvMode = "1";
      }

      if (value === "auto_detect") {
        sessionStorage.removeItem(TV_SESSION_KEY);
        document.documentElement.dataset.baoflixTvMode = "0";
      }
''',
        "Settings: auto_detect không ép desktop thành TV",
    )
    write(path, content)

def patch_focus_memory() -> None:
    path = "components/TvFocusMemory.tsx"
    content = read(path)
    content = replace_once(
        content,
        'const TV_SESSION_KEY = "baoflix_tv_mode";',
        '''const TV_SESSION_KEY = "baoflix_tv_mode";
const NAVIGATOR_ACTIVE_FLAG = "__baoflixTvNavigatorActive";

function isTvNavigatorActive() {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as Record<string, boolean | undefined>)[NAVIGATOR_ACTIVE_FLAG]);
}''',
        "Focus memory: nhận biết navigator chính",
    )
    content = replace_once(content, '    function saveFromTarget(target: EventTarget | null) {\n      if (!isTvFocusMemoryEnabled()) return;', '    function saveFromTarget(target: EventTarget | null) {\n      if (isTvNavigatorActive()) return;\n      if (!isTvFocusMemoryEnabled()) return;', "Focus memory: legacy không ghi đè navigator chính")
    write(path, content)

def patch_pwa() -> None:
    path = "components/PwaRegister.tsx"
    content = read(path)
    content = replace_once(content, 'import { useEffect } from "react";', 'import { useEffect } from "react";\nimport { isTvModeActive } from "@/lib/tvMode";', "PWA: dùng tvMode chung")
    start = content.find("function isTvLikeRuntime() {")
    end = content.find("\n}\n\nexport default function PwaRegister()", start)
    if start == -1 or end == -1:
        die("Không tìm thấy block PwaRegister isTvLikeRuntime")
    content = content[:start] + "function isTvLikeRuntime() {\n  return isTvModeActive();\n}" + content[end+2:]
    print("[OK] PWA: bỏ regex TV trùng lặp")
    write(path, content)

def patch_loc_focus() -> None:
    path = "components/LocTvFocusManager.tsx"
    content = read(path)
    content = replace_once(content, 'import { useEffect } from "react";', 'import { useEffect } from "react";\nimport { isTvModeActive } from "@/lib/tvMode";', "Loc focus: dùng tvMode chung")
    start = content.find("function isTvModeLikelyActive() {")
    end = content.find("\n}\n\nfunction requestFocusLock", start)
    if start == -1 or end == -1:
        die("Không tìm thấy block LocTvFocusManager isTvModeLikelyActive")
    content = content[:start] + "function isTvModeLikelyActive() {\n  return isTvModeActive();\n}" + content[end+2:]
    print("[OK] Loc focus: bỏ regex TV trùng lặp")
    write(path, content)

def main() -> None:
    patch_tv_mode()
    patch_tv_search_box()
    patch_header()
    patch_dashboard()
    patch_settings()
    patch_focus_memory()
    patch_pwa()
    patch_loc_focus()

    print("\n[OK] Phase 5A core logic patch hoàn tất.")
    print("Đã sửa:")
    for item in CHANGED:
        print(f"- {item}")
    print("\nBackup: *.phase5a.bak")
    print("Chạy tiếp:")
    print("  npm run lint")
    print("  npm run build")

if __name__ == "__main__":
    main()
