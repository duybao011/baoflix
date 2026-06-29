import Link from "next/link";
import TvDashboard from "@/components/TvDashboard";
import TvModeSession from "@/components/TvModeSession";
import { getFilteredMovies, getImageUrl } from "@/lib/kkphim";

const TV_CARD_FOCUS_CLASS =
  "focus-visible:-translate-y-0.5 focus-visible:scale-[1.025] focus-visible:border-yellow-300 focus-visible:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

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
        <section className="baoflix-tv-page mt-6 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-200">
                Lối tắt mới
              </p>

              <h2 className="mt-1 text-xl font-black min-[1280px]:text-2xl">
                Phim bộ Trung Quốc lồng tiếng
              </h2>

              <p className="mt-0.5 text-xs text-slate-300">
                Sắp theo năm mới nhất, mở nhanh bằng remote.
              </p>
            </div>

            <Link
              href="/loc?type=phim-bo&country=trung-quoc&sort_lang=long-tieng&sort_field=year&sort_type=desc"
              className={[
                "rounded-xl bg-yellow-300 px-4 py-2 text-xs font-black text-black hover:bg-yellow-200",
                TV_CARD_FOCUS_CLASS,
              ].join(" ")}
            >
              Xem tất cả
            </Link>
          </div>

          <div data-tv-row data-tv-row-wrap="true" className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
            {dubbedChineseSeriesResult.items.slice(0, 16).map((movie) => (
              <Link
                key={movie.slug}
                href={`/phim/${movie.slug}`}
                data-tv-focus-key={`tv-dubbed:${movie.slug}`}
                className={[
                  "group block overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-2 transition hover:border-yellow-300/70 hover:bg-white/[0.08]",
                  TV_CARD_FOCUS_CLASS,
                ].join(" ")}
              >
                <div className="overflow-hidden rounded-xl bg-white/5">
                  <img
                    src={getImageUrl(movie.poster_url || movie.thumb_url)}
                    alt={movie.name}
                    className="aspect-[2/3] w-full object-cover transition group-hover:scale-105 group-focus-visible:scale-105"
                  />
                </div>

                <h3 className="mt-2 line-clamp-2 text-[12px] font-black leading-tight text-white min-[1280px]:text-[13px]">
                  {movie.name}
                </h3>

                <p className="mt-0.5 line-clamp-1 text-[10px] font-bold text-yellow-200">
                  {movie.lang || "Lồng tiếng"}
                </p>

                <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
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
