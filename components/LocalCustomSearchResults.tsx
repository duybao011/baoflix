"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CUSTOM_MOVIES_CHANGE_EVENT,
  readCustomMovies,
  type StoredCustomMovie,
} from "@/lib/customMoviesClient";
import { getImageUrl } from "@/lib/kkphim";

function normalize(text?: string | number) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type LocalCustomSearchResultsProps = {
  q: string;
  country?: string;
  year?: string;
};

export default function LocalCustomSearchResults({
  q,
  country = "tat-ca",
  year = "tat-ca",
}: LocalCustomSearchResultsProps) {
  const [movies, setMovies] = useState<StoredCustomMovie[]>([]);

  useEffect(() => {
    setMovies(readCustomMovies());

    function refresh() {
      setMovies(readCustomMovies());
    }

    window.addEventListener(CUSTOM_MOVIES_CHANGE_EVENT, refresh);
    window.addEventListener("baoflix-custom-movies-synced", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener(CUSTOM_MOVIES_CHANGE_EVENT, refresh);
      window.removeEventListener("baoflix-custom-movies-synced", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const results = useMemo(() => {
    const keyword = normalize(q);

    if (!keyword) return [];

    return movies.filter((item) => {
      const movie = item.movie;
      const text = normalize(
        [
          movie.name,
          movie.origin_name,
          Array.isArray(movie.actor) ? movie.actor.join(" ") : movie.actor,
          movie.category?.map((cat) => cat.name).join(" "),
          movie.country?.map((ct) => ct.name).join(" "),
        ].join(" ")
      );

      const matchKeyword = text.includes(keyword);
      const matchCountry =
        country === "tat-ca" ||
        movie.country?.some((item) => item.slug === country);
      const matchYear = year === "tat-ca" || String(movie.year || "") === year;

      return matchKeyword && matchCountry && matchYear;
    });
  }, [country, movies, q, year]);

  if (!results.length) return null;

  return (
    <section className="mb-8 rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-5">
      <div className="mb-5">
        <h2 className="text-2xl font-black text-yellow-100">
          Phim riêng khớp tìm kiếm
        </h2>

        <p className="mt-1 text-sm text-yellow-100/70">
          Kết quả lấy từ thư viện phim riêng lưu trên trình duyệt này.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {results.map((item) => (
          <Link
            key={item.movie.slug}
            href={`/ca-nhan/${item.movie.slug}`}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-black/30 transition hover:-translate-y-1 hover:bg-white/10"
          >
            <div className="relative aspect-[2/3] overflow-hidden bg-slate-900">
              <img
                src={getImageUrl(item.movie.poster_url || item.movie.thumb_url)}
                alt={item.movie.name}
                className="h-full w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />

              <span className="absolute left-2 top-2 rounded-full bg-yellow-300 px-2 py-1 text-[10px] font-black text-black">
                RIÊNG
              </span>

              {item.movie.episode_current && (
                <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-xs font-bold text-white">
                  {item.movie.episode_current}
                </span>
              )}
            </div>

            <div className="p-3">
              <h3 className="line-clamp-2 text-sm font-bold text-white">
                {item.movie.name}
              </h3>

              <p className="mt-1 line-clamp-1 text-xs text-yellow-100/70">
                {item.movie.origin_name}
              </p>

              <p className="mt-2 text-xs text-yellow-100/50">
                {item.movie.year || "N/A"} · {item.movie.lang || "Phim riêng"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
