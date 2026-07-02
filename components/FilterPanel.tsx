"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Taxonomy } from "@/lib/kkphim";

type CurrentFilters = {
  type?: string;
  subtype?: string;
  category?: string;
  country?: string;
  year?: string;
  sort_lang?: string;
  sort_field?: string;
  sort_type?: string;
};

type Props = {
  genres: Taxonomy[];
  countries: Taxonomy[];
  current: CurrentFilters;
};

type Tab = "type" | "country" | "category" | "lang" | "year" | "sort";

const LOC_FOCUS_KEY = "baoflix_tv_loc_focus_after_nav";

const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const types = [
  { label: "Tất cả", value: "tat-ca" },
  { label: "Phim lẻ", value: "phim-le" },
  { label: "Phim bộ", value: "phim-bo" },
  { label: "TV Shows", value: "tv-shows" },
  { label: "Hoạt hình", value: "hoat-hinh" },
];

const langs = [
  { label: "Tất cả", value: "tat-ca" },
  { label: "Vietsub", value: "vietsub" },
  { label: "Thuyết minh", value: "thuyet-minh" },
  { label: "Lồng tiếng", value: "long-tieng" },
];

const sorts = [
  {
    label: "Mới nhất",
    value: "modified.time:desc",
    sort_field: "modified.time",
    sort_type: "desc",
  },
  {
    label: "Năm mới nhất",
    value: "year:desc",
    sort_field: "year",
    sort_type: "desc",
  },
  {
    label: "Năm cũ nhất",
    value: "year:asc",
    sort_field: "year",
    sort_type: "asc",
  },
  {
    label: "ID mới nhất",
    value: "_id:desc",
    sort_field: "_id",
    sort_type: "desc",
  },
];

const tabs: { id: Tab; label: string }[] = [
  { id: "type", label: "Loại" },
  { id: "country", label: "Quốc gia" },
  { id: "category", label: "Thể loại" },
  { id: "lang", label: "Ngôn ngữ" },
  { id: "year", label: "Năm" },
  { id: "sort", label: "Sắp xếp" },
];

const years = Array.from({ length: 18 }, (_, index) =>
  String(new Date().getFullYear() - index)
);

const countryPriority = [
  "trung-quoc",
  "han-quoc",
  "nhat-ban",
  "thai-lan",
  "au-my",
  "hong-kong",
  "anh",
  "an-do",
  "viet-nam",
];

const genrePriority = [
  "co-trang",
  "tinh-cam",
  "chinh-kich",
  "tam-ly",
  "bi-an",
  "hanh-dong",
  "hinh-su",
  "hai-huoc",
  "phieu-luu",
  "gia-dinh",
  "kinh-di",
  "khoa-hoc",
  "tai-lieu",
];

function parse(value?: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && item !== "tat-ca");
}

