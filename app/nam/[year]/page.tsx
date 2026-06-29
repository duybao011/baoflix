import MovieGrid from "@/components/MovieGrid";
import { getMoviesByYear } from "@/lib/kkphim";

type PageProps = {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ page?: string }>;
};

export default async function YearPage({ params, searchParams }: PageProps) {
  const { year } = await params;
  const query = await searchParams;
  const page = Number(query.page || 1);

  const result = await getMoviesByYear(year, page, 36);

  return (
    <div>
      <h1 className="mb-2 text-3xl font-black">Phim năm {year}</h1>
      <p className="mb-4 text-slate-400">
        Danh sách phim theo năm phát hành.
      </p>

      <MovieGrid title={result.title} movies={result.items} />
    </div>
  );
}