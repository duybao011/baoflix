import MovieCard from "@/components/MovieCard";
import { MovieItem } from "@/lib/kkphim";

export default function MovieGrid({
  title,
  movies,
}: {
  title: string;
  movies: MovieItem[];
}) {
  if (!movies?.length) {
    return (
      <section className="py-8">
        <h2 className="mb-4 text-2xl font-black">{title}</h2>
        <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-400">
          Chưa có phim để hiển thị.
        </p>
      </section>
    );
  }

  return (
    <section className="py-8">
      <h2 className="mb-5 text-2xl font-black">{title}</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {movies.map((movie) => (
          <MovieCard key={movie._id || movie.slug} movie={movie} />
        ))}
      </div>
    </section>
  );
}