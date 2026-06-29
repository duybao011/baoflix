"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SEARCH_HISTORY_KEY = "baoflix_search_history";
const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const quickKeywordGroups = [
  {
    title: "Hay tìm",
    items: ["Anime", "Phim bộ Trung", "Hàn Quốc", "Nhật Bản", "Cổ trang"],
  },
  {
    title: "Ngôn ngữ",
    items: ["Vietsub", "Thuyết minh", "Lồng tiếng"],
  },
  {
    title: "Nhanh",
    items: ["2026", "2025", "2024", "Phim lẻ", "Phim bộ"],
  },
];

const quickFilters = [
  { label: "Trung bộ", href: "/loc?type=phim-bo&country=trung-quoc" },
  { label: "Hàn", href: "/loc?country=han-quoc" },
  { label: "Nhật", href: "/loc?country=nhat-ban" },
  { label: "Anime", href: "/danh-sach/hoat-hinh" },
  { label: "Vietsub", href: "/loc?sort_lang=vietsub" },
  { label: "Thuyết minh", href: "/loc?sort_lang=thuyet-minh" },
  { label: "Lồng tiếng", href: "/loc?sort_lang=long-tieng" },
  { label: "Phim lẻ", href: "/danh-sach/phim-le" },
];

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

export default function TvSearchBox() {
  const router = useRouter();

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
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  function goSearch(value: string) {
    const q = value.trim();

    if (!q) return;

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
  }

  const showHistory = hydrated && history.length > 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3">
        <h2 className="text-xl font-black min-[1280px]:text-2xl">Tìm nhanh</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          TV ưu tiên chip tìm nhanh; ô nhập chỉ để dùng khi cần.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Nhập tên phim..."
          className={[
            "h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-yellow-300 min-[1280px]:h-14 min-[1280px]:text-base",
            TV_FOCUS_CLASS,
          ].join(" ")}
        />

        <button
          type="submit"
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
              className="text-[11px] font-bold text-red-300 hover:text-red-200"
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
                className={[
                  "max-w-[180px] truncate rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 hover:bg-red-600 hover:text-white",
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

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {quickKeywordGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-xs font-black text-slate-200">{group.title}</p>
            <div data-tv-row data-tv-row-wrap="true" className="flex flex-wrap gap-1.5">
              {group.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => goSearch(item)}
                  className={[
                    "rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/10",
                    TV_FOCUS_CLASS,
                  ].join(" ")}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div data-tv-row data-tv-row-wrap="true" className="mt-4 grid grid-cols-4 gap-2 lg:grid-cols-8">
        {quickFilters.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center text-xs font-black hover:border-yellow-300/60 hover:bg-white/10",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
