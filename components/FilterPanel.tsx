"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Taxonomy } from "@/lib/kkphim";

type CurrentFilters = {
  type?: string;
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

const movieTypes = [
  { label: "Tất cả", value: "tat-ca" },
  { label: "Phim lẻ", value: "phim-le" },
  { label: "Phim bộ", value: "phim-bo" },
  { label: "TV Shows", value: "tv-shows" },
  { label: "Hoạt hình", value: "hoat-hinh" },
];

const languageModes = [
  { label: "Tất cả", value: "tat-ca" },
  { label: "Vietsub", value: "vietsub" },
  { label: "Thuyết minh", value: "thuyet-minh" },
  { label: "Lồng tiếng", value: "long-tieng" },
];

const quickModes = [
  { label: "Phim Vietsub", value: "phim-vietsub" },
  { label: "Phim thuyết minh", value: "phim-thuyet-minh" },
  { label: "Phim lồng tiếng", value: "phim-long-tieng" },
];

const sortOptions = [
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

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 border-b border-white/10 py-4 md:grid-cols-[150px_1fr]">
      <div className="font-bold text-slate-100">{label}:</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function OptionButton({
  active,
  children,
  onClick,
  disabled,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded-xl border px-4 py-2 text-sm transition",
        active
          ? "border-yellow-300 bg-yellow-300 text-black"
          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
        disabled ? "cursor-not-allowed opacity-40" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function FilterPanel({ genres, countries, current }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const currentSort = `${current.sort_field || "modified.time"}:${
    current.sort_type || "desc"
  }`;

  const [type, setType] = useState(current.type || "tat-ca");
  const [category, setCategory] = useState(current.category || "tat-ca");
  const [country, setCountry] = useState(current.country || "tat-ca");
  const [year, setYear] = useState(current.year || "tat-ca");
  const [sortLang, setSortLang] = useState(current.sort_lang || "tat-ca");
  const [sort, setSort] = useState(currentSort);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 20 }, (_, index) => String(now - index));
  }, []);

  function applyFilter() {
    const params = new URLSearchParams();

    if (type !== "tat-ca") params.set("type", type);
    if (category !== "tat-ca") params.set("category", category);
    if (country !== "tat-ca") params.set("country", country);
    if (year !== "tat-ca") params.set("year", year);
    if (sortLang !== "tat-ca") params.set("sort_lang", sortLang);

    const selectedSort = sortOptions.find((item) => item.value === sort);
    if (selectedSort) {
      params.set("sort_field", selectedSort.sort_field);
      params.set("sort_type", selectedSort.sort_type);
    }

    router.push(`/loc?${params.toString()}`);
  }

  function clearFilter() {
    setType("tat-ca");
    setCategory("tat-ca");
    setCountry("tat-ca");
    setYear("tat-ca");
    setSortLang("tat-ca");
    setSort("modified.time:desc");
    router.push("/loc");
  }

  function applyQuickMode(value: string) {
    const params = new URLSearchParams();
    params.set("type", value);
    router.push(`/loc?${params.toString()}`);
  }

  return (
    <section className="mb-8 rounded-3xl border border-white/10 bg-[#10131d]/95 p-5 shadow-2xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xl font-black">
          <span className="text-yellow-300">▼</span>
          Bộ lọc
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
        >
          {open ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
        </button>
      </div>

      {!open && (
        <p className="mt-3 text-sm text-slate-400">
          Bộ lọc đang được ẩn. Bấm “Hiện bộ lọc” để mở lại.
        </p>
      )}

      {open && (
        <>
          <FilterRow label="Chế độ nhanh">
            {quickModes.map((item) => (
              <OptionButton
                key={item.value}
                active={type === item.value}
                onClick={() => {
                  setType(item.value);
                  applyQuickMode(item.value);
                }}
              >
                {item.label}
              </OptionButton>
            ))}
          </FilterRow>

          <FilterRow label="Quốc gia">
            <OptionButton
              active={country === "tat-ca"}
              onClick={() => setCountry("tat-ca")}
            >
              Tất cả
            </OptionButton>

            {countries.map((item) => (
              <OptionButton
                key={item.slug}
                active={country === item.slug}
                onClick={() => setCountry(item.slug)}
              >
                {item.name}
              </OptionButton>
            ))}
          </FilterRow>

          <FilterRow label="Loại phim">
            {movieTypes.map((item) => (
              <OptionButton
                key={item.value}
                active={type === item.value}
                onClick={() => setType(item.value)}
              >
                {item.label}
              </OptionButton>
            ))}
          </FilterRow>

          <FilterRow label="Ngôn ngữ">
            {languageModes.map((item) => (
              <OptionButton
                key={item.value}
                active={sortLang === item.value}
                onClick={() => setSortLang(item.value)}
              >
                {item.label}
              </OptionButton>
            ))}
          </FilterRow>

          <FilterRow label="Thể loại">
            <OptionButton
              active={category === "tat-ca"}
              onClick={() => setCategory("tat-ca")}
            >
              Tất cả
            </OptionButton>

            {genres.map((item) => (
              <OptionButton
                key={item.slug}
                active={category === item.slug}
                onClick={() => setCategory(item.slug)}
              >
                {item.name}
              </OptionButton>
            ))}
          </FilterRow>

          <FilterRow label="Năm sản xuất">
            <OptionButton
              active={year === "tat-ca"}
              onClick={() => setYear("tat-ca")}
            >
              Tất cả
            </OptionButton>

            {years.map((item) => (
              <OptionButton
                key={item}
                active={year === item}
                onClick={() => setYear(item)}
              >
                {item}
              </OptionButton>
            ))}
          </FilterRow>

          <FilterRow label="Sắp xếp">
            {sortOptions.map((item) => (
              <OptionButton
                key={item.value}
                active={sort === item.value}
                onClick={() => setSort(item.value)}
              >
                {item.label}
              </OptionButton>
            ))}

            <OptionButton disabled>Điểm IMDb</OptionButton>
            <OptionButton disabled>Lượt xem</OptionButton>
          </FilterRow>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={applyFilter}
              className="rounded-2xl bg-yellow-300 px-7 py-3 font-black text-black hover:bg-yellow-200"
            >
              Lọc kết quả →
            </button>

            <button
              type="button"
              onClick={clearFilter}
              className="rounded-2xl border border-white/15 bg-white/5 px-7 py-3 font-bold text-white hover:bg-white/10"
            >
              Xóa lọc
            </button>
          </div>
        </>
      )}
    </section>
  );
}