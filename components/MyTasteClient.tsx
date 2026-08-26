"use client";

import { useEffect, useMemo, useState } from "react";
import MovieCard from "@/components/MovieCard";
import type { MovieItem } from "@/lib/kkphim";
import { FAVORITES_CHANGE_EVENT, readFavorites } from "@/lib/favoritesStore";
import { readWatchHistory, WATCH_STORE_CHANGE_EVENT } from "@/lib/watchStore";

type Taxonomy = {
  name: string;
  slug: string;
};

type LocalMovie = {
  slug: string;
  name: string;
  country?: Taxonomy[];
  category?: Taxonomy[];
};

function findTopTaxonomy(items: LocalMovie[], key: "country" | "category") {
  const map = new Map<string, { name: string; slug: string; count: number }>();

  items.forEach((item) => {
    item[key]?.forEach((tax) => {
      const current = map.get(tax.slug);

      map.set(tax.slug, {
        name: tax.name,
        slug: tax.slug,
        count: (current?.count || 0) + 1,
      });
    });
  });

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export default function MyTasteClient() {
  const [history, setHistory] = useState<LocalMovie[]>([]);
  const [favorites, setFavorites] = useState<LocalMovie[]>([]);
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function refresh() {
      setHistory(readWatchHistory());
      setFavorites(readFavorites());
    }

    refresh();
    window.addEventListener(WATCH_STORE_CHANGE_EVENT, refresh);
    window.addEventListener(FAVORITES_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener(WATCH_STORE_CHANGE_EVENT, refresh);
      window.removeEventListener(FAVORITES_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const combined = useMemo(() => {
    const map = new Map<string, LocalMovie>();

    [...history, ...favorites].forEach((movie) => {
      if (!movie?.slug) return;
      if (!map.has(movie.slug)) {
        map.set(movie.slug, movie);
      }
    });

    return Array.from(map.values());
  }, [history, favorites]);

  const topCountries = useMemo(() => findTopTaxonomy(combined, "country"), [combined]);
  const topCategories = useMemo(() => findTopTaxonomy(combined, "category"), [combined]);

  const topCountry = topCountries[0];
  const topCategory = topCategories[0];

  useEffect(() => {
    async function loadTasteMovies() {
      setLoading(true);

      const params = new URLSearchParams();

      if (topCountry?.slug) params.set("country", topCountry.slug);
      if (topCategory?.slug) params.set("category", topCategory.slug);

      if (!params.toString()) {
        setMovies([]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/my-taste?${params.toString()}`);
        const data = await res.json();
        setMovies(data.items || []);
      } catch {
        setMovies([]);
      } finally {
        setLoading(false);
      }
    }

    loadTasteMovies();
  }, [topCountry?.slug, topCategory?.slug]);

  return (
    <div>
      <h1 className="text-3xl font-black">Phim theo gu của tôi</h1>

      <p className="mt-2 text-slate-400">
        Gợi ý dựa trên lịch sử xem và phim yêu thích trên thiết bị này.
      </p>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-xl font-black">Quốc gia hay xem</h2>

          {topCountries.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              Chưa đủ dữ liệu. Hãy xem hoặc lưu thêm vài phim.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {topCountries.slice(0, 8).map((item) => (
                <span
                  key={item.slug}
                  className="rounded-full border border-yellow-300/20 bg-yellow-300/10 px-3 py-1 text-sm text-yellow-200"
                >
                  {item.name} ({item.count})
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-xl font-black">Thể loại hay xem</h2>

          {topCategories.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              Chưa đủ dữ liệu thể loại.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {topCategories.slice(0, 8).map((item) => (
                <span
                  key={item.slug}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm"
                >
                  {item.name} ({item.count})
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-5 text-2xl font-black">Gợi ý cho fen</h2>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-400">
            Đang tìm phim hợp gu...
          </div>
        ) : movies.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-400">
            Chưa đủ dữ liệu để gợi ý. Hãy xem/lưu thêm phim Hàn, Nhật hoặc phim fen thích.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {movies.map((movie, index) => (
              <MovieCard
                key={`${movie.slug}-${index}`}
                movie={movie}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}