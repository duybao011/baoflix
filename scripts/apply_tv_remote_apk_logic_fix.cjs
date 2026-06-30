const fs = require("fs");
const path = require("path");

const root = process.cwd();

function target(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(target(relativePath), "utf8");
}

function write(relativePath, content) {
  fs.writeFileSync(target(relativePath), content, "utf8");
  console.log(`patched ${relativePath}`);
}

function replaceRequired(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`Không tìm thấy block: ${label}`);
  }
  return content.replace(search, replacement);
}

function patchHeader() {
  const relativePath = "components/Header.tsx";
  let content = read(relativePath);

  if (!content.includes('window.location.pathname === "/tv"')) {
    content = content.replace(
      `if (params.get("tv") === "1") return true;`,
      `if (params.get("tv") === "1") return true;
    if (window.location.pathname === "/tv") return true;`
    );
  }

  if (!content.includes("const [tvKeyboardEnabled, setTvKeyboardEnabled]")) {
    content = replaceRequired(
      content,
      `  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);`,
      `  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [tvKeyboardEnabled, setTvKeyboardEnabled] = useState(false);`,
      "Header tvKeyboardEnabled state"
    );
  }

  if (!content.includes("function refreshKeyboardEnabled()")) {
    content = replaceRequired(
      content,
      `  useEffect(() => {
    setKeyword(initialKeyword || "");
  }, [initialKeyword]);`,
      `  useEffect(() => {
    setKeyword(initialKeyword || "");
  }, [initialKeyword]);

  useEffect(() => {
    setTvKeyboardEnabled(isTvSearchKeyboardEnabled());

    function refreshKeyboardEnabled() {
      setTvKeyboardEnabled(isTvSearchKeyboardEnabled());
    }

    window.addEventListener("baoflix-tv-mode-change", refreshKeyboardEnabled);
    window.addEventListener("storage", refreshKeyboardEnabled);
    window.addEventListener("focus", refreshKeyboardEnabled);

    return () => {
      window.removeEventListener("baoflix-tv-mode-change", refreshKeyboardEnabled);
      window.removeEventListener("storage", refreshKeyboardEnabled);
      window.removeEventListener("focus", refreshKeyboardEnabled);
    };
  }, []);`,
      "Header TV keyboard effect"
    );
  }

  if (!content.includes("function appendKeyboardValue(")) {
    content = replaceRequired(
      content,
      `  function clearAllHistory() {
    clearSearchHistory();
    setHistory([]);
  }

  function handleSearchBlur() {`,
      `  function clearAllHistory() {
    clearSearchHistory();
    setHistory([]);
  }

  function appendKeyboardValue(value: string) {
    setKeyword((old) => \`\${old}\${value}\`);
    setFocused(true);
  }

  function backspaceKeyboardValue() {
    setKeyword((old) => old.slice(0, -1));
    setFocused(true);
  }

  function clearKeyboardValue() {
    setKeyword("");
    setFocused(true);
  }

  function handleSearchBlur() {`,
      "Header keyboard helper functions"
    );
  }

  if (!content.includes("data-tv-search-keyboard")) {
    content = replaceRequired(
      content,
      `      </form>

      {showDropdown && (`,
      `      </form>

      {tvKeyboardEnabled && focused && (
        <div
          data-tv-search-keyboard
          data-tv-row
          data-tv-row-wrap="true"
          className="mt-2 rounded-2xl border border-white/10 bg-black/35 p-2"
        >
          <div className="grid gap-1.5">
            {TV_KEYBOARD_ROWS.map((row, rowIndex) => (
              <div
                key={row.join("")}
                data-tv-row
                data-tv-row-wrap="true"
                className="flex flex-wrap justify-center gap-1.5"
              >
                {row.map((keyValue) => (
                  <button
                    key={keyValue}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => appendKeyboardValue(keyValue)}
                    data-tv-focus-key={\`header-keyboard:\${rowIndex}:\${keyValue}\`}
                    className="min-h-9 min-w-9 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
                  >
                    {keyValue.toUpperCase()}
                  </button>
                ))}
              </div>
            ))}

            <div data-tv-row data-tv-row-wrap="true" className="mt-1 grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => appendKeyboardValue(" ")}
                data-tv-focus-key="header-keyboard:space"
                className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                Space
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={backspaceKeyboardValue}
                data-tv-focus-key="header-keyboard:backspace"
                className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                Xóa ký tự
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={clearKeyboardValue}
                data-tv-focus-key="header-keyboard:clear"
                className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                Xóa hết
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => goSearch(keyword)}
                data-tv-focus-key="header-keyboard:submit"
                className="min-h-10 rounded-xl bg-red-600 px-2 text-sm font-black text-white hover:bg-red-500 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                Tìm
              </button>
            </div>
          </div>
        </div>
      )}

      {showDropdown && (`,
      "Header keyboard JSX"
    );
  }

  if (!content.includes("data-tv-header-desktop-menu-button")) {
    content = replaceRequired(
      content,
      `              <SearchForm initialKeyword={currentKeyword} />
            </div>`,
      `              <SearchForm initialKeyword={currentKeyword} />

              <button
                type="button"
                data-tv-header-menu-button
                data-tv-header-desktop-menu-button
                data-tv-focus-key="header:menu-desktop"
                onClick={() => {
                  setMenuOpen((value) => !value);
                  setSearchOpen(false);
                }}
                className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                ☰
              </button>
            </div>`,
      "Header desktop TV menu button"
    );
  }

  if (!content.includes('data-tv-focus-key="header-search:submit-keyword"')) {
    content = content.replace(
      `onClick={() => goSearch(keyword)}
              className="block w-full border-b`,
      `onClick={() => goSearch(keyword)}
              data-tv-focus-key="header-search:submit-keyword"
              className="block w-full border-b`
    );
  }

  if (!content.includes("header-search:suggest")) {
    content = content.replace(
      `onClick={() => goMovie(movie)}
                      className="flex w-full gap-3 rounded-2xl p-2 text-left hover:bg-white/5"`,
      `onClick={() => goMovie(movie)}
                      data-tv-focus-key={\`header-search:suggest:\${movie.slug}\`}
                      className="flex w-full gap-3 rounded-2xl p-2 text-left hover:bg-white/5"`
    );
  }

  if (!content.includes("header-search:history")) {
    content = content.replace(
      `onClick={() => goSearch(item)}
                      className="min-w-0 truncate px-3 py-1.5"`,
      `onClick={() => goSearch(item)}
                      data-tv-focus-key={\`header-search:history:\${item}\`}
                      className="min-w-0 truncate px-3 py-1.5"`
    );
  }

  if (!content.includes("data-tv-skip\n                      tabIndex={-1}")) {
    content = content.replace(
      `onClick={() => deleteHistoryItem(item)}
                      className="border-l border-white/10 px-2 py-1.5 text-slate-500 hover:bg-red-600 hover:text-white"`,
      `onClick={() => deleteHistoryItem(item)}
                      data-tv-skip
                      tabIndex={-1}
                      className="border-l border-white/10 px-2 py-1.5 text-slate-500 hover:bg-red-600 hover:text-white"`
    );
  }

  write(relativePath, content);
}

