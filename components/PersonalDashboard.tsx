"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  readWatchHistory,
  removeWatchHistoryItem,
  clearWatchHistory,
} from "@/lib/watchStore";

const HISTORY_KEY = "baoflix_history";
const FAVORITE_KEY = "baoflix_favorites";
const WATCHED_KEY = "baoflix_watched_episodes";
const SEARCH_HISTORY_KEY = "baoflix_search_history";

type Taxonomy = {
  name: string;
  slug: string;
};

type DashboardMovie = {
  slug: string;
  name: string;
  origin_name?: string;
  year?: number;
  lang?: string;
  quality?: string;
  episodeName?: string;
  episodeIndex?: number;
  serverIndex?: number;
  serverName?: string;
  watchedAt?: string;
  country?: Taxonomy[];
  category?: Taxonomy[];
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function countTaxonomy(items: DashboardMovie[], key: "country" | "category") {
  const map = new Map<string, number>();

  items.forEach((item) => {
    item[key]?.forEach((tax) => {
      map.set(tax.name, (map.get(tax.name) || 0) + 1);
    });
  });

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function countLang(items: DashboardMovie[]) {
  const map = new Map<string, number>();

  items.forEach((item) => {
    if (!item.lang) return;
    map.set(item.lang, (map.get(item.lang) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const content = (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 hover:bg-white/[0.07]">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );

  if (!href) return content;

  return <Link href={href}>{content}</Link>;
}

export default function PersonalDashboard() {
  const [history, setHistory] = useState<DashboardMovie[]>([]);
  const [favorites, setFavorites] = useState<DashboardMovie[]>([]);
  const [watched, setWatched] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory(readJson<DashboardMovie[]>(HISTORY_KEY, []));
    setFavorites(readJson<DashboardMovie[]>(FAVORITE_KEY, []));
    setWatched(readJson<string[]>(WATCHED_KEY, []));
    setSearchHistory(readJson<string[]>(SEARCH_HISTORY_KEY, []));
  }, []);

  const combinedMovies = useMemo(() => {
    const map = new Map<string, DashboardMovie>();

    [...history, ...favorites].forEach((movie) => {
      if (!movie?.slug) return;
      if (!map.has(movie.slug)) {
        map.set(movie.slug, movie);
      }
    });

    return Array.from(map.values());
  }, [history, favorites]);

  const topCountries = useMemo(
    () => countTaxonomy(combinedMovies, "country"),
    [combinedMovies]
  );

  const topCategories = useMemo(
    () => countTaxonomy(combinedMovies, "category"),
    [combinedMovies]
  );

  const topLangs = useMemo(() => countLang(combinedMovies), [combinedMovies]);

  const recentWatching = history.slice(0, 4);

  return (
    <section className="py-8">
      <div className="mb-5">
        <h2 className="text-2xl font-black">Dashboard cá nhân</h2>
        <p className="mt-1 text-sm text-slate-400">
          Tóm tắt gu xem phim và dữ liệu riêng trên thiết bị này.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Phim đang/lần gần đây xem" value={history.length} href="/lich-su" />
        <StatCard label="Phim yêu thích" value={favorites.length} href="/yeu-thich" />
        <StatCard label="Tập đã mở" value={watched.length} />
        <StatCard label="Từ khóa đã tìm" value={searchHistory.length} href="/tim-kiem" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-black">Top quốc gia</h3>

          {topCountries.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              Chưa đủ dữ liệu. Xem/lưu thêm vài phim để hiện thống kê.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {topCountries.map((item) => (
                <div key={item.name} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-yellow-300">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-black">Top thể loại</h3>

          {topCategories.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              Chưa đủ dữ liệu thể loại.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {topCategories.map((item) => (
                <div key={item.name} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-yellow-300">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-black">Ngôn ngữ hay xem</h3>

          {topLangs.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              Chưa đủ dữ liệu ngôn ngữ.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {topLangs.map((item) => (
                <div key={item.name} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-yellow-300">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {recentWatching.length > 0 && (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="font-black">Vừa xem gần đây</h3>

            <Link
              href="/lich-su"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
            >
              Xem tất cả
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {recentWatching.map((item) => (
              <Link
                key={`${item.slug}-${item.serverIndex ?? 0}-${item.episodeIndex ?? 0}`}
                href={`/xem/${item.slug}?server=${item.serverIndex ?? 0}&tap=${item.episodeIndex ?? 0}`}
                className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/10"
              >
                <h4 className="line-clamp-1 font-bold">{item.name}</h4>

                <p className="mt-1 text-sm text-red-300">
                  {item.episodeName || "Xem tiếp"}
                </p>

                {item.serverName && (
                  <p className="mt-1 text-xs text-yellow-300">
                    {item.serverName}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}