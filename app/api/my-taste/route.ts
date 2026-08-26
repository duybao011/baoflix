import { NextResponse } from "next/server";
import { getMoviesByCountry, getMoviesByGenre } from "@/lib/kkphim";

function uniqueMovies(items: any[]) {
  const map = new Map<string, any>();

  items.forEach((movie) => {
    if (!movie?.slug) return;
    if (!map.has(movie.slug)) {
      map.set(movie.slug, movie);
    }
  });

  return Array.from(map.values());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const country = searchParams.get("country") || "";
  const category = searchParams.get("category") || "";

  const results: any[] = [];

  try {
    if (country && category) {
      const combinedResult = await getMoviesByCountry(country, 1, 24, {
        category,
      });
      results.push(...(combinedResult.items || []));
    } else if (country) {
      const countryResult = await getMoviesByCountry(country, 1, 24);
      results.push(...(countryResult.items || []));
    } else if (category) {
      const categoryResult = await getMoviesByGenre(category, 1, 24);
      results.push(...(categoryResult.items || []));
    }

    return NextResponse.json({
      items: uniqueMovies(results).slice(0, 24),
    });
  } catch {
    return NextResponse.json({
      items: [],
    });
  }
}