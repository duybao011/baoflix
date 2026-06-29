import { connection } from "next/server";
import FilterPanel from "@/components/FilterPanel";
import MovieGrid from "@/components/MovieGrid";
import Pagination from "@/components/Pagination";
import { getCountries, getFilteredMovies, getGenres } from "@/lib/kkphim";

type PageProps = {
  searchParams: Promise<{
    type?: string;
    subtype?: string;
    category?: string;
    country?: string;
    year?: string;
    sort_lang?: string;
    sort_field?: string;
    sort_type?: string;
    page?: string;
  }>;
};

export default async function FilterPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = Number(params.page || 1);

  const current = {
    type: params.type || "tat-ca",
    subtype: params.subtype || "tat-ca",
    category: params.category || "tat-ca",
    country: params.country || "tat-ca",
    year: params.year || "tat-ca",
    sort_lang: params.sort_lang || "tat-ca",
    sort_field: params.sort_field || "modified.time",
    sort_type: params.sort_type || "desc",
  };

  const [genres, countries, result] = await Promise.all([
    getGenres(),
    getCountries(),
    getFilteredMovies({
      ...current,
      page,
      limit: 36,
    }),
  ]);

  const currentPage = Number(result.pagination?.currentPage || page);
  const totalPages = Number(result.pagination?.totalPages || 0);

  return (
    <div data-tv-scope="loc-page" data-tv-lock="true">
      <h1 className="mb-2 text-3xl font-black">Bộ lọc phim</h1>

      <p className="mb-6 text-slate-400">
        Lọc theo quốc gia, loại phim, dạng hoạt hình, ngôn ngữ, thể loại, năm và
        sắp xếp.
      </p>

      <FilterPanel genres={genres} countries={countries} current={current} />

      <MovieGrid title={result.title || "Kết quả lọc"} movies={result.items} />

      <Pagination
        basePath="/loc"
        currentPage={currentPage}
        totalPages={totalPages}
        searchParams={current}
      />
    </div>
  );
}