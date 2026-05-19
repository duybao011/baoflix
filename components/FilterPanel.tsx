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

const priorityCountrySlugs = [
  "han-quoc",
  "thai-lan",
  "nhat-ban",
  "au-my",
  "hong-kong",
  "trung-quoc",
  "anh",
  "an-do",
];

const priorityCountryNames = [
  "Hàn Quốc",
  "Thái Lan",
  "Nhật Bản",
  "Âu Mỹ",
  "Hồng Kông",
  "Trung Quốc",
  "Anh",
  "Ấn Độ",
];

const priorityGenreSlugs = [
  "chinh-kich",
  "khoa-hoc",
  "tinh-cam",
  "co-trang",
  "tam-ly",
  "bi-an",
  "hanh-dong",
  "hinh-su",
  "hai-huoc",
  "phieu-luu",
  "gia-dinh",
  "kinh-di",
  "tai-lieu",
  "hoat-hinh",
  "chieu-rap",
];

const priorityGenreNames = [
  "Chính Kịch",
  "Khoa Học",
  "Tình Cảm",
  "Cổ Trang",
  "Tâm Lý",
  "Bí Ẩn",
  "Hành Động",
  "Hình Sự",
  "Hài Hước",
  "Phiêu Lưu",
  "Gia Đình",
  "Kinh Dị",
  "Tài Liệu",
  "Hoạt Hình",
  "Chiếu rạp",
];

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

function normalizeText(text?: string) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sortByPriority(items: Taxonomy[], prioritySlugs: string[], priorityNames: string[]) {
  const priorityMap = new Map<string, number>();

  prioritySlugs.forEach((slug, index) => {
    priorityMap.set(slug, index);
  });

  priorityNames.forEach((name, index) => {
    priorityMap.set(normalizeText(name).replace(/\s+/g, "-"), index);
  });

  const priorityItems: Taxonomy[] = [];
  const otherItems: Taxonomy[] = [];

  items.forEach((item) => {
    const slugKey = item.slug;
    const nameKey = normalizeText(item.name).replace(/\s+/g, "-");

    if (priorityMap.has(slugKey) || priorityMap.has(nameKey)) {
      priorityItems.push(item);
    } else {
      otherItems.push(item);
    }
  });

  priorityItems.sort((a, b) => {
    const aKey = priorityMap.get(a.slug) ?? priorityMap.get(normalizeText(a.name).replace(/\s+/g, "-")) ?? 999;
    const bKey = priorityMap.get(b.slug) ?? priorityMap.get(normalizeText(b.name).replace(/\s+/g, "-")) ?? 999;

    return aKey - bKey;
  });

  otherItems.sort((a, b) => a.name.localeCompare(b.name));

  return {
    priorityItems,
    otherItems,
  };
}

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
      className="rounded-xl border border-white/10 bg-[#10131d] px-4 py-2 text-sm text-slate-200 outline-none hover:bg-white/10"
    >
      {children}
    </select>
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

  const sortedCountries = useMemo(() => {
    return sortByPriority(countries, priorityCountrySlugs, priorityCountryNames);
  }, [countries]);

  const sortedGenres = useMemo(() => {
    return sortByPriority(genres, priorityGenreSlugs, priorityGenreNames);
  }, [genres]);

  const countryIsOther =
    country !== "tat-ca" &&
    sortedCountries.otherItems.some((item) => item.slug === country);

  const categoryIsOther =
    category !== "tat-ca" &&
    sortedGenres.otherItems.some((item) => item.slug === category);

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

            {sortedCountries.priorityItems.map((item) => (
              <OptionButton
                key={item.slug}
                active={country === item.slug}
                onClick={() => setCountry(item.slug)}
              >
                {item.name}
              </OptionButton>
            ))}

            {sortedCountries.otherItems.length > 0 && (
              <SelectBox
                value={countryIsOther ? country : "tat-ca"}
                onChange={(value) => setCountry(value)}
              >
                <option value="tat-ca">Quốc gia khác</option>
                {sortedCountries.otherItems.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </SelectBox>
            )}
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

            {sortedGenres.priorityItems.map((item) => (
              <OptionButton
                key={item.slug}
                active={category === item.slug}
                onClick={() => setCategory(item.slug)}
              >
                {item.name}
              </OptionButton>
            ))}

            {sortedGenres.otherItems.length > 0 && (
              <SelectBox
                value={categoryIsOther ? category : "tat-ca"}
                onChange={(value) => setCategory(value)}
              >
                <option value="tat-ca">Thể loại khác</option>
                {sortedGenres.otherItems.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </SelectBox>
            )}
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