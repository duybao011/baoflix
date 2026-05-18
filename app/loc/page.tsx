import FilterPanel from "@/components/FilterPanel";
import MovieGrid from "@/components/MovieGrid";
import Pagination from "@/components/Pagination";
import {
  getCountries,
  getFilteredMovies,
  getGenres,
  FilterValues,
} from "@/lib/kkphim";

type PageProps = {
  searchParams: Promise<{
    type?: string;
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

  const filters: FilterValues = {
    type: params.type || "tat-ca",
    category: params.category || "tat-ca",
    country: params.country || "tat-ca",
    year: params.year || "tat-ca",
    sort_lang: params.sort_lang || "tat-ca",
    sort_field: params.sort_field || "modified.time",
    sort_type: params.sort_type || "desc",
    page,
    limit: 36,
  };

  const [genres, countries, result] = await Promise.all([
    getGenres(),
    getCountries(),
    getFilteredMovies(filters),
  ]);

  const totalPages = Number(result.pagination?.totalPages || 0);

  return (
    <div>
      <h1 className="mb-4 text-3xl font-black">Bộ lọc phim</h1>

      <FilterPanel genres={genres} countries={countries} current={filters} />

      <MovieGrid title={result.title} movies={result.items} />

      <Pagination
        basePath="/loc"
        currentPage={page}
        totalPages={totalPages}
        searchParams={{
          type: params.type,
          category: params.category,
          country: params.country,
          year: params.year,
          sort_lang: params.sort_lang,
          sort_field: params.sort_field,
          sort_type: params.sort_type,
        }}
      />
    </div>
  );
}