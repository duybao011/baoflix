"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getImageUrl, MovieItem, Taxonomy } from "@/lib/kkphim";

const KEY = "baoflix_favorites";

type SavedMovie = MovieItem & {
  type?: string;
  category?: Taxonomy[];
  country?: Taxonomy[];
};

const langOptions = [
  { label: "Tất cả ngôn ngữ", value: "tat-ca" },
  { label: "Vietsub", value: "vietsub" },
  { label: "Thuyết minh", value: "thuyet-minh" },
  { label: "Lồng tiếng", value: "long-tieng" },
];

const typeOptions = [
  { label: "Tất cả loại phim", value: "tat-ca" },
  { label: "Phim bộ", value: "series" },
  { label: "Phim lẻ", value: "single" },
  { label: "TV Shows", value: "tvshows" },
  { label: "Hoạt hình", value: "hoathinh" },
];

const sortOptions = [
  { label: "Mới lưu trước", value: "latest" },
  { label: "Tên A-Z", value: "az" },
  { label: "Năm mới nhất", value: "year-desc" },
  { label: "Năm cũ nhất", value: "year-asc" },
];

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

function matchLang(movieLang: string | undefined, selected: string) {
  if (selected === "tat-ca") return true;

  const lang = normalize(movieLang);

  if (selected === "vietsub") return lang.includes("vietsub");
  if (selected === "thuyet-minh") return lang.includes("thuyet minh");
  if (selected === "long-tieng") return lang.includes("long tieng");

  return true;
}

function SelectBox({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-sm text-white outline-none"
    >
      {children}
    </select>
  );
}

function FavoriteCard({
  movie,
  onRemove,
}: {
  movie: SavedMovie;
  onRemove: () => void;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] transition hover:-translate-y-1 hover:bg-white/[0.075]">
      <Link href={`/phim/${movie.slug}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden bg-slate-900">
          <img
            src={getImageUrl(movie.poster_url || movie.thumb_url)}
            alt={movie.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-2 pt-12">
            {movie.episode_current && (
              <p className="line-clamp-1 text-[11px] font-black text-red-300">
                {movie.episode_current}
              </p>
            )}

            {movie.lang && (
              <p className="mt-0.5 line-clamp-1 text-[10px] font-bold text-yellow-300">
                {movie.lang}
              </p>
            )}
          </div>

          {movie.quality && (
            <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">
              {movie.quality}
            </span>
          )}
        </div>

        <div className="space-y-1 p-3">
          <h2 className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-5 text-white">
            {movie.name}
          </h2>

          {movie.origin_name && (
            <p className="line-clamp-1 text-xs text-slate-400">
              {movie.origin_name}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
            {movie.year && <span>{movie.year}</span>}
            {movie.lang && <span>• {movie.lang}</span>}
            {movie.quality && <span>• {movie.quality}</span>}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/75 px-2.5 py-1 text-[11px] font-black text-white opacity-90 backdrop-blur hover:bg-red-600"
        aria-label={`Xóa ${movie.name} khỏi yêu thích`}
      >
        Xóa
      </button>
    </article>
  );
}

export default function FavoritesPage() {
  const [movies, setMovies] = useState<SavedMovie[]>([]);
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState("tat-ca");
  const [lang, setLang] = useState("tat-ca");
  const [year, setYear] = useState("tat-ca");
  const [country, setCountry] = useState("tat-ca");
  const [category, setCategory] = useState("tat-ca");
  const [sort, setSort] = useState("latest");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setMovies(raw ? JSON.parse(raw) : []);
    } catch {
      setMovies([]);
    }
  }, []);

  const years = useMemo(() => {
    return Array.from(
      new Set(movies.map((movie) => movie.year).filter(Boolean))
    ).sort((a, b) => Number(b) - Number(a));
  }, [movies]);

  const countries = useMemo(() => {
    const map = new Map<string, string>();

    movies.forEach((movie) => {
      movie.country?.forEach((item) => {
        map.set(item.slug, item.name);
      });
    });

    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [movies]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();

    movies.forEach((movie) => {
      movie.category?.forEach((item) => {
        map.set(item.slug, item.name);
      });
    });

    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [movies]);

  const filteredMovies = useMemo(() => {
    const q = normalize(keyword);

    let result = movies.filter((movie) => {
      const text = normalize(`${movie.name} ${movie.origin_name}`);

      const matchKeyword = !q || text.includes(q);
      const matchType = type === "tat-ca" || movie.type === type;
      const matchYear = year === "tat-ca" || String(movie.year) === year;
      const matchCountry =
        country === "tat-ca" ||
        movie.country?.some((item) => item.slug === country);
      const matchCategory =
        category === "tat-ca" ||
        movie.category?.some((item) => item.slug === category);
      const matchLanguage = matchLang(movie.lang, lang);

      return (
        matchKeyword &&
        matchType &&
        matchYear &&
        matchCountry &&
        matchCategory &&
        matchLanguage
      );
    });

    if (sort === "az") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    if (sort === "year-desc") {
      result = [...result].sort(
        (a, b) => Number(b.year || 0) - Number(a.year || 0)
      );
    }

    if (sort === "year-asc") {
      result = [...result].sort(
        (a, b) => Number(a.year || 0) - Number(b.year || 0)
      );
    }

    return result;
  }, [movies, keyword, type, lang, year, country, category, sort]);

  function clearFilters() {
    setKeyword("");
    setType("tat-ca");
    setLang("tat-ca");
    setYear("tat-ca");
    setCountry("tat-ca");
    setCategory("tat-ca");
    setSort("latest");
  }

  function removeFavorite(slug: string) {
    const next = movies.filter((movie) => movie.slug !== slug);

    setMovies(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  return (
    <div>
      <h1 className="mb-2 text-3xl font-black">Phim yêu thích</h1>

      <p className="mb-6 text-slate-400">
        Lọc nhanh trong danh sách phim fen đã lưu.
      </p>

      <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm trong yêu thích..."
            className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-sm text-white outline-none"
          />

          <SelectBox value={type} onChange={setType}>
            {typeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectBox>

          <SelectBox value={lang} onChange={setLang}>
            {langOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectBox>

          <SelectBox value={year} onChange={setYear}>
            <option value="tat-ca">Tất cả năm</option>
            {years.map((item) => (
              <option key={item} value={String(item)}>
                {item}
              </option>
            ))}
          </SelectBox>

          <SelectBox value={country} onChange={setCountry}>
            <option value="tat-ca">Tất cả quốc gia</option>
            {countries.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </SelectBox>

          <SelectBox value={category} onChange={setCategory}>
            <option value="tat-ca">Tất cả thể loại</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </SelectBox>

          <SelectBox value={sort} onChange={setSort}>
            {sortOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectBox>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold hover:bg-white/10"
          >
            Xóa lọc
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-400">
          Đang hiện {filteredMovies.length}/{movies.length} phim.
        </p>
      </section>

      {filteredMovies.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-400">
          Không có phim phù hợp.
        </div>
      ) : (
        <div
          data-tv-row
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
        >
          {filteredMovies.map((movie, index) => (
            <FavoriteCard
              key={`${movie._id || movie.slug || movie.name}-${index}`}
              movie={movie}
              onRemove={() => removeFavorite(movie.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}