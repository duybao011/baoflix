import Link from "next/link";
import { getWebpImageUrl, MovieItem } from "@/lib/kkphim";

export default function MovieCard({ movie }: { movie: MovieItem }) {
  return (
    <Link
      href={`/phim/${movie.slug}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg transition hover:-translate-y-1 hover:bg-white/[0.07]"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-slate-900">
        <img
          src={getWebpImageUrl(movie.poster_url || movie.thumb_url)}
          alt={movie.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {movie.episode_current && (
          <div className="absolute left-2 top-2 rounded-full bg-red-600 px-3 py-1 text-xs font-bold">
            {movie.episode_current}
          </div>
        )}

        {movie.lang && (
          <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-3 py-1 text-xs">
            {movie.lang}
          </div>
        )}
      </div>

      <div className="space-y-1 p-3">
        <h3 className="line-clamp-2 text-sm font-bold text-white group-hover:text-red-300">
          {movie.name}
        </h3>

        <p className="line-clamp-1 text-xs text-slate-400">
          {movie.origin_name || "Đang cập nhật"}
        </p>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{movie.year || "N/A"}</span>
          <span>{movie.quality || "HD"}</span>
        </div>
      </div>
    </Link>
  );
}