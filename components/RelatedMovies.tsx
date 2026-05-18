import MovieGrid from "@/components/MovieGrid";
import {
  getMoviesByCountry,
  getMoviesByGenre,
  getMoviesByYear,
  MovieDetail,
  MovieItem,
} from "@/lib/kkphim";

function addUniqueMovies(
  target: MovieItem[],
  source: MovieItem[],
  currentSlug: string
) {
  const existingSlugs = new Set(target.map((movie) => movie.slug));

  source.forEach((movie) => {
    if (!movie?.slug) return;
    if (movie.slug === currentSlug) return;
    if (existingSlugs.has(movie.slug)) return;

    target.push(movie);
    existingSlugs.add(movie.slug);
  });
}

export default async function RelatedMovies({ movie }: { movie: MovieDetail }) {
  const countrySlug = movie.country?.[0]?.slug;
  const categorySlug = movie.category?.[0]?.slug;
  const year = movie.year ? String(movie.year) : "";

  const relatedMovies: MovieItem[] = [];

  // Ưu tiên 1: cùng quốc gia
  if (countrySlug) {
    const countryResult = await getMoviesByCountry(countrySlug, 1, 24);
    addUniqueMovies(relatedMovies, countryResult.items || [], movie.slug);
  }

  // Ưu tiên 2: cùng thể loại
  if (categorySlug && relatedMovies.length < 18) {
    const categoryResult = await getMoviesByGenre(categorySlug, 1, 24);
    addUniqueMovies(relatedMovies, categoryResult.items || [], movie.slug);
  }

  // Ưu tiên 3: cùng năm, chỉ để bù thêm nếu chưa đủ
  if (year && relatedMovies.length < 18) {
    const yearResult = await getMoviesByYear(year, 1, 24);
    addUniqueMovies(relatedMovies, yearResult.items || [], movie.slug);
  }

  const movies = relatedMovies.slice(0, 18);

  if (movies.length === 0) {
    return null;
  }

  return (
    <section>
      <MovieGrid title="Có thể fen sẽ thích" movies={movies} />
    </section>
  );
}