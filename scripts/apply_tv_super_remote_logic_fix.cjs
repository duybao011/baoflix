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
    throw new Error(`Không tìm thấy block để sửa: ${label}`);
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

  if (!content.includes("useSearchParams")) {
    content = content.replace(
      `import { usePathname } from "next/navigation";`,
      `import { usePathname, useSearchParams } from "next/navigation";`
    );
  }

  if (!content.includes('const AREA_FOCUS_PREFIX = "baoflix_tv_area_focus:";')) {
    content = content.replace(
      `const FOCUS_MEMORY_PREFIX = "baoflix_tv_focus:";`,
      `const FOCUS_MEMORY_PREFIX = "baoflix_tv_focus:";
const AREA_FOCUS_PREFIX = "baoflix_tv_area_focus:";`
    );
  }

  if (!content.includes('const ROUTE_STACK_KEY = "baoflix_tv_route_stack_v1";')) {
    content = content.replace(
      `const AREA_FOCUS_PREFIX = "baoflix_tv_area_focus:";`,
      `const AREA_FOCUS_PREFIX = "baoflix_tv_area_focus:";
const ROUTE_STACK_KEY = "baoflix_tv_route_stack_v1";`
    );
  }

  if (!content.includes("function isTextDeleteBackspace(")) {
    content = content.replace(
      `function shouldLetInputHandleKey(element: Element | null, event: KeyboardEvent) {
  if (!isTextInput(element)) return false;
  return event.key === "ArrowLeft" || event.key === "ArrowRight";
}`,
      `function shouldLetInputHandleKey(element: Element | null, event: KeyboardEvent) {
  if (!isTextInput(element)) return false;
  return event.key === "ArrowLeft" || event.key === "ArrowRight";
}

function isTextDeleteBackspace(event: KeyboardEvent) {
  return (
    event.key === "Backspace" &&
    event.keyCode !== 4 &&
    event.keyCode !== 461 &&
    event.keyCode !== 10009
  );
}`
    );
  }

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

