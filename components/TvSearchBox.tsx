"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SEARCH_HISTORY_KEY = "baoflix_search_history";
const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.035] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black";

const quickKeywordGroups = [
  {
    title: "Hay tìm trên TV",
    items: ["Anime", "Phim bộ Trung", "Hàn Quốc", "Nhật Bản", "Cổ trang"],
  },
  {
    title: "Ngôn ngữ",
    items: ["Vietsub", "Thuyết minh", "Lồng tiếng"],
  },
  {
    title: "Nhanh theo năm",
    items: ["2026", "2025", "2024", "Phim lẻ", "Phim bộ"],
  },
];

const quickFilters = [
  {
    label: "Phim bộ Trung",
    desc: "Series dài, mở là lọc",
    href: "/loc?type=phim-bo&country=trung-quoc",
  },
  {
    label: "Hàn Quốc",
    desc: "Phim Hàn",
    href: "/loc?country=han-quoc",
  },
  {
    label: "Nhật Bản",
    desc: "Phim Nhật",
    href: "/loc?country=nhat-ban",
  },
  {
    label: "Anime",
    desc: "Hoạt hình",
    href: "/danh-sach/hoat-hinh",
  },
  {
    label: "Vietsub",
    desc: "Có phụ đề",
    href: "/loc?sort_lang=vietsub",
  },
  {
    label: "Thuyết minh",
    desc: "Dễ xem TV",
    href: "/loc?sort_lang=thuyet-minh",
  },
  {
    label: "Lồng tiếng",
    desc: "Nghe tiếng Việt",
    href: "/loc?sort_lang=long-tieng",
  },
  {
    label: "Phim lẻ",
    desc: "Xem nhanh",
    href: "/danh-sach/phim-le",
  },
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
    <section
      data-tv-section="search"
      className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-6"
    >
      <div className="mb-4">
        <h2 className="text-2xl font-black md:text-3xl">Tìm nhanh trên TV</h2>

        <p className="mt-1 text-sm text-slate-400">
          Ưu tiên chip và lối tắt trước, chỉ nhập chữ khi thật sự cần.
        </p>
      </div>

      <div data-tv-row data-tv-row-wrap="true" className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickFilters.slice(0, 4).map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            data-tv-focus-key={`tv-search-filter:${item.href}`}
            className={[
              "rounded-3xl border p-4 transition hover:border-yellow-300/70 hover:bg-white/[0.08]",
              index === 0
                ? "border-yellow-300/25 bg-yellow-300/[0.08]"
                : "border-white/10 bg-black/20",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            <p className="text-base font-black text-white">{item.label}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">{item.desc}</p>
          </Link>
        ))}
      </div>

      <form onSubmit={submit} data-tv-row className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Nhập tên phim nếu chip chưa đủ..."
          data-tv-focus-key="tv-search-input"
          className={[
            "h-14 rounded-3xl border border-white/10 bg-black/30 px-5 text-base font-bold text-white outline-none placeholder:text-slate-500 focus:border-yellow-300 md:h-16 md:text-xl",
            TV_FOCUS_CLASS,
          ].join(" ")}
        />

        <button
          type="submit"
          data-tv-focus-key="tv-search-submit"
          className={[
            "h-14 rounded-3xl bg-yellow-300 px-8 text-base font-black text-black hover:bg-yellow-200 md:h-16 md:text-xl",
            TV_FOCUS_CLASS,
          ].join(" ")}
        >
          Tìm
        </button>
      </form>

      {showHistory && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-200">Tìm gần đây</p>

            <button
              type="button"
              onClick={clearHistory}
              data-tv-focus-key="tv-search-clear-history"
              className={[
                "rounded-full border border-red-300/20 bg-red-300/10 px-3 py-1 text-xs font-bold text-red-200 hover:bg-red-300/20",
                TV_FOCUS_CLASS,
              ].join(" ")}
            >
              Xóa hết
            </button>
          </div>

          <div data-tv-row data-tv-row-wrap="true" className="flex flex-wrap gap-2">
            {history.slice(0, 10).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => goSearch(item)}
                data-tv-focus-key={`tv-search-history:${item}`}
                className={[
                  "max-w-[220px] truncate rounded-full border border-white/10 bg-white/5 px-5 py-3 text-base font-black text-slate-200 hover:bg-red-600 hover:text-white",
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

      <div className="mt-6 grid gap-5">
        {quickKeywordGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-3 text-sm font-black text-slate-200">{group.title}</p>

            <div data-tv-row data-tv-row-wrap="true" className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => goSearch(item)}
                  data-tv-focus-key={`tv-search-chip:${group.title}:${item}`}
                  className={[
                    "rounded-full border border-white/10 bg-white/5 px-5 py-3 text-base font-black text-slate-200 hover:bg-white/10",
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

      <div data-tv-row data-tv-row-wrap="true" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {quickFilters.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-tv-focus-key={`tv-search-filter-bottom:${item.href}`}
            className={[
              "rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-center text-sm font-black hover:border-yellow-300/60 hover:bg-white/10",
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
