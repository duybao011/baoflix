import MovieGrid from "@/components/MovieGrid";
import { getCustomMovieItems } from "@/data/custom-movies";

export default function CustomMoviesPage() {
  const movies = getCustomMovieItems();

  return (
    <div>
      <h1 className="mb-2 text-3xl font-black">Phim riêng</h1>

      <p className="mb-6 text-slate-400">
        Các phim do bạn tự thêm vào BảoFlix.
      </p>

      <MovieGrid title="Thư viện cá nhân" movies={movies} />
    </div>
  );
}