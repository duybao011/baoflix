"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getImageUrl, Taxonomy } from "@/lib/kkphim";

const KEY = "baoflix_history";

type HistoryItem = {
  slug: string;
  name: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  lang?: string;
  quality?: string;
  type?: string;
  category?: Taxonomy[];
  country?: Taxonomy[];
  episodeName: string;
  episodeIndex: number;
  serverIndex?: number;
  serverName?: string;
  watchedAt: string;
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

function formatWatchedTime(value?: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
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

function HistoryCard({
  item,
  onRemove,
}: {
  item: HistoryItem;
  onRemove: () => void;
}) {
  const watchHref = `/xem/${item.slug}?server=${item.serverIndex ?? 0}&tap=${
    item.episodeIndex
  }`;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] transition hover:-translate-y-1 hover:bg-white/[0.075]">
      <Link href={watchHref} className="block">
        <div className="relative aspect-[2/3] overflow-hidden bg-slate-900">
          <img
            src={getImageUrl(item.poster_url || item.thumb_url)}
            alt={item.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-2 pt-12">
            <p className="line-clamp-1 text-[11px] font-black text-red-300">
              Xem tiếp: {item.episodeName}
            </p>

            {item.serverName && (
              <p className="mt-0.5 line-clamp-1 text-[10px] font-bold text-yellow-300">
                {item.serverName}
              </p>
            )}
          </div>

          {item.quality && (
            <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-black text-white">
              {item.quality}
            </span>
          )}
        </div>

        <div className="space-y-1 p-3">
          <h2 className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-5 text-white">
            {item.name}
          </h2>

          {item.origin_name && (
            <p className="line-clamp-1 text-xs text-slate-400">
              {item.origin_name}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
            {item.year && <span>{item.year}</span>}
            {item.lang && <span>• {item.lang}</span>}
            {item.watchedAt && <span>• {formatWatchedTime(item.watchedAt)}</span>}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/75 px-2.5 py-1 text-[11px] font-black text-white opacity-90 backdrop-blur hover:bg-red-600"
        aria-label={`Xóa ${item.name} khỏi lịch sử`}
      >
        Xóa
      </button>
    </article>
  );
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState("tat-ca");
  const [lang, setLang] = useState("tat-ca");
  const [server, setServer] = useState("tat-ca");
  const [country, setCountry] = useState("tat-ca");
  const [year, setYear] = useState("tat-ca");
  const [sort, setSort] = useState("latest");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
  }, []);

  const years = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => item.year).filter(Boolean))
    ).sort((a, b) => Number(b) - Number(a));
  }, [items]);

  const servers = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => item.serverName).filter(Boolean))
    ) as string[];
  }, [items]);

  const countries = useMemo(() => {
    const map = new Map<string, string>();

    items.forEach((item) => {
      item.country?.forEach((countryItem) => {
        map.set(countryItem.slug, countryItem.name);
      });
    });

    return Array.from(map.entries()).map(([slug, name]) => ({
      slug,
      name,
    }));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = normalize(keyword);

    let result = items.filter((item) => {
      const text = normalize(
        `${item.name} ${item.origin_name} ${item.episodeName} ${item.serverName}`
      );

      const matchKeyword = !q || text.includes(q);
      const matchType = type === "tat-ca" || item.type === type;
      const matchYear = year === "tat-ca" || String(item.year) === year;
      const matchServer = server === "tat-ca" || item.serverName === server;

      const matchCountry =
        country === "tat-ca" ||
        item.country?.some((countryItem) => countryItem.slug === country);

      const matchLanguage = matchLang(item.lang, lang);

      return (
        matchKeyword &&
        matchType &&
        matchYear &&
        matchServer &&
        matchCountry &&
        matchLanguage
      );
    });

    if (sort === "oldest") {
      result = [...result].sort(
        (a, b) =>
          new Date(a.watchedAt).getTime() - new Date(b.watchedAt).getTime()
      );
    }

    if (sort === "az") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    if (sort === "latest") {
      result = [...result].sort(
        (a, b) =>
          new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
      );
    }

    return result;
  }, [items, keyword, type, lang, server, country, year, sort]);

  function clearHistory() {
    localStorage.removeItem(KEY);
    setItems([]);
  }

  function clearFilters() {
    setKeyword("");
    setType("tat-ca");
    setLang("tat-ca");
    setServer("tat-ca");
    setCountry("tat-ca");
    setYear("tat-ca");
    setSort("latest");
  }

  function removeHistoryItem(slug: string, serverIndex = 0, episodeIndex = 0) {
    const next = items.filter((item) => {
      const sameMovie = item.slug === slug;
      const sameServer = (item.serverIndex ?? 0) === serverIndex;
      const sameEpisode = item.episodeIndex === episodeIndex;

      return !(sameMovie && sameServer && sameEpisode);
    });

    setItems(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Lịch sử xem</h1>

          <p className="mt-1 text-slate-400">
            Lọc nhanh các phim fen đã xem gần đây.
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Xóa lịch sử
          </button>
        )}
      </div>

      <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm trong lịch sử..."
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

          <SelectBox value={server} onChange={setServer}>
            <option value="tat-ca">Tất cả server</option>
            {servers.map((item) => (
              <option key={item} value={item}>
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

          <SelectBox value={year} onChange={setYear}>
            <option value="tat-ca">Tất cả năm</option>
            {years.map((item) => (
              <option key={item} value={String(item)}>
                {item}
              </option>
            ))}
          </SelectBox>

          <SelectBox value={sort} onChange={setSort}>
            <option value="latest">Xem gần nhất</option>
            <option value="oldest">Xem cũ nhất</option>
            <option value="az">Tên A-Z</option>
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
          Đang hiện {filteredItems.length}/{items.length} mục lịch sử.
        </p>
      </section>

      {filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-400">
          Chưa có lịch sử phù hợp.
        </div>
      ) : (
        <div
          data-tv-row
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
        >
          {filteredItems.map((item) => (
            <HistoryCard
              key={`${item.slug}-${item.serverIndex ?? 0}-${item.episodeIndex}`}
              item={item}
              onRemove={() =>
                removeHistoryItem(
                  item.slug,
                  item.serverIndex ?? 0,
                  item.episodeIndex
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}