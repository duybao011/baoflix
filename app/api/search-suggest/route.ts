import { NextResponse } from "next/server";
import { searchMovies } from "@/lib/kkphim";

const CDN_HEADERS = {
  // BAOFLIX_PERF_PHASE1: chỉ cache ở CDN Vercel, không ép browser giữ kết quả.
  "CDN-Cache-Control": "max-age=60, stale-while-revalidate=300",
};

function json(items: unknown[]) {
  return NextResponse.json({ items }, { headers: CDN_HEADERS });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("q")?.trim() || "";

  if (keyword.length < 3) return json([]);

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
    return json(items);
  } catch {
    return json([]);
  }
}
