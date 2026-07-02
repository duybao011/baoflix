import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import { MovieItem } from "@/lib/kkphim";

type MovieGridProps = {
  title: string;
  movies: MovieItem[];
  href?: string;
  sectionId?: string;
};

export default function MovieGrid({
  title,
  movies,
  href,
  sectionId = "movie-grid",
}: MovieGridProps) {
  if (!movies?.length) {
    return (
      <section id={sectionId} data-tv-section={sectionId} className="py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black min-[1280px]:text-2xl">{title}</h2>

          {href && (
            <Link
              href={href}
              data-tv-focus-key={`movie-grid-more:${href}`}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
            >
              Xem thêm →
            </Link>
          )}
        </div>

        <p className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">
          Chưa có phim để hiển thị.
        </p>
      </section>
    );
  }

  return (
    <section id={sectionId} data-tv-section={sectionId} className="py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-black min-[1280px]:text-2xl">{title}</h2>

        {href && (
          <Link
            href={href}
            data-tv-focus-key={`movie-grid-more:${href}`}
            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
          >
            Xem thêm →
          </Link>
        )}
      </div>

      <div
        data-tv-row
        data-tv-row-key={`movie-grid:${sectionId}`}
        data-tv-row-wrap="true"
        data-tv-scroll-align="center"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8"
      >
        {movies.map((movie, index) => (
          <MovieCard key={movie._id || movie.slug} movie={movie} tvDefault={index === 0} />
        ))}
      </div>
    </section>
  );
}
