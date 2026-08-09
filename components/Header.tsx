"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getImageUrl } from "@/lib/kkphim";
import { isTvModeActive } from "@/lib/tvMode";

type NavItem = { label: string; href: string; highlight?: boolean };
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
const TV_KEYBOARD_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
  ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
] as const;

const mainNavItems: NavItem[] = [
  { label: "Chủ đề", href: "/chu-de" },
  { label: "Thể loại", href: "/the-loai" },
  { label: "Quốc gia", href: "/quoc-gia" },
  { label: "Diễn viên", href: "/dien-vien" },
  { label: "Bộ lọc", href: "/loc", highlight: true },
  { label: "Gu của tôi", href: "/gu-cua-toi" },
  { label: "Thêm phim", href: "/ca-nhan/them" },
  { label: "Cài đặt", href: "/cai-dat" },
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
  { label: "Cài đặt", href: "/cai-dat" },
  { label: "TV Mode", href: "/tv" },
];
const tvModeNavItems: NavItem[] = [
  { label: "Trang chủ", href: "/" },
  { label: "TV Mode", href: "/tv", highlight: true },
  { label: "Tìm kiếm", href: "/tim-kiem" },
  { label: "Bộ lọc", href: "/loc" },
  { label: "Phim Hàn", href: "/loc?country=han-quoc" },
  { label: "Phim Nhật", href: "/loc?country=nhat-ban" },
  { label: "Phim bộ Trung", href: "/loc?type=phim-bo&country=trung-quoc" },
  { label: "Yêu thích", href: "/yeu-thich" },
  { label: "Lịch sử", href: "/lich-su" },
  { label: "Phim riêng", href: "/ca-nhan" },
  { label: "Cài đặt", href: "/cai-dat" },
];

