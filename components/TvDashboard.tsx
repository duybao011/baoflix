"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TvSearchBox from "@/components/TvSearchBox";
import { getImageUrl, type MovieItem } from "@/lib/kkphim";
import { readWatchHistory, type WatchHistoryItem } from "@/lib/watchStore";
import {
  readCustomMovies,
  type StoredCustomMovie,
} from "@/lib/customMoviesClient";

type FavoriteItem = {
  slug: string;
  name: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  lang?: string;
  quality?: string;
};

type TvDashboardProps = {
  chineseSeries?: MovieItem[];
};

const FAVORITES_KEY = "baoflix_favorites";
const TV_CARD_FOCUS_CLASS =
  "focus-visible:-translate-y-0.5 focus-visible:scale-[1.025] focus-visible:border-yellow-300 focus-visible:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const tvShortcuts = [
  {
    label: "Bộ lọc",
    desc: "Quốc gia, thể loại, ngôn ngữ",
    href: "/loc",
    hot: true,
  },
  {
    label: "Phim bộ Trung",
    desc: "Series Trung Quốc",
    href: "/loc?type=phim-bo&country=trung-quoc",
    hot: true,
  },
  {
    label: "Phim Hàn",
    desc: "Ưu tiên Hàn Quốc",
    href: "/loc?country=han-quoc",
  },
  {
    label: "Phim Nhật",
    desc: "Ưu tiên Nhật Bản",
    href: "/loc?country=nhat-ban",
  },
  {
    label: "Vietsub",
    desc: "Bản phụ đề",
    href: "/loc?sort_lang=vietsub",
  },
  {
    label: "Thuyết minh",
    desc: "Dễ xem trên TV",
    href: "/loc?sort_lang=thuyet-minh",
  },
  {
    label: "Yêu thích",
    desc: "Phim đã lưu",
    href: "/yeu-thich",
  },
  {
    label: "Lịch sử",
    desc: "Đang xem dở",
    href: "/lich-su",
  },
  {
    label: "Phim riêng",
    desc: "Phim tự thêm",
    href: "/ca-nhan",
  },
  {
    label: "Cài đặt",
    desc: "Reload, TV mode",
    href: "/cai-dat",
  },
];

