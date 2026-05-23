"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const SEARCH_HISTORY_KEY = "baoflix_search_history";

const suggestedKeywords = [
  "Moving",
  "Monster",
  "Hoa đào",
  "Yêu",
  "Hàn Quốc",
  "Nhật Bản",
  "Anime",
  "Lồng tiếng",
  "Thuyết minh",
  "Học đường",
  "Tình cảm",
  "Kinh dị",
];

const quickFilters = [
  {
    label: "Phim Hàn",
    href: "/loc?country=han-quoc",
  },
  {
    label: "Phim Nhật",
    href: "/loc?country=nhat-ban",
  },
  {
    label: "Vietsub",
    href: "/loc?sort_lang=vietsub",
  },
  {
    label: "Thuyết minh",
    href: "/loc?sort_lang=thuyet-minh",
  },
  {
    label: "Lồng tiếng",
    href: "/loc?sort_lang=long-tieng",
  },
  {
    label: "Phim riêng",
    href: "/ca-nhan",
  },
];

function readSearchHistory() {
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

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

export default function SearchEmptyState() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory(readSearchHistory());

    function refresh() {
      setHistory(readSearchHistory());
    }

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  function deleteHistoryItem(value: string) {
    const next = history.filter(
      (item) => item.toLowerCase() !== value.toLowerCase()
    );

    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
  }

  function clearAll() {
    clearSearchHistory();
    setHistory([]);
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-black">Tìm kiếm phim</h1>

        <p className="mt-2 text-slate-400">
          Nhập tên phim vào ô tìm kiếm phía trên để bắt đầu.
        </p>
      </section>

      {history.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Tìm gần đây</h2>

              <p className="mt-1 text-sm text-slate-400">
                Bấm vào từ khóa để tìm lại ngay.
              </p>
            </div>

            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-600 hover:text-white"
            >
              Xóa hết
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {history.map((item) => (
              <div
                key={item}
                className="group inline-flex max-w-[170px] items-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-sm font-bold text-slate-200 hover:bg-white/10"
              >
                <Link
                  href={`/tim-kiem?q=${encodeURIComponent(item)}`}
                  className="min-w-0 truncate px-4 py-2"
                  title={item}
                >
                  {item}
                </Link>

                <button
                  type="button"
                  onClick={() => deleteHistoryItem(item)}
                  className="border-l border-white/10 px-3 py-2 text-slate-500 hover:bg-red-600 hover:text-white"
                  title="Xóa"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-black">Gợi ý tìm kiếm</h2>

        <p className="mt-1 text-sm text-slate-400">
          Một vài từ khóa để fen test nhanh.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {suggestedKeywords.map((keyword) => (
            <Link
              key={keyword}
              href={`/tim-kiem?q=${encodeURIComponent(keyword)}`}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-red-600 hover:text-white"
            >
              {keyword}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-black">Lọc nhanh</h2>

        <p className="mt-1 text-sm text-slate-400">
          Đi thẳng tới vài mục hay dùng.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickFilters.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-sm font-black hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}