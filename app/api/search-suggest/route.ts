import { NextResponse } from "next/server";
import { searchMovies } from "@/lib/kkphim";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("q")?.trim() || "";

  if (keyword.length < 2) {
    return NextResponse.json({ items: [] });
  }

  try {
    const result = await searchMovies(keyword, 1, 8);

    const items = (result.items || []).slice(0, 8).map((movie) => ({
      _id: movie._id,
      name: movie.name,
      slug: movie.slug,
      origin_name: movie.origin_name,
      thumb_url: movie.thumb_url,
      poster_url: movie.poster_url,
      year: movie.year,
      episode_current: movie.episode_current,
      lang: movie.lang,
      quality: movie.quality,
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}