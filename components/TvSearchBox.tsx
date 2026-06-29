"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const SEARCH_HISTORY_KEY = "baoflix_search_history";
const TV_SEARCH_INPUT_ID = "baoflix-tv-search-input";

const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const mainQuickFilter = {
  label: "Trung Quốc+Lồng Tiếng+Cổ Trang+Năm mới nhất",
  href: "/loc?country=trung-quoc&sort_lang=long-tieng&category=co-trang&sort_field=year&sort_type=desc",
};

type VirtualKeyboardLike = {
  show?: () => void;
};

type AndroidKeyboardBridge = {
  showKeyboard?: (inputId?: string) => void;
  showSoftKeyboard?: (inputId?: string) => void;
  openKeyboard?: (inputId?: string) => void;
  focusInput?: (inputId: string) => void;
};

type KeyboardWindow = Window & {
  BaoflixAndroid?: AndroidKeyboardBridge;
  Android?: AndroidKeyboardBridge;
  AndroidBridge?: AndroidKeyboardBridge;
  nativeBridge?: AndroidKeyboardBridge;
  webkit?: {
    messageHandlers?: {
      baoflixKeyboard?: {
        postMessage?: (message: { inputId: string }) => void;
      };
    };
  };
};

type KeyboardNavigator = Navigator & {
  virtualKeyboard?: VirtualKeyboardLike;
};

function readSearchHistory() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];

    return Array.isArray(list)
      ? list.map((item) => String(item)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(keyword: string) {
  const q = keyword.trim();

  if (!q) return [];

  const oldList = readSearchHistory();
  const next = [
    q,
    ...oldList.filter((item) => item.toLowerCase() !== q.toLowerCase()),
  ].slice(0, 12);

  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  return next;
}

function isKeyboardOpenKey(event: KeyboardEvent<HTMLInputElement>) {
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

function callKeyboardBridge(inputId: string) {
  const keyboardWindow = window as KeyboardWindow;
  const bridges = [
    keyboardWindow.BaoflixAndroid,
    keyboardWindow.Android,
    keyboardWindow.AndroidBridge,
    keyboardWindow.nativeBridge,
  ].filter(Boolean) as AndroidKeyboardBridge[];

  bridges.forEach((bridge) => {
    try {
      bridge.focusInput?.(inputId);
      bridge.showSoftKeyboard?.(inputId);
      bridge.showKeyboard?.(inputId);
      bridge.openKeyboard?.(inputId);
    } catch {
      // Native bridge names vary by WebView shell. Ignore unsupported calls.
    }
  });

  try {
    keyboardWindow.webkit?.messageHandlers?.baoflixKeyboard?.postMessage?.({ inputId });
  } catch {
    // Ignore non-WebKit WebViews.
  }

  try {
    window.dispatchEvent(
      new CustomEvent("baoflix-tv-open-keyboard", {
        detail: { inputId },
      })
    );
  } catch {
    // Ignore event dispatch errors.
  }
}

function requestTvKeyboard(input: HTMLInputElement | null) {
  if (!input) return;

  try {
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  } catch {
    try {
      input.focus();
    } catch {
      // Ignore focus errors in restricted TV WebViews.
    }
  }

  try {
    input.click();
  } catch {
    // Some WebViews block synthetic click. Native bridge below is the backup.
  }

  try {
    (navigator as KeyboardNavigator).virtualKeyboard?.show?.();
  } catch {
    // VirtualKeyboard API is not available in most TV WebViews.
  }

  callKeyboardBridge(input.id || TV_SEARCH_INPUT_ID);
}

export default function TvSearchBox() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const keyboardOpenTimerRef = useRef<number | null>(null);

  const [keyword, setKeyword] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    function refresh() {
      setHistory(readSearchHistory());
    }

    setHydrated(true);
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      if (keyboardOpenTimerRef.current) {
        window.clearTimeout(keyboardOpenTimerRef.current);
      }

      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  function goSearch(value: string) {
    const q = value.trim();

    if (!q) {
      requestTvKeyboard(inputRef.current);
      return;
    }

    const next = saveSearchHistory(q);
    setHistory(next);
    setKeyword("");
    router.push(`/tim-kiem?q=${encodeURIComponent(q)}`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goSearch(keyword);
  }

  function clearHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    setHistory([]);
    window.setTimeout(() => requestTvKeyboard(inputRef.current), 40);
  }

  function scheduleKeyboardOpen() {
    if (keyboardOpenTimerRef.current) {
      window.clearTimeout(keyboardOpenTimerRef.current);
    }

    keyboardOpenTimerRef.current = window.setTimeout(() => {
      requestTvKeyboard(inputRef.current);
      keyboardOpenTimerRef.current = null;
    }, 80);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isKeyboardOpenKey(event)) return;

    if (!keyword.trim()) {
      event.preventDefault();
      event.stopPropagation();
      requestTvKeyboard(inputRef.current);
    }
  }

  const showHistory = hydrated && history.length > 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black min-[1280px]:text-2xl">Tìm kiếm TV</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Focus vào ô tìm hoặc bấm OK để mở bàn phím TV.
          </p>
        </div>

        <Link
          href={mainQuickFilter.href}
          prefetch={false}
          data-tv-focus-key="tv-search:main-filter"
          className={[
            "rounded-full border border-yellow-300/30 bg-yellow-300/10 px-3 py-2 text-xs font-black text-yellow-100 hover:bg-yellow-300 hover:text-black",
            TV_FOCUS_CLASS,
          ].join(" ")}
        >
          {mainQuickFilter.label}
        </Link>
      </div>

      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          ref={inputRef}
          id={TV_SEARCH_INPUT_ID}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-tv-keyboard-input="true"
          data-tv-focus-key="tv-search:input"
          value={keyword}
          onFocus={scheduleKeyboardOpen}
          onClick={() => requestTvKeyboard(inputRef.current)}
          onKeyDown={handleInputKeyDown}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="OK để mở bàn phím..."
          className={[
            "h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-yellow-300 min-[1280px]:h-14 min-[1280px]:text-base",
            TV_FOCUS_CLASS,
          ].join(" ")}
        />

        <button
          type="submit"
          data-tv-focus-key="tv-search:submit"
          className={[
            "h-12 rounded-2xl bg-yellow-300 px-6 text-sm font-black text-black hover:bg-yellow-200 min-[1280px]:h-14 min-[1280px]:text-base",
            TV_FOCUS_CLASS,
          ].join(" ")}
        >
          Tìm
        </button>
      </form>

      {showHistory && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-200">Tìm gần đây</p>
            <button
              type="button"
              onClick={clearHistory}
              data-tv-focus-key="tv-search:clear-history"
              className={["text-[11px] font-bold text-red-300 hover:text-red-200", TV_FOCUS_CLASS].join(" ")}
            >
              Xóa hết
            </button>
          </div>

          <div data-tv-row data-tv-row-wrap="true" className="flex flex-wrap gap-1.5">
            {history.slice(0, 10).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => goSearch(item)}
                data-tv-focus-key={`tv-search:history:${item}`}
                className={[
                  "max-w-[220px] truncate rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 hover:bg-red-600 hover:text-white",
                  TV_FOCUS_CLASS,
                ].join(" ")}
                title={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