function focusPageContentFromTransientUi(pathname: string) {
  const remembered = getRememberedFocusable(\`\${pathname}:content\`);
  if (remembered) {
    focusElement(remembered, pathname);
    return true;
  }

  const selectors = [
    "[data-tv-section='top-actions'] [data-tv-default]",
    "[data-tv-section='top-actions'] a[href]:not([data-tv-skip])",
    "[data-tv-section='continue'] a[href]:not([data-tv-skip])",
    "[data-tv-section='china-series'] a[href]:not([data-tv-skip])",
    "[data-tv-section='custom'] a[href]:not([data-tv-skip])",
    "[data-tv-section='favorites'] a[href]:not([data-tv-skip])",
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
      "remote keyboard / transient helpers"
    );
  }

  if (!content.includes("function getFocusAreaKey(")) {
    content = replaceRequired(
      content,
      `function rememberFocus(pathname: string, element: HTMLElement) {
  const value = getFocusMemoryValue(element);
  if (!value) return;

  try {
    sessionStorage.setItem(\`\${FOCUS_MEMORY_PREFIX}\${pathname}\`, value);
  } catch {
    // Ignore storage errors in restricted WebViews.
  }
}`,
      `function rememberFocus(pathname: string, element: HTMLElement) {
  const value = getFocusMemoryValue(element);
  if (!value) return;

  try {
    sessionStorage.setItem(\`\${FOCUS_MEMORY_PREFIX}\${pathname}\`, value);
    rememberAreaFocus(pathname, element, value);
  } catch {
    // Ignore storage errors in restricted WebViews.
  }
}

function getFocusAreaKey(pathname: string, element: HTMLElement) {
  if (element.closest("[data-tv-modal]")) return \`\${pathname}:modal\`;
  if (element.closest("[data-tv-overlay='watch']")) return \`\${pathname}:overlay\`;
  if (element.closest("[data-tv-search-keyboard]")) return \`\${pathname}:search-keyboard\`;
  if (element.closest("header")) return \`\${pathname}:header\`;
  if (element.closest("[data-tv-rail='true']")) return \`\${pathname}:rail\`;
  if (element.closest("[data-tv-filter-panel]")) return \`\${pathname}:filter\`;

  const section = element.closest<HTMLElement>("[data-tv-section]");
  if (section?.dataset.tvSection) return \`\${pathname}:section:\${section.dataset.tvSection}\`;

  if (element.closest("main")) return \`\${pathname}:content\`;
  return \`\${pathname}:document\`;
}

function getElementByFocusMemoryValue(value: string) {
  let target: HTMLElement | null = null;

  if (value.startsWith("href:")) {
    const href = value.slice(5);
    target = document.querySelector<HTMLElement>(\`a[href="\${cssEscape(href)}"]\`);
  } else if (value.startsWith("data:")) {
    const key = value.slice(5);
    target = document.querySelector<HTMLElement>(\`[data-tv-focus-key="\${cssEscape(key)}"]\`);
  }

  if (
    !target ||
    !isVisibleElement(target) ||
    target.tabIndex === -1 ||
    target.hasAttribute("data-tv-skip")
  ) {
    return null;
  }

  return target;
}

function rememberAreaFocus(pathname: string, element: HTMLElement, value = getFocusMemoryValue(element)) {
  if (!value) return;

  try {
    const areaKey = getFocusAreaKey(pathname, element);
    sessionStorage.setItem(\`\${AREA_FOCUS_PREFIX}\${areaKey}\`, value);

    if (
      element.closest("main") &&
      !element.closest("[data-tv-rail='true']") &&
      !element.closest("[data-tv-modal]") &&
      !element.closest("[data-tv-overlay='watch']") &&
      !element.closest("[data-tv-search-keyboard]")
    ) {
      sessionStorage.setItem(\`\${AREA_FOCUS_PREFIX}\${pathname}:content\`, value);
    }
  } catch {
    // Ignore storage errors in restricted WebViews.
  }
}

function getRememberedFocusable(areaKey: string) {
  try {
    const value = sessionStorage.getItem(\`\${AREA_FOCUS_PREFIX}\${areaKey}\`);
    if (!value) return null;
    return getElementByFocusMemoryValue(value);
  } catch {
    return null;
  }
}`,
      "area focus memory helpers"
    );
  }

  if (!content.includes("const rememberedRail")) {
    content = content.replace(
      `  const target =
    rail.querySelector<HTMLElement>("[data-tv-focus-key='rail:home']") ||
    getDefaultFocusable(rail) ||
    getFocusableElements(rail)[0];`,
      `  const rememberedRail = getRememberedFocusable(\`\${pathname}:rail\`);
  const target =
    rememberedRail ||
    rail.querySelector<HTMLElement>("[data-tv-focus-key='rail:home']") ||
    getDefaultFocusable(rail) ||
    getFocusableElements(rail)[0];`
    );
  }

  if (!content.includes("const rememberedContent")) {
    content = content.replace(
      `function focusContentFromRail(pathname: string) {
  const target =
    getFirstFocusableInside("main [data-tv-scope]") ||
    getFirstFocusableInside("main");

  if (!target) return false;
  focusElement(target, pathname);
  return true;
}`,
      `function focusContentFromRail(pathname: string) {
  const rememberedContent = getRememberedFocusable(\`\${pathname}:content\`);
  const target =
    rememberedContent ||
    getFirstFocusableInside("main [data-tv-scope]") ||
    getFirstFocusableInside("main");

  if (!target) return false;
  focusElement(target, pathname);
  return true;
}`
    );
  }

  if (!content.includes("function handleTransientUiBack(")) {
    content = replaceRequired(
      content,
      `function handleScopedBack(event: KeyboardEvent, pathname: string) {
  const activeElement = document.activeElement;

  if (focusActiveTabButtonFromPanel(activeElement, pathname)) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  if (activeElement instanceof HTMLElement && activeElement.closest("[data-tv-filter-panel]")) {
    const topAction = document.querySelector<HTMLElement>("[data-tv-focus-key='filter:apply-top']");
    if (topAction && activeElement !== topAction && isVisibleElement(topAction)) {
      event.preventDefault();
      event.stopPropagation();
      focusElement(topAction, pathname);
      return true;
    }
  }

  return false;
}`,
      `function handleTransientUiBack(event: KeyboardEvent, pathname: string) {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) return false;

  const isSearchKeyboard = Boolean(activeElement.closest("[data-tv-search-keyboard]"));
  const isSearchInput =
    isTextInput(activeElement) &&
    Boolean(
      activeElement.closest("header") ||
        activeElement.closest("[data-tv-section='search-strip']") ||
        activeElement.hasAttribute("data-tv-keyboard-input")
    );

  if (!isSearchKeyboard && !isSearchInput) return false;

  event.preventDefault();
  event.stopPropagation();

  if (isSearchKeyboard && focusInputFromKeyboard(activeElement, pathname)) return true;
  if (focusPageContentFromTransientUi(pathname)) return true;

  activeElement.blur();
  return true;
}

function handleScopedBack(event: KeyboardEvent, pathname: string) {
  const activeElement = document.activeElement;

  if (handleTransientUiBack(event, pathname)) return true;

  if (focusActiveTabButtonFromPanel(activeElement, pathname)) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  if (activeElement instanceof HTMLElement && activeElement.closest("[data-tv-filter-panel]")) {
    const activeTab = activeElement
      .closest<HTMLElement>("[data-tv-tabs-root]")
      ?.querySelector<HTMLElement>("[data-tv-tab-active='true']");

    if (activeTab && activeElement !== activeTab && isVisibleElement(activeTab)) {
      event.preventDefault();
      event.stopPropagation();
      focusElement(activeTab, pathname);
      return true;
    }
  }

  if (
    pathname === "/tv" &&
    activeElement instanceof HTMLElement &&
    !isInsideTvRail(activeElement) &&
    activeElement.closest("main") &&
    focusRailFromContent(pathname)
  ) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  if (
    activeElement instanceof HTMLElement &&
    activeElement.closest("header") &&
    focusPageContentFromTransientUi(pathname)
  ) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  return false;
}`,
      "scoped back logic"
    );
  }

  if (!content.includes("function getCurrentRoute()")) {
    content = replaceRequired(
      content,
      `function getFallbackBackHref(path = window.location.pathname) {
  const normalWatchMatch = path.match(/^\\/xem\\/([^/?#]+)/);
  const customWatchMatch = path.match(/^\\/ca-nhan\\/([^/]+)\\/xem/);

  if (normalWatchMatch?.[1]) return \`/phim/\${normalWatchMatch[1]}\`;
  if (customWatchMatch?.[1]) return \`/ca-nhan/\${customWatchMatch[1]}\`;
  if (isTvRemoteEnabled()) return path === "/tv" ? "/" : "/tv";
  if (path !== "/") return "/";
  return "/tv";
}

function goBack(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();

  const path = window.location.pathname;
  if (isTvRemoteEnabled()) {
    window.location.href = getFallbackBackHref(path);
    return;
  }

  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = getFallbackBackHref(path);
}`,
      `function getCurrentRoute() {
  return \`\${window.location.pathname}\${window.location.search || ""}\`;
}

function readRouteStack() {
  try {
    const raw = sessionStorage.getItem(ROUTE_STACK_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeRouteStack(stack: string[]) {
  try {
    sessionStorage.setItem(ROUTE_STACK_KEY, JSON.stringify(stack.slice(-30)));
  } catch {
    // Ignore storage errors in restricted WebViews.
  }
}

function rememberRoute(route = getCurrentRoute()) {
  const stack = readRouteStack();
  const last = stack[stack.length - 1];

  if (last === route) return;

  stack.push(route);
  writeRouteStack(stack);
}

function popRouteTarget(current = getCurrentRoute()) {
  const stack = readRouteStack().filter(Boolean);

  while (stack.length && stack[stack.length - 1] === current) {
    stack.pop();
  }

  const target = stack.pop() || "";
  writeRouteStack(stack);

  if (!target || target === current) return "";
  return target;
}

function getFallbackBackHref(path = window.location.pathname) {
  const normalWatchMatch = path.match(/^\\/xem\\/([^/?#]+)/);
  const customWatchMatch = path.match(/^\\/ca-nhan\\/([^/]+)\\/xem/);

  if (normalWatchMatch?.[1]) return \`/phim/\${normalWatchMatch[1]}\`;
  if (customWatchMatch?.[1]) return \`/ca-nhan/\${customWatchMatch[1]}\`;
  if (path !== "/tv") return "/tv";
  return "/";
}

function goBack(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();

  const current = getCurrentRoute();
  const stackedTarget = popRouteTarget(current);

  if (stackedTarget) {
    window.location.href = stackedTarget;
    return;
  }

  if (!isTvRemoteEnabled() && window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = getFallbackBackHref(window.location.pathname);
}`,
      "route stack back logic"
    );
  }

  if (!content.includes("const searchParams = useSearchParams();")) {
    content = content.replace(
      `  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);`,
      `  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const routeKey = searchString ? \`\${pathname}?\${searchString}\` : pathname;
  const [enabled, setEnabled] = useState(false);`
    );
  }

  content = content.replace(
    `  useEffect(() => {
    if (!enabled) return;

    rememberRoute(getCurrentRoute());
  }, [enabled, pathname]);`,
    `  useEffect(() => {
    if (!enabled) return;

    rememberRoute(routeKey);
  }, [enabled, routeKey]);`
  );

  content = content.replace(
    `if (isBackKey(event) && !isTextInput(activeElement)) {`,
    `if (isBackKey(event) && !(isTextInput(activeElement) && isTextDeleteBackspace(event))) {`
  );

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
        if (focusPageContentFromTransientUi(pathname)) return;
        return;
      }

      if (
        direction === "up" &&
        !openModalScope &&
        !activeIsInsideVisibleOverlay &&
        !isInsideTvRail(activeElement) &&
        activeElement instanceof HTMLElement
      ) {`,
      "keyboard up + header down blocks"
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

function patchTvWatchOverlay() {
  const relativePath = "components/TvWatchOverlay.tsx";
  let content = read(relativePath);

  content = content.replace(`const AUTO_HIDE_MS = 2300;`, `const AUTO_HIDE_MS = 3200;`);

  content = content.replace(
    `      behavior: "smooth",
      block: "nearest",`,
    `      behavior: "auto",
      block: "nearest",`
  );

  if (!content.includes("pointerActivityFrameRef")) {
    content = content.replace(
      `  const nativeHintTimerRef = useRef<number | null>(null);
  const overlayModeRef = useRef<OverlayMode>("peek");`,
      `  const nativeHintTimerRef = useRef<number | null>(null);
  const pointerActivityFrameRef = useRef<number | null>(null);
  const overlayModeRef = useRef<OverlayMode>("peek");`
    );

    content = content.replace(
      `    function handlePointerActivity() {
      if (overlayModeRef.current === "panel") return;
      showPeek({ focus: false });
    }`,
      `    function handlePointerActivity() {
      if (pointerActivityFrameRef.current) return;

      pointerActivityFrameRef.current = window.requestAnimationFrame(() => {
        pointerActivityFrameRef.current = null;

        if (overlayModeRef.current === "panel") return;
        showPeek({ focus: false });
      });
    }`
    );

    content = content.replace(
      `      if (nativeHintTimerRef.current) {
        window.clearTimeout(nativeHintTimerRef.current);
      }`,
      `      if (nativeHintTimerRef.current) {
        window.clearTimeout(nativeHintTimerRef.current);
      }

      if (pointerActivityFrameRef.current) {
        window.cancelAnimationFrame(pointerActivityFrameRef.current);
        pointerActivityFrameRef.current = null;
      }`
    );
  }

  write(relativePath, content);
}

patchHeader();
patchTvSearchBox();
patchTvRemoteNavigator();
patchTvWatchOverlay();

console.log("Done. Run: npm run lint && npm run build");