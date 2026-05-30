"use client";

import { useEffect, useMemo, useState } from "react";
import { Taxonomy } from "@/lib/kkphim";
import CompactMovieCard from "@/components/CompactMovieCard";
import {
  clearWatchHistory,
  readWatchHistory,
  removeWatchHistoryItem,
  type WatchHistoryItem,
} from "@/lib/watchStore";

type HistoryItem = WatchHistoryItem & {
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

function getHistoryHref(item: HistoryItem) {
  if (item.href) {
    return item.href;
  }

  if (item.isCustom) {
    return `/ca-nhan/${item.slug}/xem?season=${item.seasonIndex ?? 0}&tap=${
      item.episodeIndex ?? 0
    }`;
  }

  return `/xem/${item.slug}?server=${item.serverIndex ?? 0}&tap=${
    item.episodeIndex ?? 0
  }`;
}

function getSourceLabel(item: HistoryItem) {
  if (item.isCustom) {
    return item.seasonName || "Phim riêng";
  }

  return item.serverName || "Server";
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
    setItems(readWatchHistory());

    function refreshHistory() {
      setItems(readWatchHistory());
    }

    window.addEventListener("storage", refreshHistory);
    window.addEventListener("focus", refreshHistory);

    return () => {
      window.removeEventListener("storage", refreshHistory);
      window.removeEventListener("focus", refreshHistory);
    };
  }, []);

  const years = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => item.year).filter(Boolean))
    ).sort((a, b) => Number(b) - Number(a));
  }, [items]);

  const servers = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => getSourceLabel(item)).filter(Boolean))
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
      const sourceLabel = getSourceLabel(item);
      const text = normalize(
        `${item.name} ${item.origin_name} ${item.episodeName} ${sourceLabel}`
      );

      const matchKeyword = !q || text.includes(q);
      const matchType = type === "tat-ca" || item.type === type;
      const matchYear = year === "tat-ca" || String(item.year) === year;
      const matchServer = server === "tat-ca" || sourceLabel === server;

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
          new Date(a.watchedAt || 0).getTime() -
          new Date(b.watchedAt || 0).getTime()
      );
    }

    if (sort === "az") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    if (sort === "latest") {
      result = [...result].sort(
        (a, b) =>
          new Date(b.watchedAt || 0).getTime() -
          new Date(a.watchedAt || 0).getTime()
      );
    }

    return result;
  }, [items, keyword, type, lang, server, country, year, sort]);

  function clearHistory() {
    clearWatchHistory();
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

  function removeHistoryMovie(item: HistoryItem) {
    const next = removeWatchHistoryItem({
      slug: item.slug,
      isCustom: item.isCustom,
    });

    setItems(next);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Lịch sử xem</h1>

          <p className="mt-1 text-slate-400">
            Lọc nhanh các phim fen đã xem gần đây. Cùng slug sẽ được gộp thành một lịch sử.
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
            <option value="tat-ca">Tất cả nguồn</option>
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
            <CompactMovieCard
              key={item.slug}
              href={getHistoryHref(item)}
              title={item.name}
              originName={item.origin_name}
              image={item.poster_url || item.thumb_url}
              topBadge={item.quality}
              topBadgeTone="dark"
              rightBadge={item.isCustom ? "Riêng" : undefined}
              bottomPrimary={`Xem tiếp: ${item.episodeName || "Tập đang xem"}`}
              bottomSecondary={getSourceLabel(item)}
              meta={[
                item.year,
                item.lang,
                item.watchedAt && formatWatchedTime(item.watchedAt),
              ]}
              onRemove={() => removeHistoryMovie(item)}
              removeLabel="Xóa"
              removeAriaLabel={`Xóa ${item.name} khỏi lịch sử`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