function uniqueShortcutItems<T extends { href: string }>(items: T[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

function readFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const list = raw ? JSON.parse(raw) : [];

    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function getHistoryHref(item: WatchHistoryItem) {
  if (item.href) return item.href;

  if (item.isCustom) {
    return `/ca-nhan/${item.slug}/xem?season=${item.seasonIndex ?? 0}&tap=${
      item.episodeIndex ?? 0
    }`;
  }

  return `/xem/${item.slug}?server=${item.serverIndex ?? 0}&tap=${
    item.episodeIndex ?? 0
  }`;
}

function TvMovieCard({
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
  large?: boolean;
  focusKey?: string;
}) {
  return (
    <Link
      href={href}
      data-tv-focus-key={focusKey || href}
      className={[
        "group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-2 transition duration-200 hover:-translate-y-0.5 hover:border-red-500/70 hover:bg-white/[0.07]",
        TV_CARD_FOCUS_CLASS,
      ].join(" ")}
    >
      <div className="relative overflow-hidden rounded-xl bg-white/5">
        <img
          src={getImageUrl(image)}
          alt={title}
          className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-105 group-focus-visible:scale-105"
        />

        {badge && (
          <span className="absolute left-1.5 top-1.5 max-w-[82%] truncate rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white shadow-lg">
            {badge}
          </span>
        )}
      </div>

      <div className="mt-2 min-h-[52px]">
        <h3 className="line-clamp-2 text-[12px] font-black leading-tight text-white min-[1280px]:text-[13px]">
          {title}
        </h3>

        {subtitle && (
          <p className="mt-0.5 line-clamp-1 text-[10px] font-bold text-yellow-300 min-[1280px]:text-[11px]">
            {subtitle}
          </p>
        )}

        {meta && (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">{meta}</p>
        )}
      </div>
    </Link>
  );
}

function SectionTitle({
  title,
  desc,
  href,
}: {
  title: string;
  desc?: string;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-black min-[1280px]:text-2xl">{title}</h2>
        {desc && <p className="mt-0.5 text-xs text-slate-400">{desc}</p>}
      </div>

      {href && (
        <Link
          href={href}
          data-tv-focus-key={`section-more:${href}`}
          className={[
            "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black hover:bg-white/10",
            TV_CARD_FOCUS_CLASS,
          ].join(" ")}
        >
          Xem thêm
        </Link>
      )}
    </div>
  );
}

function ShortcutCard({
  label,
  desc,
  href,
  hot,
}: {
  label: string;
  desc: string;
  href: string;
  hot?: boolean;
}) {
  return (
    <Link
      href={href}
      data-tv-focus-key={`shortcut:${href}`}
      className={[
        "rounded-2xl border p-3 transition hover:border-yellow-300/60 hover:bg-white/[0.08]",
        hot ? "border-yellow-300/25 bg-yellow-300/[0.08]" : "border-white/10 bg-white/[0.035]",
        TV_CARD_FOCUS_CLASS,
      ].join(" ")}
    >
      <h3 className="text-sm font-black min-[1280px]:text-base">{label}</h3>
      <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">{desc}</p>
    </Link>
  );
}

function ContinueHero({ item }: { item: WatchHistoryItem }) {
  return (
    <Link
      href={getHistoryHref(item)}
      data-tv-focus-key={`continue:${item.slug}`}
      className={[
        "group block rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-3 transition hover:border-yellow-300/60 hover:bg-yellow-300/15",
        TV_CARD_FOCUS_CLASS,
      ].join(" ")}
    >
      <div className="grid gap-3 sm:grid-cols-[92px_1fr] min-[1280px]:grid-cols-[108px_1fr]">
        <div className="overflow-hidden rounded-xl bg-white/5">
          <img
            src={getImageUrl(item.poster_url || item.thumb_url)}
            alt={item.name}
            className="aspect-[2/3] w-full object-cover transition group-hover:scale-105"
          />
        </div>

        <div className="flex min-w-0 flex-col justify-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300">
            Xem tiếp
          </p>

          <h2 className="mt-2 line-clamp-2 text-lg font-black min-[1280px]:text-2xl">
            {item.name}
          </h2>

          {item.origin_name && (
            <p className="mt-1 line-clamp-1 text-xs font-bold text-slate-400">
              {item.origin_name}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-red-600 px-2.5 py-1 font-black text-white">
              {item.episodeName || "Tập đang xem"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-bold text-slate-200">
              {item.isCustom ? item.seasonName || "Phim riêng" : item.serverName || "Nguồn phát"}
            </span>
            {item.quality && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-bold text-slate-200">
                {item.quality}
              </span>
            )}
          </div>

          <span className="mt-3 inline-flex w-fit rounded-xl bg-yellow-300 px-4 py-2 text-xs font-black text-black">
            ▶ Vào xem tiếp
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function TvDashboard({ chineseSeries = [] }: TvDashboardProps) {
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [customMovies, setCustomMovies] = useState<StoredCustomMovie[]>([]);

  useEffect(() => {
    function refresh() {
      setHistory(readWatchHistory());
      setFavorites(readFavorites());
      setCustomMovies(readCustomMovies());
    }

    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const firstContinue = history[0];
  const otherHistory = history.slice(1, 7);

  return (
    <div className="baoflix-tv-page space-y-6">
      <section
        data-tv-section="hero"
        className="rounded-2xl border border-white/10 bg-gradient-to-br from-red-600/18 via-white/[0.035] to-yellow-300/10 p-4 min-[1280px]:p-5"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_280px] lg:items-center min-[1280px]:lg:grid-cols-[1fr_320px]">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-red-300">
              BảoFlix TV
            </p>

            <h1 className="text-3xl font-black leading-tight min-[1280px]:text-4xl">
              Mở TV là vào xem ngay
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Giao diện đã nén lại để thấy nhiều phim hơn, bấm ít hơn và đỡ bị chữ/poster chiếm màn hình.
            </p>

            <div data-tv-row data-tv-row-wrap="true" className="mt-4 flex flex-wrap gap-2">
              {firstContinue ? (
                <Link
                  href={getHistoryHref(firstContinue)}
                  data-tv-default
                  data-tv-focus-key="hero:continue"
                  className="rounded-xl bg-yellow-300 px-4 py-3 text-sm font-black text-black hover:bg-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  ▶ Xem tiếp
                </Link>
              ) : (
                <Link
                  href="/loc"
                  data-tv-default
                  data-tv-focus-key="hero:filter"
                  className="rounded-xl bg-yellow-300 px-4 py-3 text-sm font-black text-black hover:bg-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Lọc phim
                </Link>
              )}

              <Link
                href="/loc?type=phim-bo&country=trung-quoc"
                data-tv-focus-key="hero:china-series"
                className="rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Phim bộ Trung
              </Link>

              <Link
                href="/loc"
                data-tv-focus-key="hero:all-filter"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Bộ lọc
              </Link>

              <Link
                href="/"
                data-tv-focus-key="hero:normal-home"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Trang thường
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            {firstContinue ? (
              <Link
                href={getHistoryHref(firstContinue)}
                data-tv-focus-key="hero:continue-card"
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <div className="flex gap-3">
                  <div className="w-20 shrink-0 overflow-hidden rounded-xl bg-white/5 min-[1280px]:w-24">
                    <img
                      src={getImageUrl(firstContinue.poster_url || firstContinue.thumb_url)}
                      alt={firstContinue.name}
                      className="aspect-[2/3] w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 py-0.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-300">
                      Đang xem
                    </p>
                    <h2 className="mt-1.5 line-clamp-2 text-base font-black min-[1280px]:text-lg">
                      {firstContinue.name}
                    </h2>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-400">
                      {firstContinue.isCustom ? firstContinue.seasonName || "Phim riêng" : firstContinue.serverName || "Nguồn phát"}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs font-bold text-red-300">
                      {firstContinue.episodeName || "Tập đang xem"}
                    </p>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="p-2 text-sm text-slate-400">
                Chưa có lịch sử xem. Mở một phim rồi quay lại đây sẽ có nút xem tiếp.
              </div>
            )}
          </div>
        </div>
      </section>

      <TvSearchBox />

      {firstContinue && (
        <section data-tv-section="continue">
          <SectionTitle title="Đang xem dở" desc="Phim gần nhất để mở lên là xem tiếp ngay." href="/lich-su" />
          <ContinueHero item={firstContinue} />

          {otherHistory.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
              {otherHistory.map((item) => (
                <TvMovieCard
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

      <section data-tv-section="shortcuts">
        <SectionTitle title="Lối tắt TV" desc="Nút thường dùng, gọn hơn để remote đi nhanh." />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {uniqueShortcutItems(tvShortcuts).map((item) => (
            <ShortcutCard key={item.href} label={item.label} desc={item.desc} href={item.href} hot={item.hot} />
          ))}
        </div>
      </section>

      {chineseSeries.length > 0 && (
        <section data-tv-section="china-series">
          <SectionTitle
            title="Phim bộ Trung Quốc"
            desc="Ưu tiên hiện trên TV Mode theo gu mới."
            href="/loc?type=phim-bo&country=trung-quoc"
          />

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
            {chineseSeries.slice(0, 16).map((movie) => (
              <TvMovieCard
                key={movie.slug}
                href={`/phim/${movie.slug}`}
                focusKey={`china:${movie.slug}`}
                image={movie.poster_url || movie.thumb_url}
                title={movie.name}
                subtitle={movie.origin_name}
                meta={movie.lang || movie.quality}
                badge={movie.episode_current || "Phim bộ"}
              />
            ))}
          </div>
        </section>
      )}

      {customMovies.length > 0 && (
        <section data-tv-section="custom">
          <SectionTitle title="Phim riêng" desc="Các phim tự thêm bằng giao diện." href="/ca-nhan" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
            {customMovies.slice(0, 8).map((item) => (
              <TvMovieCard
                key={item.movie.slug}
                href={`/ca-nhan/${item.movie.slug}`}
                focusKey={`custom:${item.movie.slug}`}
                image={item.movie.poster_url || item.movie.thumb_url}
                title={item.movie.name}
                subtitle={item.movie.origin_name}
                meta={item.movie.lang || item.movie.quality}
                badge="Riêng"
              />
            ))}
          </div>
        </section>
      )}

      {favorites.length > 0 && (
        <section data-tv-section="favorites">
          <SectionTitle title="Yêu thích" desc="Các phim đã lưu." href="/yeu-thich" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
            {favorites.slice(0, 8).map((item) => (
              <TvMovieCard
                key={item.slug}
                href={`/phim/${item.slug}`}
                focusKey={`favorite:${item.slug}`}
                image={item.poster_url || item.thumb_url}
                title={item.name}
                subtitle={item.origin_name}
                meta={item.lang || item.quality}
                badge="Đã lưu"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
