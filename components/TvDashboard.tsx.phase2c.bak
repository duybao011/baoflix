"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TvSearchBox from "@/components/TvSearchBox";
import { getImageUrl, type MovieItem } from "@/lib/kkphim";
import { readWatchHistory, type WatchHistoryItem } from "@/lib/watchStore";
import { readCustomMovies, type StoredCustomMovie } from "@/lib/customMoviesClient";

type FavoriteItem = MovieItem;
type TvDashboardProps = { chineseSeries?: MovieItem[] };

const FAVORITES_KEY = "baoflix_favorites";
const TV_HOME_CACHE_KEY = "baoflix_tv_home_cache_v4";
const QUICK_FILTER_HREF =
  "/loc?country=trung-quoc&sort_lang=long-tieng&category=co-trang&sort_field=year&sort_type=desc";

const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.045] focus-visible:border-yellow-300 focus-visible:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const railItems = [
  ["Trang chủ", "/tv", "rail:home"],
  ["Tìm", "#tv-search", "rail:search"],
  ["Bộ lọc", "/loc", "rail:filter"],
  ["Phim riêng", "/ca-nhan", "rail:custom"],
  ["Lịch sử", "/lich-su", "rail:history"],
  ["Yêu thích", "/yeu-thich", "rail:favorites"],
  ["Cài đặt", "/cai-dat", "rail:settings"],
] as const;

function readFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function readCache(): MovieItem[] {
  try {
    const raw = localStorage.getItem(TV_HOME_CACHE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return Array.isArray(data?.chineseSeries) ? data.chineseSeries : [];
  } catch {
    return [];
  }
}

function writeCache(items: MovieItem[]) {
  try {
    localStorage.setItem(TV_HOME_CACHE_KEY, JSON.stringify({ chineseSeries: items, savedAt: Date.now() }));
  } catch {}
}

function getHistoryHref(item: WatchHistoryItem) {
  if (item.href) return item.href;
  if (item.isCustom) {
    return `/ca-nhan/${item.slug}/xem?season=${item.seasonIndex ?? 0}&tap=${item.episodeIndex ?? 0}`;
  }
  return `/xem/${item.slug}?server=${item.serverIndex ?? 0}&tap=${item.episodeIndex ?? 0}`;
}

function getMeta(item: { year?: number; lang?: string; quality?: string; episode_current?: string }) {
  return [item.year, item.lang, item.quality, item.episode_current].filter(Boolean).slice(0, 3).join(" • ");
}

function focusTvSearch() {
  const searchRoot = document.querySelector<HTMLElement>("#tv-search");
  const input =
    searchRoot?.querySelector<HTMLElement>("[data-tv-keyboard-input], input[type='search']") ||
    document.querySelector<HTMLElement>("[data-tv-keyboard-input], input[type='search']");

  if (input) {
    input.focus({ preventScroll: true });
    input.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });
    input.click();
  }
}

