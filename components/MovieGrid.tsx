import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import { MovieItem } from "@/lib/kkphim";

export default function MovieGrid({
  title,
  movies,
  href,
}: {
  title: string;
  movies: MovieItem[];
  href?: string;
}) {
  if (!movies?.length) {
    return (
      <section data-tv-section="filter-results" className="py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">{title}</h2>

          {href && (
            <Link
              href={href}
              data-tv-focus-key={`movie-grid-more:${href}`}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
            >
              Xem thêm →
            </Link>
          )}
        </div>

        <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-400">
          Chưa có phim để hiển thị.
        </p>
      </section>
    );
  }

  return (
    <section data-tv-section="filter-results" className="py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black">{title}</h2>

        {href && (
          <Link
            href={href}
            data-tv-focus-key={`movie-grid-more:${href}`}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
          >
            Xem thêm →
          </Link>
        )}
      </div>

      <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {movies.map((movie) => (
          <MovieCard key={movie._id || movie.slug} movie={movie} />
        ))}
      </div>
    </section>
  );
}