function toggle(list: string[], value: string) {
  if (!value || value === "tat-ca") return [];
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function sortItems(items: Taxonomy[], priority: string[]) {
  const priorityMap = new Map(priority.map((slug, index) => [slug, index]));

  return [...items].sort((a, b) => {
    const scoreA = priorityMap.get(a.slug) ?? 999;
    const scoreB = priorityMap.get(b.slug) ?? 999;

    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.name.localeCompare(b.name);
  });
}

function saveLocFocusIntent(mode: "results" | "filter" = "results") {
  try {
    sessionStorage.setItem(LOC_FOCUS_KEY, mode);
  } catch {
    // Ignore storage errors in restricted TV WebViews.
  }

  window.dispatchEvent(
    new CustomEvent("baoflix-tv-focus-lock", {
      detail: { ms: 180 },
    })
  );
}

function buildFilterHref({
  type,
  country,
  category,
  year,
  lang,
  sort,
}: {
  type: string;
  country: string[];
  category: string[];
  year: string;
  lang: string;
  sort: string;
}) {
  const params = new URLSearchParams();
  const selectedSort = sorts.find((item) => item.value === sort);
  const sortField = selectedSort?.sort_field || "modified.time";
  const sortType = selectedSort?.sort_type || "desc";

  if (type !== "tat-ca") params.set("type", type);
  if (country.length) params.set("country", country.join(","));
  if (category.length) params.set("category", category.join(","));
  if (year !== "tat-ca") params.set("year", year);
  if (lang !== "tat-ca") params.set("sort_lang", lang);

  if (sortField !== "modified.time") params.set("sort_field", sortField);
  if (sortType !== "desc") params.set("sort_type", sortType);

  const query = params.toString();
  return query ? `/loc?${query}` : "/loc";
}

function Chip({
  active,
  children,
  onClick,
  focusKey,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  focusKey: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tv-focus-key={focusKey}
      className={[
        "min-h-[36px] rounded-lg border px-3 py-1.5 text-[12px] font-black leading-tight transition min-[1280px]:min-h-[38px]",
        active
          ? "border-yellow-300 bg-yellow-300 text-black"
          : "border-white/10 bg-white/[0.055] text-slate-200 hover:bg-white/10",
        TV_FOCUS_CLASS,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function FilterPanel({ genres, countries, current }: Props) {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("type");
  const [type, setType] = useState(current.type || "tat-ca");
  const [country, setCountry] = useState(parse(current.country));
  const [category, setCategory] = useState(parse(current.category));
  const [year, setYear] = useState(current.year || "tat-ca");
  const [lang, setLang] = useState(current.sort_lang || "tat-ca");
  const [sort, setSort] = useState(
    `${current.sort_field || "modified.time"}:${current.sort_type || "desc"}`
  );

  useEffect(() => {
    setType(current.type || "tat-ca");
    setCountry(parse(current.country));
    setCategory(parse(current.category));
    setYear(current.year || "tat-ca");
    setLang(current.sort_lang || "tat-ca");
    setSort(`${current.sort_field || "modified.time"}:${current.sort_type || "desc"}`);
  }, [
    current.type,
    current.country,
    current.category,
    current.year,
    current.sort_lang,
    current.sort_field,
    current.sort_type,
  ]);

  const sortedCountries = useMemo(
    () => sortItems(countries, countryPriority),
    [countries]
  );
  const sortedGenres = useMemo(
    () => sortItems(genres, genrePriority),
    [genres]
  );

  const selectedCount =
    (type !== "tat-ca" ? 1 : 0) +
    country.length +
    category.length +
    (year !== "tat-ca" ? 1 : 0) +
    (lang !== "tat-ca" ? 1 : 0) +
    (sort !== "modified.time:desc" ? 1 : 0);

  function navigateTo(href: string, mode: "results" | "filter" = "results") {
    saveLocFocusIntent(mode);

    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (currentHref === href) {
      window.dispatchEvent(new CustomEvent("baoflix-tv-loc-focus", { detail: { mode } }));
      return;
    }

    router.replace(href, { scroll: false });
  }

  function apply() {
    const href = buildFilterHref({ type, country, category, year, lang, sort });
    navigateTo(href, "results");
  }

  function reset() {
    setType("tat-ca");
    setCountry([]);
    setCategory([]);
    setYear("tat-ca");
    setLang("tat-ca");
    setSort("modified.time:desc");
    setTab("type");
    navigateTo("/loc", "results");
  }

  return (
    <section
      data-tv-scope="filter-tabs"
      data-tv-lock="true"
      data-tv-autofocus="true"
      data-tv-filter-panel
      data-tv-tabs-root
      className="rounded-3xl border border-white/10 bg-white/[0.035] p-3 shadow-[0_20px_70px_rgba(0,0,0,0.18)] min-[1280px]:p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-yellow-300">
            TV Filter
          </p>
          <h2 className="mt-0.5 text-xl font-black leading-tight min-[1280px]:text-2xl">
            Chọn gu phim
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            {selectedCount ? `${selectedCount} lựa chọn đang bật` : "Chưa bật bộ lọc nào"}
          </p>
        </div>

        <div data-tv-row data-tv-row-key="filter:top-actions" className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={apply}
            data-tv-focus-key="filter:apply-top"
            data-tv-loc-filter-nav="true"
            className={[
              "rounded-xl bg-yellow-300 px-4 py-2 text-[12px] font-black text-black hover:bg-yellow-200",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            Áp dụng
          </button>

          <button
            type="button"
            onClick={reset}
            data-tv-focus-key="filter:reset-top"
            data-tv-loc-filter-nav="true"
            className={[
              "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[12px] font-black text-white hover:bg-white/10",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            Xóa lọc
          </button>
        </div>
      </div>

      <div
        data-tv-row
        data-tv-row-key="filter:tabs"
        data-tv-row-wrap="true"
        data-tv-tab-list
        className="mb-3 flex flex-wrap gap-2"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            data-tv-default={item.id === "type" ? true : undefined}
            data-tv-tab-active={tab === item.id ? "true" : undefined}
            data-tv-focus-key={`filter-tab:${item.id}`}
            className={[
              "min-h-[36px] rounded-lg border px-3 py-1.5 text-[12px] font-black transition min-[1280px]:min-h-[38px]",
              tab === item.id
                ? "border-yellow-300 bg-yellow-300 text-black"
                : "border-white/10 bg-white/[0.055] text-slate-200 hover:bg-white/10",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        data-tv-tab-panel
        data-tv-tab-panel-active="true"
        className="min-h-[168px] rounded-2xl border border-white/10 bg-black/20 p-3 min-[1280px]:min-h-[184px]"
      >
        {tab === "type" && (
          <div data-tv-row data-tv-row-key="filter:type" data-tv-row-wrap="true" className="flex flex-wrap gap-2">
            {types.map((item) => (
              <Chip
                key={item.value}
                active={type === item.value}
                onClick={() => setType(item.value)}
                focusKey={`filter-type:${item.value}`}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        )}

        {tab === "country" && (
          <div
            data-tv-row
            data-tv-row-key="filter:country"
            data-tv-row-wrap="true"
            className="grid max-h-[42vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7"
          >
            <Chip
              active={!country.length}
              onClick={() => setCountry([])}
              focusKey="filter-country:all"
            >
              Tất cả
            </Chip>

            {sortedCountries.slice(0, 42).map((item) => (
              <Chip
                key={item.slug}
                active={country.includes(item.slug)}
                onClick={() => setCountry((old) => toggle(old, item.slug))}
                focusKey={`filter-country:${item.slug}`}
              >
                {item.name}
              </Chip>
            ))}
          </div>
        )}

        {tab === "category" && (
          <div
            data-tv-row
            data-tv-row-key="filter:category"
            data-tv-row-wrap="true"
            className="grid max-h-[42vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7"
          >
            <Chip
              active={!category.length}
              onClick={() => setCategory([])}
              focusKey="filter-category:all"
            >
              Tất cả
            </Chip>

            {sortedGenres.slice(0, 42).map((item) => (
              <Chip
                key={item.slug}
                active={category.includes(item.slug)}
                onClick={() => setCategory((old) => toggle(old, item.slug))}
                focusKey={`filter-category:${item.slug}`}
              >
                {item.name}
              </Chip>
            ))}
          </div>
        )}

        {tab === "lang" && (
          <div data-tv-row data-tv-row-key="filter:lang" data-tv-row-wrap="true" className="flex flex-wrap gap-2">
            {langs.map((item) => (
              <Chip
                key={item.value}
                active={lang === item.value}
                onClick={() => setLang(item.value)}
                focusKey={`filter-lang:${item.value}`}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        )}

        {tab === "year" && (
          <div
            data-tv-row
            data-tv-row-key="filter:year"
            data-tv-row-wrap="true"
            className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9"
          >
            <Chip
              active={year === "tat-ca"}
              onClick={() => setYear("tat-ca")}
              focusKey="filter-year:all"
            >
              Tất cả
            </Chip>

            {years.map((item) => (
              <Chip
                key={item}
                active={year === item}
                onClick={() => setYear(item)}
                focusKey={`filter-year:${item}`}
              >
                {item}
              </Chip>
            ))}
          </div>
        )}

        {tab === "sort" && (
          <div data-tv-row data-tv-row-key="filter:sort" data-tv-row-wrap="true" className="flex flex-wrap gap-2">
            {sorts.map((item) => (
              <Chip
                key={item.value}
                active={sort === item.value}
                onClick={() => setSort(item.value)}
                focusKey={`filter-sort:${item.value}`}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <div data-tv-row data-tv-row-key="filter:bottom-actions" className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <button
          type="button"
          onClick={apply}
          data-tv-jump-results="true"
          data-tv-loc-filter-nav="true"
          data-tv-focus-key="filter:apply-bottom"
          className={[
            "rounded-xl bg-yellow-300 px-4 py-2.5 text-[12px] font-black text-black hover:bg-yellow-200",
            TV_FOCUS_CLASS,
          ].join(" ")}
        >
          Áp dụng lọc
        </button>

        <button
          type="button"
          onClick={reset}
          data-tv-focus-key="filter:reset-bottom"
          data-tv-loc-filter-nav="true"
          className={[
            "rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-black text-white hover:bg-white/10",
            TV_FOCUS_CLASS,
          ].join(" ")}
        >
          Xóa lọc
        </button>

        <button
          type="button"
          onClick={() => router.push("/tv")}
          data-tv-focus-key="filter:tv-home"
          className={[
            "rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-[12px] font-black text-white hover:bg-white/10",
            TV_FOCUS_CLASS,
          ].join(" ")}
        >
          TV Hub
        </button>
      </div>
    </section>
  );
}