function patchTvSearchBox() {
  const relativePath = "components/TvSearchBox.tsx";
  const content = String.raw`"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SEARCH_HISTORY_KEY = "baoflix_search_history";
const TV_SEARCH_INPUT_ID = "baoflix-tv-search-input";
const QUICK_FILTER_HREF =
  "/loc?country=trung-quoc&sort_lang=long-tieng&category=co-trang&sort_field=year&sort_type=desc";

const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const TV_KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
  ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
] as const;

type Bridge = {
  showKeyboard?: (id?: string) => void;
  showSoftKeyboard?: (id?: string) => void;
  openKeyboard?: (id?: string) => void;
  focusInput?: (id: string) => void;
};

type KeyboardWindow = Window & {
  BaoflixAndroid?: Bridge;
  Android?: Bridge;
  AndroidBridge?: Bridge;
  nativeBridge?: Bridge;
  webkit?: {
    messageHandlers?: {
      baoflixKeyboard?: {
        postMessage?: (message: { inputId: string }) => void;
      };
    };
  };
};

type KeyboardNavigator = Navigator & {
  virtualKeyboard?: {
    show?: () => void;
  };
};

function readHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveHistory(q: string) {
  const text = q.trim();
  if (!text) return [];

  const next = [
    text,
    ...readHistory().filter((item) => item.toLowerCase() !== text.toLowerCase()),
  ].slice(0, 8);

  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  return next;
}

function openKey(event: KeyboardEvent<HTMLInputElement>) {
  return (
    event.key === "Enter" ||
    event.key === "NumpadEnter" ||
    event.key === "OK" ||
    event.key === "Accept" ||
    event.keyCode === 13 ||
    event.keyCode === 23 ||
    event.keyCode === 66
  );
}

function isTvKeyboardEnabled() {
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
}

function requestKeyboard(input: HTMLInputElement | null) {
  if (!input) return;

  try {
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  } catch {
    try {
      input.focus();
    } catch {}
  }

  try {
    input.click();
  } catch {}

  try {
    (navigator as KeyboardNavigator).virtualKeyboard?.show?.();
  } catch {}

  const keyboardWindow = window as KeyboardWindow;

  [keyboardWindow.BaoflixAndroid, keyboardWindow.Android, keyboardWindow.AndroidBridge, keyboardWindow.nativeBridge]
    .filter(Boolean)
    .forEach((bridge) => {
      try {
        bridge?.focusInput?.(input.id);
        bridge?.showSoftKeyboard?.(input.id);
        bridge?.showKeyboard?.(input.id);
        bridge?.openKeyboard?.(input.id);
      } catch {}
    });

  try {
    keyboardWindow.webkit?.messageHandlers?.baoflixKeyboard?.postMessage?.({
      inputId: input.id || TV_SEARCH_INPUT_ID,
    });
  } catch {}

  try {
    window.dispatchEvent(
      new CustomEvent("baoflix-tv-open-keyboard", {
        detail: { inputId: input.id || TV_SEARCH_INPUT_ID },
      })
    );
  } catch {}
}

export default function TvSearchBox() {
  const router = useRouter();
  const wrapperRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<number | null>(null);

  const [keyword, setKeyword] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tvKeyboardEnabled, setTvKeyboardEnabled] = useState(false);

  useEffect(() => {
    function refresh() {
      setHistory(readHistory());
      setTvKeyboardEnabled(isTvKeyboardEnabled());
    }

    setHydrated(true);
    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("baoflix-tv-mode-change", refresh);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("baoflix-tv-mode-change", refresh);
    };
  }, []);

  function go(q: string) {
    const text = q.trim();

    if (!text) {
      requestKeyboard(inputRef.current);
      setFocused(true);
      return;
    }

    setHistory(saveHistory(text));
    setKeyword("");
    setFocused(false);
    router.push(\`/tim-kiem?q=\${encodeURIComponent(text)}\`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    go(keyword);
  }

  function schedule() {
    setFocused(true);

    if (timer.current) window.clearTimeout(timer.current);

    timer.current = window.setTimeout(() => {
      requestKeyboard(inputRef.current);
      timer.current = null;
    }, 60);
  }

  function handleBlur() {
    window.setTimeout(() => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(document.activeElement)) {
        setFocused(false);
      }
    }, 0);
  }

  function appendKeyboardValue(value: string) {
    setKeyword((old) => \`\${old}\${value}\`);
    setFocused(true);
  }

  function backspaceKeyboardValue() {
    setKeyword((old) => old.slice(0, -1));
    setFocused(true);
  }

  function clearKeyword() {
    setKeyword("");
    setFocused(true);
    window.setTimeout(() => requestKeyboard(inputRef.current), 40);
  }

  function clearHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    setHistory([]);
    setFocused(true);
    window.setTimeout(() => requestKeyboard(inputRef.current), 40);
  }

  const showKeyboard = tvKeyboardEnabled && focused;

  return (
    <section
      ref={wrapperRef}
      data-tv-section="search-strip"
      onBlur={handleBlur}
      className="rounded-2xl border border-white/10 bg-white/[0.032] p-3"
    >
      <div className="grid gap-2 lg:grid-cols-[1fr_auto] lg:items-start">
        <form onSubmit={submit} data-tv-row className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            ref={inputRef}
            id={TV_SEARCH_INPUT_ID}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-tv-keyboard-input
            data-tv-focus-key="tv-search:input"
            value={keyword}
            onFocus={schedule}
            onClick={() => requestKeyboard(inputRef.current)}
            onKeyDown={(event) => {
              if (openKey(event) && !keyword.trim()) {
                event.preventDefault();
                event.stopPropagation();
                requestKeyboard(inputRef.current);
                setFocused(true);
              }
            }}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm phim..."
            className={[
              "h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-yellow-300 min-[1280px]:h-12",
              TV_FOCUS_CLASS,
            ].join(" ")}
          />

          <button
            type="submit"
            data-tv-focus-key="tv-search:submit"
            className={[
              "h-11 rounded-xl bg-yellow-300 px-5 text-sm font-black text-black hover:bg-yellow-200 min-[1280px]:h-12",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            Tìm
          </button>
        </form>

        <div data-tv-row data-tv-row-wrap="true" className="flex flex-wrap gap-1.5">
          <Link
            href={QUICK_FILTER_HREF}
            prefetch={false}
            data-tv-focus-key="tv-search:main-filter"
            className={[
              "rounded-full border border-yellow-300/30 bg-yellow-300/10 px-3 py-2 text-[11px] font-black text-yellow-100 hover:bg-yellow-300 hover:text-black",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            Trung + Lồng tiếng + Cổ trang
          </Link>

          {hydrated &&
            history.slice(0, 5).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => go(item)}
                data-tv-focus-key={\`tv-search:history:\${item}\`}
                className={[
                  "max-w-[150px] truncate rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black text-slate-200 hover:bg-red-600 hover:text-white",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                {item}
              </button>
            ))}

          {hydrated && history.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              data-tv-skip
              tabIndex={-1}
              className={[
                "rounded-full border border-white/10 bg-black/25 px-3 py-2 text-[11px] font-black text-red-300 hover:bg-red-600 hover:text-white",
                TV_FOCUS_CLASS,
              ].join(" ")}
            >
              Xóa
            </button>
          )}
        </div>
      </div>

      {showKeyboard && (
        <div
          data-tv-search-keyboard
          data-tv-row
          data-tv-row-wrap="true"
          className="mt-2 rounded-2xl border border-white/10 bg-black/35 p-2"
        >
          <div className="grid gap-1.5">
            {TV_KEYBOARD_ROWS.map((row, rowIndex) => (
              <div
                key={row.join("")}
                data-tv-row
                data-tv-row-wrap="true"
                className="flex flex-wrap justify-center gap-1.5"
              >
                {row.map((keyValue) => (
                  <button
                    key={keyValue}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => appendKeyboardValue(keyValue)}
                    data-tv-focus-key={\`tv-search-keyboard:\${rowIndex}:\${keyValue}\`}
                    className={[
                      "min-h-9 min-w-9 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10",
                      TV_FOCUS_CLASS,
                    ].join(" ")}
                  >
                    {keyValue.toUpperCase()}
                  </button>
                ))}
              </div>
            ))}

            <div data-tv-row data-tv-row-wrap="true" className="mt-1 grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => appendKeyboardValue(" ")}
                data-tv-focus-key="tv-search-keyboard:space"
                className={[
                  "min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Space
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={backspaceKeyboardValue}
                data-tv-focus-key="tv-search-keyboard:backspace"
                className={[
                  "min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Xóa ký tự
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={clearKeyword}
                data-tv-focus-key="tv-search-keyboard:clear"
                className={[
                  "min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Xóa hết
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => go(keyword)}
                data-tv-focus-key="tv-search-keyboard:submit"
                className={[
                  "min-h-10 rounded-xl bg-yellow-300 px-2 text-sm font-black text-black hover:bg-yellow-200",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Tìm
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
`;

  write(relativePath, content);
}

