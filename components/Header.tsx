"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getImageUrl } from "@/lib/kkphim";

type NavItem = {
  label: string;
  href: string;
  highlight?: boolean;
};

type SearchSuggestion = {
  _id?: string;
  name: string;
  slug: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  episode_current?: string;
  quality?: string;
  lang?: string;
};

const SEARCH_HISTORY_KEY = "baoflix_search_history";

const mainNavItems: NavItem[] = [
  { label: "Chủ đề", href: "/chu-de" },
  { label: "Thể loại", href: "/the-loai" },
  { label: "Quốc gia", href: "/quoc-gia" },
  { label: "Diễn viên", href: "/dien-vien" },
  { label: "Bộ lọc", href: "/loc", highlight: true },
  { label: "Gu của tôi", href: "/gu-cua-toi" },
  { label: "Thêm phim", href: "/ca-nhan/them" },
];

const quickNavItems: NavItem[] = [
  { label: "Phim lẻ", href: "/danh-sach/phim-le" },
  { label: "Phim bộ", href: "/danh-sach/phim-bo" },
  { label: "TV Shows", href: "/danh-sach/tv-shows" },
  { label: "Hoạt hình", href: "/danh-sach/hoat-hinh" },
  { label: "Vietsub", href: "/loc?sort_lang=vietsub" },
  { label: "Thuyết minh", href: "/loc?sort_lang=thuyet-minh" },
  { label: "Lồng tiếng", href: "/loc?sort_lang=long-tieng" },
  { label: "Yêu thích", href: "/yeu-thich" },
  { label: "Lịch sử", href: "/lich-su" },
  { label: "Phim riêng", href: "/ca-nhan" },
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

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

function SearchForm({
  compact,
  onDone,
}: {
  compact?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [keyword, setKeyword] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  useEffect(() => {
    setHistory(readSearchHistory());

    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;

      if (!wrapperRef.current.contains(event.target as Node)) {
        setFocused(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const q = keyword.trim();

    if (q.length < 2) {
      setSuggestions([]);
      setLoadingSuggest(false);
      return;
    }

    let cancelled = false;

    async function fetchSuggestions() {
      try {
        setLoadingSuggest(true);

        const res = await fetch(
          `/api/search-suggest?q=${encodeURIComponent(q)}`,
          {
            cache: "no-store",
          }
        );

        if (!res.ok) {
          throw new Error("Không lấy được gợi ý");
        }

        const data = await res.json();

        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : [];

        if (!cancelled) {
          setSuggestions(items.slice(0, 5));
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSuggest(false);
        }
      }
    }

    const timer = window.setTimeout(fetchSuggestions, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [keyword]);

  const filteredHistory = history.filter((item) => {
    const q = keyword.trim().toLowerCase();

    if (!q) return true;

    return item.toLowerCase().includes(q);
  });

  function goSearch(value: string) {
    const q = value.trim();

    if (!q) return;

    const next = saveSearchHistory(q);
    setHistory(next);
    setKeyword("");
    setFocused(false);
    setSuggestions([]);

    router.push(`/tim-kiem?q=${encodeURIComponent(q)}`);
    onDone?.();
  }

  function goMovie(movie: SearchSuggestion) {
    const q = keyword.trim();

    if (q) {
      const next = saveSearchHistory(q);
      setHistory(next);
    }

    setKeyword("");
    setFocused(false);
    setSuggestions([]);

    router.push(`/phim/${movie.slug}`);
    onDone?.();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goSearch(keyword);
  }

  function deleteHistoryItem(value: string) {
    const next = history.filter(
      (item) => item.toLowerCase() !== value.toLowerCase()
    );

    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
  }

  function clearAllHistory() {
    clearSearchHistory();
    setHistory([]);
  }

  const showDropdown =
    focused &&
    (keyword.trim().length > 0 ||
      suggestions.length > 0 ||
      filteredHistory.length > 0);

  return (
    <div
      ref={wrapperRef}
      className={["relative w-full", compact ? "" : "max-w-[560px]"].join(" ")}
    >
      <form onSubmit={submit} className="flex w-full items-center gap-2">
        <input
          value={keyword}
          onFocus={() => setFocused(true)}
          onChange={(event) => {
            setKeyword(event.target.value);
            setFocused(true);
          }}
          placeholder="Tìm phim..."
          className={[
            "min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none placeholder:text-slate-400 focus:border-red-500",
            compact ? "h-12 text-base" : "h-11 text-sm",
          ].join(" ")}
        />

        <button
          type="submit"
          className={[
            "shrink-0 rounded-2xl bg-red-600 font-black text-white hover:bg-red-500",
            compact ? "h-12 px-5 text-base" : "h-11 px-5 text-sm",
          ].join(" ")}
        >
          Tìm
        </button>
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[70] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0f19] shadow-2xl">
          {keyword.trim().length > 0 && (
            <button
              type="button"
              onClick={() => goSearch(keyword)}
              className="block w-full border-b border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-bold text-slate-200 hover:bg-white/[0.08]"
            >
              Tìm kiếm:{" "}
              <span className="font-black text-red-300">{keyword.trim()}</span>
            </button>
          )}

          {(loadingSuggest || suggestions.length > 0) && (
            <section className="border-b border-white/10 p-4">
              <h3 className="mb-3 text-lg font-black">Gợi ý phim</h3>

              {loadingSuggest && suggestions.length === 0 ? (
                <p className="text-sm text-slate-400">Đang tìm gợi ý...</p>
              ) : (
                <div className="grid gap-3">
                  {suggestions.map((movie) => (
                    <button
                      key={movie.slug}
                      type="button"
                      onClick={() => goMovie(movie)}
                      className="flex w-full gap-3 rounded-2xl p-2 text-left hover:bg-white/5"
                    >
                      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-white/5">
                        <img
                          src={getImageUrl(movie.poster_url || movie.thumb_url)}
                          alt={movie.name}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1 py-1">
                        <p className="line-clamp-1 font-black text-white">
                          {movie.name}
                        </p>

                        {movie.origin_name && (
                          <p className="mt-0.5 line-clamp-1 text-sm text-slate-400">
                            {movie.origin_name}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          {movie.year && <span>{movie.year}</span>}
                          {movie.episode_current && (
                            <span>{movie.episode_current}</span>
                          )}
                          {movie.lang && <span>{movie.lang}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {filteredHistory.length > 0 && (
            <section className="p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-200">Tìm gần đây</p>

                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="text-xs font-bold text-red-300 hover:text-red-200"
                >
                  Xóa
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {filteredHistory.map((item) => (
                  <div
                    key={item}
                    className="group inline-flex max-w-[150px] items-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-[12px] font-bold text-slate-200 hover:bg-white/10"
                  >
                    <button
                      type="button"
                      onClick={() => goSearch(item)}
                      className="min-w-0 truncate px-3 py-1.5"
                      title={item}
                    >
                      {item}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteHistoryItem(item)}
                      className="border-l border-white/10 px-2 py-1.5 text-slate-500 hover:bg-red-600 hover:text-white"
                      title="Xóa"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function NavButton({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={[
        "rounded-2xl border px-4 py-2.5 text-sm font-bold transition",
        item.highlight
          ? "border-red-500/40 bg-red-600/15 text-red-100 hover:bg-red-600"
          : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10",
      ].join(" ")}
    >
      {item.label}
    </Link>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

useEffect(() => {
  if (!menuOpen) return;

  const oldOverflow = document.body.style.overflow;
  const oldTouchAction = document.body.style.touchAction;

  document.body.style.overflow = "hidden";
  document.body.style.touchAction = "none";

  return () => {
    document.body.style.overflow = oldOverflow;
    document.body.style.touchAction = oldTouchAction;
  };
}, [menuOpen]);

  function closePanels() {
    setMenuOpen(false);
    setSearchOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <Link
              href="/"
              className="text-2xl font-black tracking-tight text-white"
              onClick={closePanels}
            >
              <span className="text-red-500">Bảo</span>Flix
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((value) => !value);
                  setMenuOpen(false);
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10"
              >
                Tìm
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen((value) => !value);
                  setSearchOpen(false);
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10"
              >
                ☰
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="mt-3 lg:hidden">
              <SearchForm compact onDone={closePanels} />
            </div>
          )}

          <div className="hidden lg:block">
            <div className="flex items-center justify-between gap-6">
              <Link
                href="/"
                className="shrink-0 text-2xl font-black tracking-tight text-white"
              >
                <span className="text-red-500">Bảo</span>Flix
              </Link>

              <SearchForm />
            </div>

            <nav className="mt-4 flex flex-wrap gap-2">
              {[...mainNavItems, ...quickNavItems].map((item) => (
                <NavButton key={`${item.href}-${item.label}`} item={item} />
              ))}
            </nav>
          </div>
        </div>
      </header>

{menuOpen && (
  <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm lg:hidden">
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#070b14]">
      <div className="shrink-0 flex items-center justify-between border-b border-white/10 px-4 py-4">
        <Link
          href="/"
          onClick={closePanels}
          className="text-2xl font-black tracking-tight text-white"
        >
          <span className="text-red-500">Bảo</span>Flix
        </Link>

        <button
          type="button"
          onClick={closePanels}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white"
        >
          Đóng
        </button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5"
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >
        <section>
          <h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-400">
            Tìm nhanh
          </h2>

          <SearchForm compact onDone={closePanels} />
        </section>

        <section className="mt-7">
          <h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-400">
            Điều hướng
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {mainNavItems.map((item) => (
              <NavButton
                key={`${item.href}-${item.label}`}
                item={item}
                onClick={closePanels}
              />
            ))}
          </div>
        </section>

        <section className="mt-7">
          <h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-400">
            Xem nhanh
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {quickNavItems.map((item) => (
              <NavButton
                key={`${item.href}-${item.label}`}
                item={item}
                onClick={closePanels}
              />
            ))}
          </div>
        </section>

        <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <h2 className="text-lg font-black">Gợi ý cho iPhone / TV</h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Menu này dùng nút to hơn để dễ bấm bằng tay hoặc remote. Khi đóng
            APK/WebView, phần này sẽ đỡ phải kéo ngang như header cũ.
          </p>
        </section>

        <div className="h-10" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}