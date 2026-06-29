import Link from "next/link";
import MovieGrid from "@/components/MovieGrid";
import ContinueWatching from "@/components/ContinueWatching";
import PersonalDashboard from "@/components/PersonalDashboard";
import { getImageUrl, getLatestMovies, getMoviesByList } from "@/lib/kkphim";

export const revalidate = 1800;
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
              src={getImageUrl(hero.thumb_url || hero.poster_url)}
              alt=""
              aria-hidden="true"
              decoding="async"
              className="h-full w-full object-cover blur-sm"
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/25" />

          <div className="relative grid gap-5 p-5 md:grid-cols-[220px_1fr] md:gap-8 md:p-10">
            <div className="hidden overflow-hidden rounded-3xl border border-white/10 bg-black/30 md:block">
              <img
                src={getImageUrl(hero.poster_url || hero.thumb_url)}
                alt={hero.name}
                className="aspect-[2/3] h-full w-full object-cover"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </div>

            <div className="flex min-h-[230px] flex-col justify-end py-2 md:min-h-0 md:justify-center md:py-0">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-red-400 md:mb-3 md:text-sm md:tracking-[0.3em]">
                BảoFlix
              </p>

              <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-4xl md:text-6xl">
                {hero.name}
              </h1>

              <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-slate-300 md:mt-3 md:text-base">
                {hero.origin_name || "App xem phim cá nhân của fen."}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap md:mt-6">
                <Link
                  href={`/phim/${hero.slug}`}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-center text-sm font-black hover:bg-red-500 md:px-6 md:text-base"
                >
                  Xem chi tiết
                </Link>

                <Link
                  href="/loc"
                  className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center text-sm font-black hover:bg-white/15 md:px-6 md:text-base"
                >
                  Bộ lọc
                </Link>

                <Link
                  href="/ca-nhan"
                  className="col-span-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center text-sm font-black hover:bg-white/15 sm:col-span-1 md:px-6 md:text-base"
                >
                  Phim riêng
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <PersonalDashboard />

      <ContinueWatching />
      <MovieGrid title="Phim bộ" href="/danh-sach/phim-bo" movies={phimBo.items} />
      <MovieGrid title="Phim lẻ" href="/danh-sach/phim-le" movies={phimLe.items} />
      <MovieGrid title="Hoạt hình" href="/danh-sach/hoat-hinh" movies={hoatHinh.items} />
    </div>
  );
}
