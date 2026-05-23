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

const tvShortcuts = [
  {
    label: "Tìm kiếm",
    desc: "Tìm phim nhanh",
    href: "/tim-kiem",
  },
  {
    label: "Bộ lọc",
    desc: "Lọc theo quốc gia/ngôn ngữ",
    href: "/loc",
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
    label: "Phim bộ Trung",
    desc: "Series Trung Quốc",
    href: "/loc?type=phim-bo&country=trung-quoc",
  },
  {
    label: "Yêu thích",
    desc: "Danh sách đã lưu",
    href: "/yeu-thich",
  },
  {
    label: "Lịch sử",
    desc: "Các phim đang xem",
    href: "/lich-su",
  },
  {
    label: "Phim riêng",
    desc: "Phim tự thêm",
    href: "/ca-nhan",
  },
];

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
  large,
}: {
  href: string;
  image?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  meta?: string;
  large?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "group block overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-3 transition duration-200 hover:-translate-y-1 hover:border-red-500/70 hover:bg-white/[0.08] focus-visible:-translate-y-1 focus-visible:scale-[1.03] focus-visible:border-yellow-300 focus-visible:bg-white/[0.08] md:p-4",
        large ? "md:p-4" : "",
      ].join(" ")}
    >
      <div className="relative overflow-hidden rounded-2xl bg-white/5">
        <img
          src={getImageUrl(image)}
          alt={title}
          className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-105 group-focus-visible:scale-105"
        />

        {badge && (
          <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-black text-white shadow-lg">
            {badge}
          </span>
        )}
      </div>

      <div className="mt-3">
        <h3
          className={[
            "line-clamp-2 font-black leading-tight text-white",
            large ? "text-base md:text-lg" : "text-sm md:text-base",
          ].join(" ")}
        >
          {title}
        </h3>

        {subtitle && (
          <p className="mt-1 line-clamp-1 text-xs font-bold text-yellow-300 md:text-sm">
            {subtitle}
          </p>
        )}

        {meta && (
          <p className="mt-1 line-clamp-1 text-xs text-slate-400">{meta}</p>
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
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-black md:text-3xl">{title}</h2>

        {desc && <p className="mt-1 text-sm text-slate-400">{desc}</p>}
      </div>

      {href && (
        <Link
          href={href}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black hover:bg-white/10"
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
}: {
  label: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-yellow-300/60 hover:bg-white/[0.08] focus-visible:border-yellow-300 focus-visible:bg-white/[0.08]"
    >
      <h3 className="text-lg font-black md:text-xl">{label}</h3>

      <p className="mt-2 text-sm text-slate-400">{desc}</p>
    </Link>
  );
}

function ContinueHero({ item }: { item: WatchHistoryItem }) {
  return (
    <Link
      href={getHistoryHref(item)}
      className="group block rounded-[2rem] border border-yellow-300/20 bg-yellow-300/10 p-4 transition hover:border-yellow-300/60 hover:bg-yellow-300/15 focus-visible:border-yellow-300"
    >
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <div className="overflow-hidden rounded-3xl bg-white/5">
          <img
            src={getImageUrl(item.poster_url || item.thumb_url)}
            alt={item.name}
            className="aspect-[2/3] w-full object-cover transition group-hover:scale-105"
          />
        </div>

        <div className="flex min-w-0 flex-col justify-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-300">
            Xem tiếp
          </p>

          <h2 className="mt-3 line-clamp-2 text-2xl font-black md:text-4xl">
            {item.name}
          </h2>

          {item.origin_name && (
            <p className="mt-2 line-clamp-1 text-sm font-bold text-slate-400">
              {item.origin_name}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-red-600 px-3 py-1 font-black text-white">
              {item.episodeName || "Tập đang xem"}
            </span>

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-bold text-slate-200">
              {item.isCustom
                ? item.seasonName || "Phim riêng"
                : item.serverName || "Nguồn phát"}
            </span>

            {item.quality && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-bold text-slate-200">
                {item.quality}
              </span>
            )}
          </div>

          <div className="mt-5">
            <span className="inline-flex rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black">
              ▶ Vào xem tiếp
            </span>
          </div>
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
    <div className="baoflix-tv-page space-y-10">
      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-red-600/20 via-white/[0.04] to-yellow-300/10 p-5 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <p className="mb-3 text-sm font-black uppercase tracking-[0.3em] text-red-300">
              BảoFlix TV
            </p>

            <h1 className="text-4xl font-black md:text-6xl">
              Vào là xem, ít thao tác hơn
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              TV Mode gom Xem tiếp, tìm kiếm, phim riêng, yêu thích và các lối
              tắt hay dùng vào một màn hình lớn.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {firstContinue ? (
                <Link
                  href={getHistoryHref(firstContinue)}
                  className="rounded-2xl bg-yellow-300 px-6 py-4 text-base font-black text-black hover:bg-yellow-200"
                >
                  ▶ Xem tiếp
                </Link>
              ) : (
                <Link
                  href="/tim-kiem"
                  className="rounded-2xl bg-yellow-300 px-6 py-4 text-base font-black text-black hover:bg-yellow-200"
                >
                  🔎 Tìm phim
                </Link>
              )}

              <Link
                href="/loc?type=phim-bo&country=trung-quoc"
                className="rounded-2xl bg-red-600 px-6 py-4 text-base font-black text-white hover:bg-red-500"
              >
                Phim bộ Trung
              </Link>

              <Link
                href="/"
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-base font-black hover:bg-white/10"
              >
                Trang chủ thường
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            {firstContinue ? (
              <Link href={getHistoryHref(firstContinue)} className="block">
                <div className="flex gap-4">
                  <div className="w-24 shrink-0 overflow-hidden rounded-2xl bg-white/5">
                    <img
                      src={getImageUrl(
                        firstContinue.poster_url || firstContinue.thumb_url
                      )}
                      alt={firstContinue.name}
                      className="aspect-[2/3] w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 py-1">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
                      Đang xem
                    </p>

                    <h2 className="mt-2 line-clamp-2 text-xl font-black">
                      {firstContinue.name}
                    </h2>

                    <p className="mt-2 text-sm text-slate-400">
                      {firstContinue.isCustom
                        ? firstContinue.seasonName || "Phim riêng"
                        : firstContinue.serverName || "Nguồn phát"}
                    </p>

                    <p className="mt-1 text-sm font-bold text-red-300">
                      {firstContinue.episodeName || "Tập đang xem"}
                    </p>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="p-3 text-slate-400">
                Chưa có lịch sử xem. Mở một phim rồi quay lại đây sẽ có nút xem
                tiếp.
              </div>
            )}
          </div>
        </div>
      </section>

      <TvSearchBox />

      {firstContinue && (
        <section>
          <SectionTitle
            title="Đang xem dở"
            desc="Ưu tiên phim gần nhất để mở lên là xem tiếp ngay."
            href="/lich-su"
          />

          <ContinueHero item={firstContinue} />

          {otherHistory.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {otherHistory.map((item) => (
                <TvMovieCard
                  key={`${item.isCustom ? "custom" : "normal"}-${item.slug}`}
                  href={getHistoryHref(item)}
                  image={item.poster_url || item.thumb_url}
                  title={item.name}
                  subtitle={item.episodeName || item.origin_name}
                  meta={
                    item.isCustom
                      ? item.seasonName || "Phim riêng"
                      : item.serverName || item.lang
                  }
                  badge="Xem tiếp"
                  large
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <SectionTitle
          title="Lối tắt TV"
          desc="Nút lớn, dễ bấm bằng remote hoặc trên iPhone."
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tvShortcuts.map((item) => (
            <ShortcutCard
              key={item.href}
              label={item.label}
              desc={item.desc}
              href={item.href}
            />
          ))}
        </div>
      </section>

      {chineseSeries.length > 0 && (
        <section>
          <SectionTitle
            title="Phim bộ Trung Quốc"
            desc="Ưu tiên hiện trên TV Mode theo gu mới."
            href="/loc?type=phim-bo&country=trung-quoc"
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {chineseSeries.slice(0, 14).map((movie) => (
              <TvMovieCard
                key={movie.slug}
                href={`/phim/${movie.slug}`}
                image={movie.poster_url || movie.thumb_url}
                title={movie.name}
                subtitle={movie.origin_name}
                meta={movie.lang || movie.quality}
                badge={movie.episode_current || "Phim bộ"}
                large
              />
            ))}
          </div>
        </section>
      )}

      {customMovies.length > 0 && (
        <section>
          <SectionTitle
            title="Phim riêng"
            desc="Các phim fen tự thêm bằng giao diện."
            href="/ca-nhan"
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {customMovies.slice(0, 7).map((item) => (
              <TvMovieCard
                key={item.movie.slug}
                href={`/ca-nhan/${item.movie.slug}`}
                image={item.movie.poster_url || item.movie.thumb_url}
                title={item.movie.name}
                subtitle={item.movie.origin_name}
                meta={item.movie.lang || item.movie.quality}
                badge="Riêng"
                large
              />
            ))}
          </div>
        </section>
      )}

      {favorites.length > 0 && (
        <section>
          <SectionTitle
            title="Yêu thích"
            desc="Các phim đã lưu."
            href="/yeu-thich"
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {favorites.slice(0, 7).map((item) => (
              <TvMovieCard
                key={item.slug}
                href={`/phim/${item.slug}`}
                image={item.poster_url || item.thumb_url}
                title={item.name}
                subtitle={item.origin_name}
                meta={item.lang || item.quality}
                badge="Đã lưu"
                large
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}