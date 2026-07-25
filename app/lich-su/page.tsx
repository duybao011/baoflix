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

const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/90 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

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

function getSourceLabel(item: HistoryItem) {
  if (item.isCustom) return item.seasonName || "Phim riêng";
  return item.serverName || "Server";
}

function SelectBox({
  value,
  onChange,
  children,
  focusKey,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  focusKey: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      data-tv-focus-key={focusKey}
      data-tv-select-cycle="true"
      title="Trên TV: bấm OK để mở hoặc chuyển lựa chọn"
      className={[
        "h-9 rounded-lg border border-white/10 bg-[#10131d] px-2.5 text-[12px] font-bold text-white outline-none min-[1280px]:h-10",
        TV_FOCUS_CLASS,
      ].join(" ")}
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
    return Array.from(new Set(items.map((item) => item.year).filter(Boolean))).sort(
      (a, b) => Number(b) - Number(a)
    );
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

    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
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

  const activeFilterCount =
    (keyword.trim() ? 1 : 0) +
    (type !== "tat-ca" ? 1 : 0) +
    (lang !== "tat-ca" ? 1 : 0) +
    (server !== "tat-ca" ? 1 : 0) +
    (country !== "tat-ca" ? 1 : 0) +
    (year !== "tat-ca" ? 1 : 0) +
    (sort !== "latest" ? 1 : 0);

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
    <div
      data-tv-scope="history-page"
      data-tv-lock="true"
      data-tv-autofocus="true"
      className="baoflix-tv-page space-y-3"
    >
      <header className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.045] to-yellow-300/[0.06] p-3 min-[1280px]:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-yellow-300/90">
              TV History
            </p>
            <h1 className="mt-0.5 text-xl font-black leading-tight min-[1280px]:text-2xl">
              Lịch sử xem
            </h1>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">
              {filteredItems.length}/{items.length} mục
              {activeFilterCount ? ` • ${activeFilterCount} lọc đang bật` : ""}
            </p>
          </div>

          <div
            data-tv-row
            data-tv-row-key="history:top-actions"
            data-tv-page-top-actions
            data-tv-focus-out-down="selector:[data-tv-section='history-filters'] input, [data-tv-section='history-filters'] select, [data-tv-section='history-results'] a[href]"
            className="flex gap-2"
          >
            <button
              type="button"
              onClick={clearFilters}
              data-tv-focus-key="history:clear-filters-top"
              className={[
                "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black hover:bg-white/10",
                TV_FOCUS_CLASS,
              ].join(" ")}
            >
              Xóa lọc
            </button>

            {items.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                data-tv-focus-key="history:clear-history"
                className={[
                  "rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black hover:bg-red-600",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Xóa lịch sử
              </button>
            )}
          </div>
        </div>
      </header>

      <section
        data-tv-section="history-filters"
        data-tv-scroll-align="center"
        data-tv-focus-out-up="focus-key:history:clear-filters-top"
        data-tv-focus-out-down="selector:[data-tv-section='history-results'] a[href]"
        className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 min-[1280px]:p-3"
      >
        <div
          data-tv-row
          data-tv-row-key="history:filters"
          data-tv-row-wrap="true"
          className="grid gap-2 md:grid-cols-3 xl:grid-cols-7"
        >
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            data-tv-focus-key="history:keyword"
            placeholder="Tìm lịch sử..."
            className={[
              "h-9 rounded-lg border border-white/10 bg-[#10131d] px-2.5 text-[12px] font-bold text-white outline-none placeholder:text-slate-500 min-[1280px]:h-10",
              TV_FOCUS_CLASS,
            ].join(" ")}
          />

          <SelectBox value={type} onChange={setType} focusKey="history:type">
            {typeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectBox>

          <SelectBox value={lang} onChange={setLang} focusKey="history:lang">
            {langOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectBox>

          <SelectBox value={server} onChange={setServer} focusKey="history:server">
            <option value="tat-ca">Tất cả nguồn</option>
            {servers.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectBox>

          <SelectBox value={country} onChange={setCountry} focusKey="history:country">
            <option value="tat-ca">Tất cả quốc gia</option>
            {countries.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </SelectBox>

          <SelectBox value={year} onChange={setYear} focusKey="history:year">
            <option value="tat-ca">Tất cả năm</option>
            {years.map((item) => (
              <option key={item} value={String(item)}>
                {item}
              </option>
            ))}
          </SelectBox>

          <SelectBox value={sort} onChange={setSort} focusKey="history:sort">
            <option value="latest">Xem gần nhất</option>
            <option value="oldest">Xem cũ nhất</option>
            <option value="az">Tên A-Z</option>
          </SelectBox>
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">
          Chưa có lịch sử phù hợp.
        </div>
      ) : (
        <div
          data-tv-section="history-results"
          data-tv-row
          data-tv-row-key="history:results"
          data-tv-row-wrap="true"
          data-tv-scroll-align="center"
          data-tv-focus-out-up="selector:[data-tv-section='history-filters'] input, [data-tv-section='history-filters'] select"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9"
        >
          {filteredItems.map((item, index) => (
            <CompactMovieCard
              key={`${item.isCustom ? "custom" : "normal"}-${item.slug}`}
              href={getHistoryHref(item)}
              title={item.name}
              originName={item.origin_name}
              image={item.poster_url || item.thumb_url}
              topBadge={item.quality}
              topBadgeTone="dark"
              rightBadge={item.isCustom ? "Riêng" : undefined}
              bottomPrimary={item.episodeName || "Tập đang xem"}
              bottomSecondary={getSourceLabel(item)}
              meta={[
                item.year,
                item.lang,
                item.watchedAt && formatWatchedTime(item.watchedAt),
              ]}
              tvDefault={index === 0}
              onRemove={() => removeHistoryMovie(item)}
              removeLabel="Xóa"
              removeAriaLabel={`Xóa ${item.name} khỏi lịch sử`}
              hideRemoveUntilHover
            />
          ))}
        </div>
      )}
    </div>
  );
}
