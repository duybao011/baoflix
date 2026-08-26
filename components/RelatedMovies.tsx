import MovieGrid from "@/components/MovieGrid";
import {
  getMoviesByCountry,
  getMoviesByGenre,
  getMoviesByYear,
  MovieDetail,
  MovieItem,
  MovieListResult,
} from "@/lib/kkphim";

function addUniqueMovies(target: MovieItem[], source: MovieItem[], currentSlug: string) {
  const existingSlugs = new Set(target.map((movie) => movie.slug));
  source.forEach((movie) => {
    if (!movie?.slug || movie.slug === currentSlug || existingSlugs.has(movie.slug)) return;
    target.push(movie);
    existingSlugs.add(movie.slug);
  });
}

async function safeRelatedResult(label: string, loader: () => Promise<MovieListResult>) {
  try {
    return await loader();
  } catch (error) {
    console.warn("Lỗi lấy phim liên quan:", label, error);
    return null;
  }
}

export default async function RelatedMovies({ movie }: { movie: MovieDetail }) {
  const countrySlug = movie.country?.[0]?.slug;
  const categorySlug = movie.category?.[0]?.slug;
  const year = movie.year ? String(movie.year) : "";
  const relatedMovies: MovieItem[] = [];

  if (categorySlug && countrySlug) {
    const combined = await safeRelatedResult(`${categorySlug}+${countrySlug}`, () =>
      getMoviesByGenre(categorySlug, 1, 24, { country: countrySlug })
    );
    addUniqueMovies(relatedMovies, combined?.items || [], movie.slug);
  }

  if (relatedMovies.length < 18) {
    const [categoryResult, countryResult, yearResult] = await Promise.all([
      categorySlug
        ? safeRelatedResult(categorySlug, () => getMoviesByGenre(categorySlug, 1, 24))
        : Promise.resolve(null),
      countrySlug
        ? safeRelatedResult(countrySlug, () => getMoviesByCountry(countrySlug, 1, 24))
        : Promise.resolve(null),
      year
        ? safeRelatedResult(year, () => getMoviesByYear(year, 1, 24))
        : Promise.resolve(null),
    ]);

    addUniqueMovies(relatedMovies, categoryResult?.items || [], movie.slug);
    addUniqueMovies(relatedMovies, countryResult?.items || [], movie.slug);
    addUniqueMovies(relatedMovies, yearResult?.items || [], movie.slug);
  }

  const movies = relatedMovies.slice(0, 18);
  if (!movies.length) return null;

  return <section><MovieGrid title="Có thể fen sẽ thích" movies={movies} /></section>;
}
