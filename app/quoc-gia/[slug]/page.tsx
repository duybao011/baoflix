import { connection } from "next/server";
import MovieGrid from "@/components/MovieGrid";
import Pagination from "@/components/Pagination";
import { getMoviesByCountry } from "@/lib/kkphim";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export default async function CountryDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const page = Number(query.page || 1);

  const result = await getMoviesByCountry(slug, page, 36);
  const totalPages = Number(result.pagination?.totalPages || 0);

  return (
    <div>
      <h1 className="mb-2 text-3xl font-black">{result.title}</h1>

      <p className="mb-4 text-slate-400">
        Danh sách phim theo quốc gia.
      </p>

      <MovieGrid title={result.title} movies={result.items} />

      <Pagination
        basePath={`/quoc-gia/${slug}`}
        currentPage={page}
        totalPages={totalPages}
        searchParams={query}
      />
    </div>
  );
}