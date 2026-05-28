"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getImageUrl, MovieItem, Taxonomy } from "@/lib/kkphim";
import CompactMovieCard from "@/components/CompactMovieCard";

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


export default function FavoritesPage() {
  const [movies, setMovies] = useState<SavedMovie[]>([]);
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState("tat-ca");
  const [lang, setLang] = useState("tat-ca");
  const [year, setYear] = useState("tat-ca");
  const [country, setCountry] = useState("tat-ca");
  const [category, setCategory] = useState("tat-ca");
  const [sort, setSort] = useState("latest");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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

  const hasActiveFilters =
    keyword.trim() ||
    type !== "tat-ca" ||
    lang !== "tat-ca" ||
    year !== "tat-ca" ||
    country !== "tat-ca" ||
    category !== "tat-ca" ||
    sort !== "latest";

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
        <div className="flex items-center justify-between gap-3 md:hidden">
          <div>
            <h2 className="text-lg font-black">Bộ lọc yêu thích</h2>

            <p className="mt-1 text-xs text-slate-400">
              Đang hiện {filteredMovies.length}/{movies.length} phim.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen((value) => !value)}
            className={[
              "rounded-2xl border px-4 py-2 text-sm font-black",
              hasActiveFilters
                ? "border-yellow-300 bg-yellow-300 text-black"
                : "border-white/10 bg-white/5 text-white",
            ].join(" ")}
          >
            {mobileFiltersOpen ? "Ẩn lọc" : "Hiện lọc"}
          </button>
        </div>

        <div
          className={[
            "mt-4 grid gap-3 md:mt-0 md:grid md:grid-cols-2 lg:grid-cols-4",
            mobileFiltersOpen ? "grid" : "hidden md:grid",
          ].join(" ")}
        >
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
            disabled={!hasActiveFilters}
            className={[
              "rounded-2xl border px-4 py-3 text-sm font-bold",
              hasActiveFilters
                ? "border-white/10 bg-white/5 hover:bg-white/10"
                : "cursor-not-allowed border-white/5 bg-white/[0.03] text-slate-500",
            ].join(" ")}
          >
            Xóa lọc
          </button>
        </div>

        <p className="mt-4 hidden text-sm text-slate-400 md:block">
          Đang hiện {filteredMovies.length}/{movies.length} phim.
        </p>

        {!mobileFiltersOpen && hasActiveFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-2 md:hidden">
            <span className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-black">
              Đang lọc
            </span>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white"
            >
              Xóa lọc nhanh
            </button>
          </div>
        )}
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
<CompactMovieCard
  key={`${movie._id || movie.slug || movie.name}-${index}`}
  href={`/phim/${movie.slug}`}
  title={movie.name}
  originName={movie.origin_name}
  image={movie.poster_url || movie.thumb_url}
  topBadge={movie.quality}
  topBadgeTone="red"
  bottomPrimary={movie.episode_current}
  bottomSecondary={movie.lang}
  meta={[movie.year, movie.lang, movie.quality]}
  onRemove={() => removeFavorite(movie.slug)}
  removeLabel="Xóa"
  removeAriaLabel={`Xóa ${movie.name} khỏi yêu thích`}
  confirmRemove
/>
          ))}
        </div>
      )}
    </div>
  );
}