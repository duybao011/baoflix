import Link from "next/link";
import MovieGrid from "@/components/MovieGrid";
import { getImageUrl, getLatestMovies, getMoviesByList } from "@/lib/kkphim";
import ContinueWatching from "@/components/ContinueWatching";

export default async function HomePage() {
  const [latest, phimBo, phimLe, hoatHinh] = await Promise.all([
    getLatestMovies(1),
    getMoviesByList("phim-bo", 1, 12),
    getMoviesByList("phim-le", 1, 12),
    getMoviesByList("hoat-hinh", 1, 12),
  ]);

  const hero = latest[0];

  return (
    <div>
      {hero && (
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5">
          <div className="absolute inset-0 opacity-35">
            <img
              src={getImageUrl(hero.poster_url || hero.thumb_url)}
              alt={hero.name}
              className="h-full w-full object-cover blur-sm"
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/20" />

          <div className="relative grid gap-8 p-6 md:grid-cols-[220px_1fr] md:p-10">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
              <img
                src={getImageUrl(hero.poster_url || hero.thumb_url)}
                alt={hero.name}
                className="aspect-[2/3] h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-col justify-center">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-red-400">
                Phim mới cập nhật
              </p>

              <h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
                {hero.name}
              </h1>

              <p className="mt-3 max-w-2xl text-slate-300">
                {hero.origin_name || "Xem phim nhanh, giao diện gọn, dành riêng cho fen."}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/phim/${hero.slug}`}
                  className="rounded-2xl bg-red-600 px-6 py-3 font-bold hover:bg-red-500"
                >
                  Xem chi tiết
                </Link>

                <Link
                  href="/tim-kiem"
                  className="rounded-2xl border border-white/15 bg-white/10 px-6 py-3 font-bold hover:bg-white/15"
                >
                  Tìm phim
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

	<ContinueWatching />

      <MovieGrid title="Mới cập nhật" movies={latest.slice(0, 18)} />
      <MovieGrid title="Phim bộ" movies={phimBo.items} />
      <MovieGrid title="Phim lẻ" movies={phimLe.items} />
      <MovieGrid title="Hoạt hình" movies={hoatHinh.items} />
    </div>
  );
}