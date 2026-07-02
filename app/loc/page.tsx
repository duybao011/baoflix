import FilterPanel from "@/components/FilterPanel";
import LocTvFocusManager from "@/components/LocTvFocusManager";
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
      limit: 40,
    }),
  ]);

  const currentPage = Number(result.pagination?.currentPage || page);
  const totalPages = Number(result.pagination?.totalPages || 0);

  return (
    <div
      data-tv-scope="loc-page"
      data-tv-lock="true"
      data-tv-autofocus="true"
      className="baoflix-tv-page space-y-4"
    >
      <LocTvFocusManager />

      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-yellow-300/[0.08] p-4 min-[1280px]:p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-300/90">
          BảoFlix TV
        </p>

        <h1 className="mt-1 text-2xl font-black leading-tight min-[1280px]:text-3xl">
          Bộ lọc phim
        </h1>

        <p className="mt-1 max-w-3xl text-sm font-medium text-slate-400">
          Chọn gu phim bằng remote, áp dụng xong sẽ nhảy thẳng xuống kết quả.
        </p>
      </header>

      <FilterPanel genres={genres} countries={countries} current={current} />

      <MovieGrid
        title={result.title || "Kết quả lọc"}
        movies={result.items}
        sectionId="filter-results"
      />

      <Pagination
        basePath="/loc"
        currentPage={currentPage}
        totalPages={totalPages}
        searchParams={current}
        focusTargetId="filter-results"
      />
    </div>
  );
}
