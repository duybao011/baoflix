"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getImageUrl, MovieItem } from "@/lib/kkphim";

const SEARCH_HISTORY_KEY = "baoflix_search_history";

const defaultSuggestions = [
  "Moving",
  "Hoàn Hồn",
  "Night Has Come",
  "Sweet Home",
  "Hoa",
];

function readHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(keyword: string) {
  const q = keyword.trim();
  if (!q) return;

  const list = readHistory();
  const next = [q, ...list.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 12);

  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
}

export default function SearchBox() {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(false);

  const trimmedKeyword = keyword.trim();

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;

      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (trimmedKeyword.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        if (!cancelled) setLoading(true);
        const res = await fetch(
          `/api/search-suggest?q=${encodeURIComponent(trimmedKeyword)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Không lấy được gợi ý tìm kiếm.");
        const data = await res.json();
        if (!cancelled) {
          setSuggestions(Array.isArray(data?.items) ? data.items : []);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmedKeyword]);

  const quickSuggestions = useMemo(() => {
    const q = trimmedKeyword.toLowerCase();

    if (!q) return defaultSuggestions;

    return defaultSuggestions.filter((item) =>
      item.toLowerCase().includes(q)
    );
  }, [trimmedKeyword]);

  function submitSearch(value = keyword) {
    const q = value.trim();

    if (!q) return;

    saveHistory(q);
    setHistory(readHistory());
    setOpen(false);
    setKeyword("");

    router.push(`/tim-kiem?q=${encodeURIComponent(q)}&mode=smart`);
  }

  function clearHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    setHistory([]);
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitSearch();
        }}
        className="flex w-full gap-2"
      >
        <input
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setHistory(readHistory());
            setOpen(true);
          }}
          placeholder="Tìm phim..."
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none ring-red-500/40 placeholder:text-slate-400 focus:ring-2"
        />

        <button className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-500">
          Tìm
        </button>
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[90] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0f19] shadow-2xl">
          {trimmedKeyword && (
            <button
              type="button"
              onClick={() => submitSearch(trimmedKeyword)}
              className="block w-full border-b border-white/10 px-4 py-3 text-left text-sm hover:bg-white/10"
            >
              Tìm kiếm:{" "}
              <span className="font-bold text-red-300">{trimmedKeyword}</span>
            </button>
          )}

          {trimmedKeyword.length >= 2 && (
            <div className="border-b border-white/10 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-black">Gợi ý phim</h3>

                {loading && (
                  <span className="text-xs text-slate-400">Đang tìm...</span>
                )}
              </div>

              {suggestions.length > 0 ? (
                <div className="grid gap-2">
                  {suggestions.map((movie) => (
                    <Link
                      key={movie.slug}
                      href={`/phim/${movie.slug}`}
                      onClick={() => {
                        saveHistory(trimmedKeyword);
                        setHistory(readHistory());
                        setOpen(false);
                        setKeyword("");
                      }}
                      className="flex gap-3 rounded-2xl p-2 hover:bg-white/10"
                    >
                      <img
                        src={getImageUrl(movie.poster_url || movie.thumb_url)}
                        alt={movie.name}
                        className="h-16 w-11 rounded-xl object-cover"
                      />

                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-bold">
                          {movie.name}
                        </p>

                        <p className="line-clamp-1 text-xs text-slate-400">
                          {movie.origin_name}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                          {movie.year && <span>{movie.year}</span>}
                          {movie.episode_current && (
                            <span>{movie.episode_current}</span>
                          )}
                          {movie.lang && <span>{movie.lang}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                !loading && (
                  <p className="px-2 py-3 text-sm text-slate-400">
                    Chưa có gợi ý phim phù hợp.
                  </p>
                )
              )}
            </div>
          )}

          {history.length > 0 && (
            <div className="border-b border-white/10 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-black">Tìm gần đây</h3>

                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Xóa
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {history.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => submitSearch(item)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-3">
            <h3 className="mb-2 text-sm font-black">Gợi ý nhanh</h3>

            <div className="flex flex-wrap gap-2">
              {quickSuggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => submitSearch(item)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}