function Rail() {
  return (
    <aside
      data-tv-rail="true"
      data-tv-row
      data-tv-row-key="tv-rail"
      data-tv-row-wrap="true"
      data-tv-focus-out-right="content"
      className="sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 backdrop-blur lg:grid lg:w-[92px] xl:w-[104px]"
    >
      {railItems.map(([label, href, key], index) =>
        href.startsWith("#") ? (
          <button
            key={key}
            type="button"
            data-tv-default={index === 0 ? true : undefined}
            data-tv-focus-key={key}
            onClick={focusTvSearch}
            className={[
              "flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-2 text-center text-[11px] font-black text-slate-200 transition hover:bg-white/[0.08] xl:min-h-14 xl:text-xs",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            {label}
          </button>
        ) : (
          <Link
            key={key}
            href={href}
            prefetch={false}
            data-tv-default={index === 0 ? true : undefined}
            data-tv-focus-key={key}
            className={[
              "flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-2 text-center text-[11px] font-black text-slate-200 transition hover:bg-white/[0.08] xl:min-h-14 xl:text-xs",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            {label}
          </Link>
        )
      )}
    </aside>
  );
}

function Tile({
  href,
  label,
  desc,
  hot,
  focusKey,
  tvDefault,
}: {
  href: string;
  label: string;
  desc?: string;
  hot?: boolean;
  focusKey: string;
  tvDefault?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      data-tv-default={tvDefault ? true : undefined}
      data-tv-focus-key={focusKey}
      className={[
        "rounded-xl border px-3 py-2.5 transition duration-100",
        hot
          ? "border-yellow-300/40 bg-yellow-300 text-black hover:bg-yellow-200"
          : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]",
        TV_FOCUS_CLASS,
      ].join(" ")}
    >
      <p className="text-sm font-black min-[1280px]:text-base">{label}</p>
      {desc && <p className={["mt-0.5 line-clamp-1 text-[10px]", hot ? "text-black/70" : "text-slate-400"].join(" ")}>{desc}</p>}
    </Link>
  );
}

function Card({
  href,
  image,
  title,
  subtitle,
  badge,
  meta,
  focusKey,
}: {
  href: string;
  image?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  meta?: string;
  focusKey?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      data-tv-focus-key={focusKey || href}
      className={[
        "group block overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] p-1.5 transition duration-100 hover:border-yellow-300/70 hover:bg-white/[0.07]",
        TV_FOCUS_CLASS,
      ].join(" ")}
    >
      <div className="relative overflow-hidden rounded-lg bg-white/5">
        <img
          src={getImageUrl(image)}
          alt={title}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className="aspect-[2/3] w-full object-cover transition duration-150 group-hover:scale-[1.03] group-focus-visible:scale-[1.03]"
        />
        {badge && <span className="absolute left-1 top-1 max-w-[86%] truncate rounded-md bg-yellow-300 px-1.5 py-0.5 text-[9px] font-black text-black shadow">{badge}</span>}
      </div>

      <div className="mt-1.5 min-h-[46px] px-0.5">
        <h3 className="line-clamp-2 text-[11px] font-black leading-tight text-white min-[1280px]:text-[12px]">{title}</h3>
        {subtitle && <p className="mt-0.5 line-clamp-1 text-[10px] font-bold text-yellow-300">{subtitle}</p>}
        {meta && <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">{meta}</p>}
      </div>
    </Link>
  );
}

function SectionTitle({ title, desc, href }: { title: string; desc?: string; href?: string }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-black min-[1280px]:text-xl">{title}</h2>
        {desc && <p className="mt-0.5 text-[11px] text-slate-400">{desc}</p>}
      </div>

      {href && (
        <Link
          href={href}
          prefetch={false}
          data-tv-focus-key={`section-more:${href}`}
          className={["rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black text-slate-200 hover:bg-white/10", TV_FOCUS_CLASS].join(" ")}
        >
          Xem thêm
        </Link>
      )}
    </div>
  );
}

function ContinueStrip({ item }: { item: WatchHistoryItem }) {
  return (
    <Link
      href={getHistoryHref(item)}
      prefetch={false}
      data-tv-focus-key={`continue-main:${item.slug}`}
      className={["group block rounded-2xl border border-yellow-300/30 bg-yellow-300/[0.09] p-3 transition duration-100 hover:border-yellow-300 hover:bg-yellow-300/[0.14]", TV_FOCUS_CLASS].join(" ")}
    >
      <div className="grid gap-3 md:grid-cols-[96px_1fr_auto] md:items-center min-[1280px]:grid-cols-[110px_1fr_auto]">
        <div className="w-24 overflow-hidden rounded-xl bg-white/5 md:w-auto">
          <img src={getImageUrl(item.poster_url || item.thumb_url)} alt={item.name} loading="lazy" decoding="async" className="aspect-[2/3] w-full object-cover" />
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300">Tiếp tục xem</p>
          <h1 className="mt-1 line-clamp-2 text-xl font-black leading-tight min-[1280px]:text-2xl">{item.name}</h1>
          <p className="mt-1 line-clamp-1 text-xs font-bold text-slate-300">
            {item.episodeName || "Tập đang xem"} • {item.isCustom ? item.seasonName || "Phim riêng" : item.serverName || "Nguồn phát"}
          </p>
        </div>

        <span className="hidden rounded-xl bg-yellow-300 px-4 py-2 text-sm font-black text-black md:inline-flex">▶ Xem tiếp</span>
      </div>
    </Link>
  );
}

export default function TvDashboard({ chineseSeries = [] }: TvDashboardProps) {
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [customMovies, setCustomMovies] = useState<StoredCustomMovie[]>([]);
  const [cached, setCached] = useState<MovieItem[]>([]);

  useEffect(() => {
    function refresh() {
      setHistory(readWatchHistory());
      setFavorites(readFavorites());
      setCustomMovies(readCustomMovies());
      setCached(readCache());
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (chineseSeries.length) {
      writeCache(chineseSeries);
      setCached(chineseSeries);
    }
  }, [chineseSeries]);

  const first = history[0];
  const other = history.slice(1, 7);
  const homeChinese = chineseSeries.length ? chineseSeries : cached;

  const actions = useMemo(
    () => [
      {
        href: first ? getHistoryHref(first) : QUICK_FILTER_HREF,
        label: first ? "Xem tiếp" : "Mở phim nhanh",
        desc: first ? first.name : "Trung + Lồng tiếng + Cổ trang",
        hot: true,
        focusKey: first ? "top:continue" : "top:quick-filter",
      },
      { href: QUICK_FILTER_HREF, label: "Gu đang lọc", desc: "Trung Quốc • Lồng tiếng • Cổ trang", focusKey: "top:filter-china" },
      { href: "/loc", label: "Bộ lọc", desc: "Quốc gia, thể loại, năm", focusKey: "top:filter" },
      { href: "/ca-nhan", label: "Phim riêng", desc: "Kho tự thêm", focusKey: "top:personal" },
      { href: "/lich-su", label: "Lịch sử", desc: "Các phim đã xem", focusKey: "top:history" },
      { href: "/yeu-thich", label: "Yêu thích", desc: "Phim đã lưu", focusKey: "top:favorites" },
    ],
    [first]
  );

  return (
    <div className="flex gap-4" data-tv-scope="tv-home-v4" data-tv-lock="true">
      <Rail />

      <main className="baoflix-tv-page min-w-0 flex-1 space-y-5">
        <section data-tv-section="top-actions" className="rounded-2xl border border-white/10 bg-gradient-to-br from-red-600/14 via-white/[0.03] to-yellow-300/10 p-3 min-[1280px]:p-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300">BảoFlix TV</p>
              <h1 className="mt-1 text-2xl font-black leading-tight min-[1280px]:text-3xl">Chọn nhanh rồi xem</h1>
            </div>

            <Link href="/" prefetch={false} data-tv-skip tabIndex={-1} className={["rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px] font-black text-slate-200 hover:bg-white/10", TV_FOCUS_CLASS].join(" ")}>
              Trang thường
            </Link>
          </div>

          <div data-tv-row data-tv-row-key="tv-home:top-actions" data-tv-row-wrap="true" data-tv-focus-out-left="rail" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {actions.map((action, index) => (
              <Tile key={action.focusKey} {...action} tvDefault={index === 0} />
            ))}
          </div>
        </section>

        <div id="tv-search">
          <TvSearchBox />
        </div>

        {first && (
          <section data-tv-section="continue">
            <SectionTitle title="Đang xem dở" desc="Ô đầu là phim gần nhất." href="/lich-su" />
            <ContinueStrip item={first} />

            {other.length > 0 && (
              <div data-tv-row data-tv-row-key="tv-home:continue-grid" data-tv-row-wrap="true" data-tv-focus-out-left="rail" className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
                {other.map((item) => (
                  <Card
                    key={`${item.isCustom ? "custom" : "normal"}-${item.slug}`}
                    href={getHistoryHref(item)}
                    focusKey={`continue:${item.slug}`}
                    image={item.poster_url || item.thumb_url}
                    title={item.name}
                    subtitle={item.episodeName || item.origin_name}
                    meta={item.isCustom ? item.seasonName || "Phim riêng" : item.serverName || item.lang}
                    badge="Xem tiếp"
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {homeChinese.length > 0 && (
          <section data-tv-section="china-series">
            <SectionTitle title="Phim bộ Trung Quốc" desc={chineseSeries.length ? "Hàng chính cho TV." : "Đang dùng cache TV gần nhất."} href="/loc?type=phim-bo&country=trung-quoc" />

            <div data-tv-row data-tv-row-key="tv-home:china-series" data-tv-row-wrap="true" data-tv-focus-out-left="rail" className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
              {homeChinese.slice(0, 16).map((movie) => (
                <Card
                  key={movie.slug}
                  href={`/phim/${movie.slug}`}
                  focusKey={`china:${movie.slug}`}
                  image={movie.poster_url || movie.thumb_url}
                  title={movie.name}
                  subtitle={movie.origin_name}
                  meta={getMeta(movie)}
                  badge={movie.episode_current || "Phim bộ"}
                />
              ))}
            </div>
          </section>
        )}

        {customMovies.length > 0 && (
          <section data-tv-section="custom">
            <SectionTitle title="Phim riêng" desc="Kho riêng gọn cho TV." href="/ca-nhan" />

            <div data-tv-row data-tv-row-key="tv-home:custom" data-tv-row-wrap="true" data-tv-focus-out-left="rail" className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
              {customMovies.slice(0, 8).map((item) => (
                <Card
                  key={item.movie.slug}
                  href={`/ca-nhan/${item.movie.slug}`}
                  focusKey={`custom:${item.movie.slug}`}
                  image={item.movie.poster_url || item.movie.thumb_url}
                  title={item.movie.name}
                  subtitle={item.movie.origin_name}
                  meta={getMeta(item.movie)}
                  badge="Riêng"
                />
              ))}
            </div>
          </section>
        )}

        {favorites.length > 0 && (
          <section data-tv-section="favorites">
            <SectionTitle title="Yêu thích" desc="Phim đã lưu." href="/yeu-thich" />

            <div data-tv-row data-tv-row-key="tv-home:favorites" data-tv-row-wrap="true" data-tv-focus-out-left="rail" className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
              {favorites.slice(0, 8).map((item) => (
                <Card
                  key={item.slug}
                  href={`/phim/${item.slug}`}
                  focusKey={`favorite:${item.slug}`}
                  image={item.poster_url || item.thumb_url}
                  title={item.name}
                  subtitle={item.origin_name}
                  meta={getMeta(item)}
                  badge="Đã lưu"
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
