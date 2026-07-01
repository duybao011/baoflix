"use client";

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
    router.push(`/tim-kiem?q=${encodeURIComponent(text)}`);
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
    setKeyword((old) => `${old}${value}`);
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
                data-tv-focus-key={`tv-search:history:${item}`}
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
                    data-tv-focus-key={`tv-search-keyboard:${rowIndex}:${keyValue}`}
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