function patchTvRemoteNavigator() {
  const relativePath = "components/TvRemoteNavigator.tsx";
  let content = read(relativePath);

  if (!content.includes("function getVisibleSearchKeyboard()")) {
    content = replaceRequired(
      content,
      `function getFirstMainFocusableElement() {
  const scope = getMainScope();
  const main = document.querySelector("main");
  return getDefaultFocusable(scope || main || document);
}`,
      `function getFirstMainFocusableElement() {
  const scope = getMainScope();
  const main = document.querySelector("main");
  return getDefaultFocusable(scope || main || document);
}

function getVisibleSearchKeyboard() {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[data-tv-search-keyboard]")).find(isVisibleElement) ||
    null
  );
}

function focusSearchKeyboard(pathname: string) {
  const keyboard = getVisibleSearchKeyboard();
  const target = keyboard ? getFocusableElements(keyboard)[0] : null;
  if (!target) return false;

  focusElement(target, pathname);
  return true;
}

function focusInputFromKeyboard(activeElement: Element | null, pathname: string) {
  if (!(activeElement instanceof HTMLElement)) return false;

  const keyboard = activeElement.closest<HTMLElement>("[data-tv-search-keyboard]");
  if (!keyboard) return false;

  const wrapper = keyboard.parentElement;
  const input = wrapper?.querySelector<HTMLElement>(
    "[data-tv-keyboard-input], [data-tv-header-search-input], input[type='search']"
  );

  if (!input || !isVisibleElement(input)) return false;

  focusElement(input, pathname);
  return true;
}

function focusPageContentFromHeader(pathname: string) {
  const selectors = [
    "[data-tv-section='top-actions'] [data-tv-default]",
    "[data-tv-section='top-actions'] a[href]:not([data-tv-skip])",
    "[data-tv-section='search-strip'] [data-tv-focus-key='tv-search:input']",
    "[data-tv-section='search-strip'] a[href]:not([data-tv-skip])",
    "main [data-tv-scope] [data-tv-default]",
    "main [data-tv-scope] a[href]:not([data-tv-skip])",
    "main [data-tv-scope] button:not([disabled]):not([data-tv-skip])",
    "main a[href]:not([data-tv-skip])",
    "main button:not([disabled]):not([data-tv-skip])",
  ];

  for (const selector of selectors) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const target = candidates.find((element) => element.tabIndex !== -1 && isVisibleElement(element));

    if (target) {
      focusElement(target, pathname);
      return true;
    }
  }

  return false;
}`,
      "TvRemoteNavigator keyboard/page focus helpers"
    );
  }

  if (!content.includes("focusInputFromKeyboard(activeElement, pathname)")) {
    content = replaceRequired(
      content,
      `      if (!direction) return;

      if (
        direction === "up" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        !isInsideTvRail(activeElement) &&
        activeElement instanceof HTMLElement
      ) {`,
      `      if (!direction) return;

      if (
        direction === "up" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        focusInputFromKeyboard(activeElement, pathname)
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (
        direction === "down" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        activeElement instanceof HTMLElement &&
        activeElement.closest("header")
      ) {
        event.preventDefault();
        event.stopPropagation();

        if (isTextInput(activeElement) && focusSearchKeyboard(pathname)) return;
        if (focusPageContentFromHeader(pathname)) return;
        return;
      }

      if (
        direction === "up" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        !isInsideTvRail(activeElement) &&
        activeElement instanceof HTMLElement
      ) {`,
      "TvRemoteNavigator header down / keyboard up blocks"
    );
  }

  content = content.replace(
    `direction === "down" &&
        isTextInput(activeElement) &&
        activeElement instanceof HTMLElement &&
        activeElement.closest("header")`,
    `direction === "down" &&
        isTextInput(activeElement) &&
        activeElement instanceof HTMLElement &&
        (activeElement.closest("header") || activeElement.hasAttribute("data-tv-keyboard-input"))`
  );

  content = content.replace(
    `const keyboard = document.querySelector<HTMLElement>("[data-tv-search-keyboard]");
        const keyboardTarget = keyboard ? getFocusableElements(keyboard)[0] : null;

        if (keyboardTarget) {
          event.preventDefault();
          event.stopPropagation();
          focusElement(keyboardTarget, pathname);
          return;
        }`,
    `if (focusSearchKeyboard(pathname)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }`
  );

  write(relativePath, content);
}

patchHeader();
patchTvSearchBox();
patchTvRemoteNavigator();

console.log("Done. Run: npm run lint && npm run build");