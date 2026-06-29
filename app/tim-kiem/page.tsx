import { connection } from "next/server";
import Link from "next/link";
import LocalCustomSearchResults from "@/components/LocalCustomSearchResults";
import MovieGrid from "@/components/MovieGrid";
import Pagination from "@/components/Pagination";
import SearchEmptyState from "@/components/SearchEmptyState";
import {
  getCountries,
  searchMovies,
  smartFilterMoviesByKeyword,
} from "@/lib/kkphim";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    keyword?: string;
    page?: string;
    country?: string;
    sort_lang?: string;
    category?: string;
    year?: string;
  }>;
};

function buildSearchHref(input: {
  q: string;
  country?: string;
  sort_lang?: string;
  category?: string;
  year?: string;
  page?: number;
}) {
  const params = new URLSearchParams();

  if (input.q) params.set("q", input.q);

  if (input.country && input.country !== "tat-ca") {
    params.set("country", input.country);
  }

  if (input.sort_lang && input.sort_lang !== "tat-ca") {
    params.set("sort_lang", input.sort_lang);
  }

  if (input.category && input.category !== "tat-ca") {
    params.set("category", input.category);
  }

  if (input.year && input.year !== "tat-ca") {
    params.set("year", input.year);
  }

  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }

  const query = params.toString();

  return query ? `/tim-kiem?${query}` : "/tim-kiem";
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const q = (params.q || params.keyword || "").trim();
  const page = Number(params.page || 1);

  const country = params.country || "tat-ca";
  const sortLang = params.sort_lang || "tat-ca";
  const category = params.category || "tat-ca";
  const year = params.year || "tat-ca";

  if (!q) {
    return <SearchEmptyState />;
  }

  const countries = await getCountries();

  const searchResult = await searchMovies(q, page, 36, {
    country: country !== "tat-ca" ? country : undefined,
    sort_lang: sortLang !== "tat-ca" ? sortLang : undefined,
    category: category !== "tat-ca" ? category : undefined,
    year: year !== "tat-ca" ? year : undefined,
  });

  const filteredMovies = smartFilterMoviesByKeyword(searchResult.items, q);

  const result = {
    ...searchResult,
    items: filteredMovies,
  };

  const totalPages = Number(result.pagination?.totalPages || 0);
  const currentPage = Number(result.pagination?.currentPage || page);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Tìm kiếm: {q}</h1>

          <p className="mt-2 text-slate-400">
            Kết quả được lọc lại để giảm tình trạng tìm “Hoa” ra cả “Hoàng”,
            “Hoại”... Phim riêng trên thiết bị này cũng sẽ hiện ở khối riêng.
          </p>
        </div>

        <Link
          href="/tim-kiem"
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold hover:bg-white/10"
        >
          Tìm từ khóa khác
        </Link>
      </div>

      <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="mb-4 text-xl font-black">Lọc nhanh trong tìm kiếm</h2>

        <div className="grid gap-4">
          <div>
            <p className="mb-3 text-sm font-bold text-slate-200">Quốc gia</p>

            <div className="flex flex-wrap gap-2">
              <Link
                href={buildSearchHref({
                  q,
                  country: "tat-ca",
                  sort_lang: sortLang,
                  category,
                  year,
                })}
                className={[
                  "rounded-xl border px-4 py-2 text-sm font-bold",
                  country === "tat-ca"
                    ? "border-yellow-300 bg-yellow-300 text-black"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                ].join(" ")}
              >
                Tất cả
              </Link>

              {countries
                .filter((item) =>
                  [
                    "han-quoc",
                    "nhat-ban",
                    "thai-lan",
                    "au-my",
                    "trung-quoc",
                    "hong-kong",
                    "anh",
                    "an-do",
                  ].includes(item.slug)
                )
                .map((item) => (
                  <Link
                    key={item.slug}
                    href={buildSearchHref({
                      q,
                      country: item.slug,
                      sort_lang: sortLang,
                      category,
                      year,
                    })}
                    className={[
                      "rounded-xl border px-4 py-2 text-sm font-bold",
                      country === item.slug
                        ? "border-yellow-300 bg-yellow-300 text-black"
                        : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                    ].join(" ")}
                  >
                    {item.name}
                  </Link>
                ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-bold text-slate-200">Ngôn ngữ</p>

            <div className="flex flex-wrap gap-2">
              {[
                { label: "Tất cả", value: "tat-ca" },
                { label: "Vietsub", value: "vietsub" },
                { label: "Thuyết minh", value: "thuyet-minh" },
                { label: "Lồng tiếng", value: "long-tieng" },
              ].map((item) => (
                <Link
                  key={item.value}
                  href={buildSearchHref({
                    q,
                    country,
                    sort_lang: item.value,
                    category,
                    year,
                  })}
                  className={[
                    "rounded-xl border px-4 py-2 text-sm font-bold",
                    sortLang === item.value
                      ? "border-yellow-300 bg-yellow-300 text-black"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <LocalCustomSearchResults q={q} country={country} year={year} />

      {result.items.length > 0 ? (
        <>
          <MovieGrid
            title={result.title || `Kết quả: ${q}`}
            movies={result.items}
          />

          <Pagination
            basePath="/tim-kiem"
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={{
              q,
              country,
              sort_lang: sortLang,
              category,
              year,
            }}
          />
        </>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h2 className="text-2xl font-black">Không tìm thấy phim phù hợp</h2>

          <p className="mt-2 text-slate-400">
            Thử tìm bằng tên gốc, tên ngắn hơn hoặc bỏ bớt bộ lọc quốc gia/ngôn
            ngữ.
          </p>
        </div>
      )}
    </div>
  );
}
