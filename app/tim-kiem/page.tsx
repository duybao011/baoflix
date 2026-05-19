import Link from "next/link";
import MovieGrid from "@/components/MovieGrid";
import Pagination from "@/components/Pagination";
import SearchHistoryRecorder from "@/components/SearchHistoryRecorder";
import {
  getCountries,
  searchMovies,
  smartFilterMoviesByKeyword,
  Taxonomy,
} from "@/lib/kkphim";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    mode?: string;
    country?: string;
  }>;
};

const priorityCountries = [
  { label: "Hàn Quốc", slug: "han-quoc" },
  { label: "Nhật Bản", slug: "nhat-ban" },
  { label: "Trung Quốc", slug: "trung-quoc" },
  { label: "Thái Lan", slug: "thai-lan" },
  { label: "Âu Mỹ", slug: "au-my" },
];

function createSearchHref({
  keyword,
  mode,
  country,
  page,
}: {
  keyword: string;
  mode: string;
  country?: string;
  page?: number;
}) {
  const params = new URLSearchParams();

  params.set("q", keyword);
  params.set("mode", mode);

  if (country && country !== "tat-ca") {
    params.set("country", country);
  }

  if (page && page > 1) {
    params.set("page", String(page));
  }

  return `/tim-kiem?${params.toString()}`;
}

function CountryQuickFilter({
  keyword,
  mode,
  country,
  countries,
}: {
  keyword: string;
  mode: string;
  country: string;
  countries: Taxonomy[];
}) {
  const prioritySlugs = new Set(priorityCountries.map((item) => item.slug));
  const otherCountries = countries.filter((item) => !prioritySlugs.has(item.slug));

  const countryIsOther =
    country !== "tat-ca" && otherCountries.some((item) => item.slug === country);

  return (
    <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-black">Lọc quốc gia</h2>
          <p className="mt-1 text-sm text-slate-400">
            Thu hẹp kết quả tìm kiếm theo quốc gia.
          </p>
        </div>

        {country !== "tat-ca" && (
          <Link
            href={createSearchHref({ keyword, mode, country: "tat-ca" })}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-white/10"
          >
            Xóa lọc
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={createSearchHref({ keyword, mode, country: "tat-ca" })}
          className={[
            "rounded-xl border px-4 py-2 text-sm font-bold",
            country === "tat-ca"
              ? "border-red-500 bg-red-600 text-white"
              : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
          ].join(" ")}
        >
          Tất cả
        </Link>

        {priorityCountries.map((item) => (
          <Link
            key={item.slug}
            href={createSearchHref({ keyword, mode, country: item.slug })}
            className={[
              "rounded-xl border px-4 py-2 text-sm font-bold",
              country === item.slug
                ? "border-red-500 bg-red-600 text-white"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}

        {otherCountries.length > 0 && (
          <form action="/tim-kiem" className="flex gap-2">
            <input type="hidden" name="q" value={keyword} />
            <input type="hidden" name="mode" value={mode} />

            <select
              name="country"
              defaultValue={countryIsOther ? country : "tat-ca"}
              className="rounded-xl border border-white/10 bg-[#10131d] px-4 py-2 text-sm text-slate-200 outline-none"
            >
              <option value="tat-ca">Quốc gia khác</option>

              {otherCountries.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>

            <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-500">
              Lọc
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const keyword = params.q?.trim() || "";
  const page = Number(params.page || 1);
  const mode = params.mode || "smart";
  const country = params.country || "tat-ca";

  if (!keyword) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-black">Tìm kiếm phim</h1>
        <p className="mt-3 text-slate-400">
          Nhập tên phim vào ô tìm kiếm phía trên để bắt đầu.
        </p>
      </section>
    );
  }

  const [countries, result] = await Promise.all([
    getCountries(),
    searchMovies(keyword, page, 64, {
      country,
    }),
  ]);

  const movies =
    mode === "wide"
      ? result.items
      : smartFilterMoviesByKeyword(result.items, keyword);

  const totalPages = Number(result.pagination?.totalPages || 0);

  return (
    <div>
      <SearchHistoryRecorder keyword={keyword} />

      <h1 className="mb-2 text-3xl font-black">Kết quả tìm kiếm</h1>

      <p className="mb-4 text-slate-400">
        Từ khóa: <span className="text-white">{keyword}</span>
      </p>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href={createSearchHref({ keyword, mode: "smart", country })}
          className={[
            "rounded-2xl border px-4 py-2 text-sm font-bold",
            mode !== "wide"
              ? "border-red-500 bg-red-600 text-white"
              : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
          ].join(" ")}
        >
          Tìm chính xác hơn
        </Link>

        <Link
          href={createSearchHref({ keyword, mode: "wide", country })}
          className={[
            "rounded-2xl border px-4 py-2 text-sm font-bold",
            mode === "wide"
              ? "border-red-500 bg-red-600 text-white"
              : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
          ].join(" ")}
        >
          Tìm rộng
        </Link>
      </div>

      <CountryQuickFilter
        keyword={keyword}
        mode={mode}
        country={country}
        countries={countries}
      />

      {mode !== "wide" && result.items.length > movies.length && (
        <div className="mb-6 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm text-yellow-100">
          Đã lọc bớt {result.items.length - movies.length} kết quả không khớp sát
          với từ khóa. Bấm “Tìm rộng” nếu fen muốn xem toàn bộ kết quả từ API.
        </div>
      )}

      <MovieGrid title={result.title} movies={movies} />

      {mode === "wide" && (
        <Pagination
          basePath="/tim-kiem"
          currentPage={page}
          totalPages={totalPages}
          searchParams={{
            q: keyword,
            mode,
            country: country === "tat-ca" ? undefined : country,
          }}
        />
      )}
    </div>
  );
}