function uniqueNavItems(items: NavItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.href}-${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readSearchHistory() {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}
function saveSearchHistory(keyword: string) {
  const q = keyword.trim();
  if (!q) return [];
  const oldList = readSearchHistory();
  const next = [q, ...oldList.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 12);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  return next;
}
function clearSearchHistory() { localStorage.removeItem(SEARCH_HISTORY_KEY); }

function isTvSearchKeyboardEnabled() {
  if (typeof window === "undefined") return false;
  return isTvModeActive();
}

function SearchForm({ compact, onDone, autoFocus, initialKeyword }: { compact?: boolean; onDone?: () => void; autoFocus?: boolean; initialKeyword?: string }) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [keyword, setKeyword] = useState(initialKeyword || "");
  const [history, setHistory] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [tvKeyboardEnabled, setTvKeyboardEnabled] = useState(false);

  useEffect(() => { setKeyword(initialKeyword || ""); }, [initialKeyword]);
  useEffect(() => {
    setTvKeyboardEnabled(isTvSearchKeyboardEnabled());
    function refreshKeyboardEnabled() { setTvKeyboardEnabled(isTvSearchKeyboardEnabled()); }
    window.addEventListener("baoflix-tv-mode-change", refreshKeyboardEnabled);
    window.addEventListener("storage", refreshKeyboardEnabled);
    window.addEventListener("focus", refreshKeyboardEnabled);
    return () => {
      window.removeEventListener("baoflix-tv-mode-change", refreshKeyboardEnabled);
      window.removeEventListener("storage", refreshKeyboardEnabled);
      window.removeEventListener("focus", refreshKeyboardEnabled);
    };
  }, []);
  useEffect(() => {
    setHistory(readSearchHistory());
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) setFocused(false);
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);
  // BAOFLIX_PERF_PHASE1: debounce + abort search suggestion.
  useEffect(() => {
    const q = keyword.trim();

    if (!focused || q.length < 3) {
      setSuggestions([]);
      setLoadingSuggest(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function fetchSuggestions() {
      try {
        setLoadingSuggest(true);
        const res = await fetch(
          `/api/search-suggest?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Không lấy được gợi ý");

        const data = await res.json();
        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : [];

        if (!cancelled) setSuggestions(items.slice(0, 5));
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoadingSuggest(false);
      }
    }

    const timer = window.setTimeout(fetchSuggestions, 450);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [keyword, focused]);

  const filteredHistory = history.filter((item) => !keyword.trim() || item.toLowerCase().includes(keyword.trim().toLowerCase()));
  function goSearch(value: string) {
    const q = value.trim();
    if (!q) return;
    const next = saveSearchHistory(q);
    setHistory(next); setKeyword(q); setFocused(false); setSuggestions([]);
    router.push(`/tim-kiem?q=${encodeURIComponent(q)}`); onDone?.();
  }
  function goMovie(movie: SearchSuggestion) {
    const q = keyword.trim();
    if (q) setHistory(saveSearchHistory(q));
    setKeyword(""); setFocused(false); setSuggestions([]); router.push(`/phim/${movie.slug}`); onDone?.();
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); goSearch(keyword); }
  function appendKeyboardValue(value: string) { setKeyword((old) => `${old}${value}`); setFocused(true); }
  function backspaceKeyboardValue() { setKeyword((old) => old.slice(0, -1)); setFocused(true); }
  function clearKeyboardValue() { setKeyword(""); setFocused(true); }
  function handleSearchBlur() { window.setTimeout(() => { if (wrapperRef.current && !wrapperRef.current.contains(document.activeElement)) setFocused(false); }, 0); }
  const showDropdown = focused && (keyword.trim().length > 0 || suggestions.length > 0 || filteredHistory.length > 0);

  return <div ref={wrapperRef} onBlur={handleSearchBlur} className={["relative w-full", compact ? "" : "max-w-[560px]"].join(" ")}>
    <form onSubmit={submit} data-tv-row className="flex w-full items-center gap-2">
      <input type="search" data-tv-header-search-input data-tv-focus-key="header:search-input" value={keyword} autoFocus={autoFocus} readOnly={tvKeyboardEnabled} inputMode={tvKeyboardEnabled ? "none" : "search"} onFocus={() => setFocused(true)} onChange={(event) => { setKeyword(event.target.value); setFocused(true); }} placeholder="Tìm phim..." className={["min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/10 px-4 text-white outline-none placeholder:text-slate-400 focus:border-red-500", compact ? "h-12 text-base" : "h-11 text-sm"].join(" ")} />
      <button type="submit" data-tv-focus-key="header:search-submit" className={["shrink-0 rounded-2xl bg-red-600 font-black text-white hover:bg-red-500", compact ? "h-12 px-5 text-base" : "h-11 px-5 text-sm"].join(" ")}>Tìm</button>
    </form>
    {tvKeyboardEnabled && focused && <div data-tv-search-keyboard className="mt-2 rounded-2xl border border-white/10 bg-black/35 p-2"><div className="grid gap-1.5">
      {TV_KEYBOARD_ROWS.map((row, rowIndex) => <div key={row.join("")} data-tv-row data-tv-row-wrap="true" className="flex flex-wrap justify-center gap-1.5">{row.map((keyValue) => <button key={keyValue} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => appendKeyboardValue(keyValue)} data-tv-focus-key={`header-keyboard:${rowIndex}:${keyValue}`} data-tv-default={rowIndex === 0 && keyValue === "q" ? true : undefined} className="min-h-9 min-w-9 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300">{keyValue.toUpperCase()}</button>)}</div>)}
      <div data-tv-row data-tv-row-wrap="true" className="mt-1 grid grid-cols-4 gap-1.5"><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => appendKeyboardValue(" ")} data-tv-focus-key="header-keyboard:space" className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10">Cách</button><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={backspaceKeyboardValue} data-tv-focus-key="header-keyboard:backspace" className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10">Xóa ký tự</button><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={clearKeyboardValue} data-tv-focus-key="header-keyboard:clear" className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-2 text-sm font-black text-white hover:bg-white/10">Xóa hết</button><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => goSearch(keyword)} data-tv-focus-key="header-keyboard:submit" className="min-h-10 rounded-xl bg-red-600 px-2 text-sm font-black text-white hover:bg-red-500">Tìm</button></div>
    </div></div>}
    {showDropdown && <div data-tv-row data-tv-row-wrap="true" className="absolute left-0 right-0 top-[calc(100%+8px)] z-[70] max-h-[70dvh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0b0f19] shadow-2xl">
      {keyword.trim().length > 0 && <button type="button" onClick={() => goSearch(keyword)} data-tv-focus-key="header-search:submit-keyword" className="block w-full border-b border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-bold text-slate-200 hover:bg-white/[0.08]">Tìm kiếm: <span className="font-black text-red-300">{keyword.trim()}</span></button>}
      {(loadingSuggest || suggestions.length > 0) && <section className="border-b border-white/10 p-4"><h3 className="mb-3 text-lg font-black">Gợi ý phim</h3>{loadingSuggest && suggestions.length === 0 ? <p className="text-sm text-slate-400">Đang tìm gợi ý...</p> : <div className="grid gap-3">{suggestions.map((movie) => <button key={movie.slug} type="button" onClick={() => goMovie(movie)} data-tv-focus-key={`header-search:suggest:${movie.slug}`} className="flex w-full gap-3 rounded-2xl p-2 text-left hover:bg-white/5"><div className="h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-white/5"><img src={getImageUrl(movie.poster_url || movie.thumb_url)} alt={movie.name} className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1 py-1"><p className="line-clamp-1 font-black text-white">{movie.name}</p>{movie.origin_name && <p className="mt-0.5 line-clamp-1 text-sm text-slate-400">{movie.origin_name}</p>}<div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">{movie.year && <span>{movie.year}</span>}{movie.episode_current && <span>{movie.episode_current}</span>}{movie.lang && <span>{movie.lang}</span>}</div></div></button>)}</div>}</section>}
      {filteredHistory.length > 0 && <section className="p-4"><div className="mb-2 flex items-center justify-between gap-3"><p className="text-sm font-black text-slate-200">Tìm gần đây</p><button type="button" onClick={() => { clearSearchHistory(); setHistory([]); }} data-tv-skip tabIndex={-1} className="text-xs font-bold text-red-300 hover:text-red-200">Xóa</button></div><div data-tv-row data-tv-row-wrap="true" className="flex flex-wrap gap-2">{filteredHistory.map((item) => <button key={item} type="button" onClick={() => goSearch(item)} data-tv-focus-key={`header-search:history:${item}`} className="max-w-[150px] truncate rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-bold text-slate-200 hover:bg-white/10" title={item}>{item}</button>)}</div></section>}
    </div>}
  </div>;
}

function NavButton({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const router = useRouter();
  function prefetchRoute() { router.prefetch(item.href); }
  return <Link href={item.href} onClick={onClick} prefetch={false} onMouseEnter={prefetchRoute} onFocus={prefetchRoute} data-tv-focus-key={`nav:${item.href}:${item.label}`} className={["rounded-2xl border px-4 py-2.5 text-sm font-bold transition", item.highlight ? "border-red-500/40 bg-red-600/15 text-red-100 hover:bg-red-600" : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"].join(" ")}>{item.label}</Link>;
}

export default function Header() {
  const pathname = usePathname();
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isSearchPage = pathname === "/tim-kiem";
  const isTvMode = pathname === "/tv";
  const hideRegularHeader = pathname === "/tv";
  const isWatchPage = pathname.startsWith("/xem") || (pathname.startsWith("/ca-nhan/") && pathname.includes("/xem"));
  useEffect(() => {
    function refreshCurrentKeyword() {
      try {
        const params = new URLSearchParams(window.location.search);
        setCurrentKeyword(params.get("q") || params.get("keyword") || "");
      } catch {
        setCurrentKeyword("");
      }
    }

    refreshCurrentKeyword();
    window.addEventListener("popstate", refreshCurrentKeyword);
    window.addEventListener("baoflix-tv-route-change", refreshCurrentKeyword);
    window.addEventListener("focus", refreshCurrentKeyword);

    return () => {
      window.removeEventListener("popstate", refreshCurrentKeyword);
      window.removeEventListener("baoflix-tv-route-change", refreshCurrentKeyword);
      window.removeEventListener("focus", refreshCurrentKeyword);
    };
  }, [pathname]);
  const desktopNavItems = uniqueNavItems(isTvMode ? tvModeNavItems : [...mainNavItems, ...quickNavItems]);
  const mobileMainItems = uniqueNavItems(isTvMode ? tvModeNavItems : mainNavItems);
  const mobileQuickItems = uniqueNavItems(isTvMode ? quickNavItems.slice(0, 8) : quickNavItems);
  const showMobileSearch = searchOpen || isSearchPage;
  useEffect(() => {
    if (!menuOpen) return;
    const oldOverflow = document.body.style.overflow;
    const oldTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => { document.body.style.overflow = oldOverflow; document.body.style.touchAction = oldTouchAction; };
  }, [menuOpen]);
  function closePanels() { setMenuOpen(false); setSearchOpen(false); }
  return <><header className={["sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/95 backdrop-blur-xl", isWatchPage ? "hidden lg:block" : "", hideRegularHeader ? "hidden" : ""].join(" ")}><div className="mx-auto max-w-7xl px-4 py-3"><div className="flex items-center justify-between gap-3 lg:hidden"><Link href="/" className="text-2xl font-black tracking-tight text-white" onClick={closePanels}><span className="text-red-500">Bảo</span>Flix</Link><div className="flex items-center gap-2">{!isSearchPage && <button type="button" data-tv-header-search-toggle data-tv-focus-key="header:search-toggle" onClick={() => { setSearchOpen((v) => !v); setMenuOpen(false); }} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10">Tìm</button>}<button type="button" data-tv-header-menu-button data-tv-focus-key="header:menu" onClick={() => { setMenuOpen((v) => !v); setSearchOpen(false); }} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10">☰</button></div></div>{showMobileSearch && <div className="mt-3 lg:hidden"><SearchForm compact initialKeyword={currentKeyword} onDone={closePanels} /></div>}<div className="hidden lg:block"><div className="flex items-center justify-between gap-6"><Link href="/" className="shrink-0 text-2xl font-black tracking-tight text-white"><span className="text-red-500">Bảo</span>Flix</Link><SearchForm initialKeyword={currentKeyword} /><button type="button" data-tv-header-menu-button data-tv-header-desktop-menu-button data-tv-focus-key="header:menu-desktop" onClick={() => { setMenuOpen((v) => !v); setSearchOpen(false); }} className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300">☰</button></div><nav className="mt-4 flex flex-wrap gap-2">{desktopNavItems.map((item) => <NavButton key={`${item.href}-${item.label}`} item={item} />)}</nav></div></div></header>{menuOpen && <div data-tv-modal data-tv-scope="header-menu" data-tv-lock="true" data-tv-autofocus="true" className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm"><div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#070b14]"><div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4"><Link href="/" onClick={closePanels} className="text-2xl font-black tracking-tight text-white"><span className="text-red-500">Bảo</span>Flix</Link><button type="button" data-tv-close data-tv-default data-tv-focus-key="header-menu:close" onClick={closePanels} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white">Đóng</button></div><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5" style={{ WebkitOverflowScrolling: "touch" }}><section><h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-400">Tìm nhanh</h2><SearchForm compact onDone={closePanels} /></section><section className="mt-7"><h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-400">Điều hướng</h2><div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3">{mobileMainItems.map((item) => <NavButton key={`${item.href}-${item.label}`} item={item} onClick={closePanels} />)}</div></section><section className="mt-7"><h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-slate-400">Xem nhanh</h2><div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3">{mobileQuickItems.map((item) => <NavButton key={`${item.href}-${item.label}`} item={item} onClick={closePanels} />)}</div></section><div className="h-10" /></div></div></div>}</>;
}
