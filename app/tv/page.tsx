import Link from "next/link";
import TvDashboard from "@/components/TvDashboard";
import TvModeSession from "@/components/TvModeSession";
import { getFilteredMovies, getImageUrl } from "@/lib/kkphim";

export default async function TvPage() {
  const [chineseSeriesResult, dubbedChineseSeriesResult] = await Promise.all([
    getFilteredMovies({
      type: "phim-bo",
      country: "trung-quoc",
      page: 1,
      limit: 12,
    }),
    getFilteredMovies({
      type: "phim-bo",
      country: "trung-quoc",
      sort_lang: "long-tieng",
      sort_field: "year",
      sort_type: "desc",
      page: 1,
      limit: 12,
    }),
  ]);

  return (
    <>
      <TvModeSession />
      <TvDashboard chineseSeries={chineseSeriesResult.items} />

      {dubbedChineseSeriesResult.items.length > 0 && (
        <section className="baoflix-tv-page mt-10 rounded-[2rem] border border-yellow-300/20 bg-yellow-300/10 p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-200">
                Lối tắt mới
              </p>

              <h2 className="mt-1 text-3xl font-black">
                Phim bộ Trung Quốc lồng tiếng
              </h2>

              <p className="mt-1 text-sm text-slate-300">
                Sắp theo năm mới nhất, mở nhanh bằng remote.
              </p>
            </div>

            <Link
              href="/loc?type=phim-bo&country=trung-quoc&sort_lang=long-tieng&sort_field=year&sort_type=desc"
              className="rounded-2xl bg-yellow-300 px-5 py-3 text-sm font-black text-black hover:bg-yellow-200"
            >
              Xem tất cả
            </Link>
          </div>

          <div data-tv-row className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {dubbedChineseSeriesResult.items.slice(0, 12).map((movie) => (
              <Link
                key={movie.slug}
                href={`/phim/${movie.slug}`}
                className="group block overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/25 p-3 transition hover:border-yellow-300/70 hover:bg-white/[0.08] focus-visible:scale-[1.03] focus-visible:border-yellow-300 focus-visible:bg-white/[0.08]"
              >
                <div className="overflow-hidden rounded-2xl bg-white/5">
                  <img
                    src={getImageUrl(movie.poster_url || movie.thumb_url)}
                    alt={movie.name}
                    className="aspect-[2/3] w-full object-cover transition group-hover:scale-105 group-focus-visible:scale-105"
                  />
                </div>

                <h3 className="mt-3 line-clamp-2 text-sm font-black text-white md:text-base">
                  {movie.name}
                </h3>

                <p className="mt-1 line-clamp-1 text-xs font-bold text-yellow-200">
                  {movie.lang || "Lồng tiếng"}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {movie.year || "Năm mới"} • {movie.episode_current || "Phim bộ"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
