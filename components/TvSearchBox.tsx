"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SEARCH_HISTORY_KEY = "baoflix_search_history";

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
    href: "/loc?type=phim-bo&country=trung-quoc",
  },
  {
    label: "Phim bộ Trung LT mới",
    href: "/loc?type=phim-bo&country=trung-quoc&sort_lang=long-tieng&sort_field=year&sort_type=desc",
  },
  {
    label: "Phim Hàn",
    href: "/loc?country=han-quoc",
  },
  {
    label: "Phim Nhật",
    href: "/loc?country=nhat-ban",
  },
  {
    label: "Anime",
    href: "/danh-sach/hoat-hinh",
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
    label: "Phim lẻ",
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
  // Đừng đọc localStorage trong initial render. Server render không có localStorage,
  // còn client có thể có lịch sử tìm kiếm, khiến cây HTML lệch và báo hydration mismatch.
  const [history, setHistory] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

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
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-black md:text-3xl">Tìm nhanh trên TV</h2>

        <p className="mt-1 text-sm text-slate-400">
          Nhập bằng remote khá cực, nên BảoFlix ưu tiên chip tìm nhanh và bộ lọc lớn.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Nhập tên phim..."
          className="h-16 rounded-3xl border border-white/10 bg-black/30 px-5 text-lg font-bold text-white outline-none placeholder:text-slate-500 focus:border-yellow-300 md:h-20 md:text-2xl"
        />

        <button
          type="submit"
          className="h-16 rounded-3xl bg-yellow-300 px-8 text-lg font-black text-black hover:bg-yellow-200 md:h-20 md:text-2xl"
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
              className="text-xs font-bold text-red-300 hover:text-red-200"
            >
              Xóa hết
            </button>
          </div>

          <div data-tv-row className="flex flex-wrap gap-2">
            {history.slice(0, 10).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => goSearch(item)}
                className="max-w-[220px] truncate rounded-full border border-white/10 bg-white/5 px-5 py-3 text-base font-black text-slate-200 hover:bg-red-600 hover:text-white"
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

            <div data-tv-row className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => goSearch(item)}
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-base font-black text-slate-200 hover:bg-white/10"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div data-tv-row className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-9">
        {quickFilters.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-center text-sm font-black hover:border-yellow-300/60 hover:bg-white/10"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
