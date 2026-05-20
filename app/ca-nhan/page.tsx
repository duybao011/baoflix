"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { customMovieResponses } from "@/data/custom-movies";
import { deleteCustomMovie, readCustomMovies, StoredCustomMovie } from "@/lib/customMoviesClient";
import { getImageUrl } from "@/lib/kkphim";

function CustomMovieMiniCard({
  name,
  originName,
  poster,
  href,
  onDelete,
}: {
  name: string;
  originName?: string;
  poster?: string;
  href: string;
  onDelete?: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <Link href={href} className="block">
        <img
          src={getImageUrl(poster)}
          alt={name}
          className="aspect-[2/3] w-full object-cover"
        />

        <div className="p-3">
          <h3 className="line-clamp-2 text-sm font-bold">{name}</h3>
          <p className="line-clamp-1 text-xs text-slate-400">{originName}</p>
        </div>
      </Link>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute right-2 top-2 rounded-full bg-black/80 px-3 py-1 text-xs font-bold hover:bg-red-600"
        >
          Xóa
        </button>
      )}
    </div>
  );
}

export default function CustomMoviesPage() {
  const [localMovies, setLocalMovies] = useState<StoredCustomMovie[]>([]);

  useEffect(() => {
    setLocalMovies(readCustomMovies());
  }, []);

  function removeMovie(slug: string) {
    const next = deleteCustomMovie(slug);
    setLocalMovies(next);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Phim riêng</h1>
          <p className="mt-2 text-slate-400">
            Thư viện phim do fen tự thêm vào BảoFlix.
          </p>
        </div>

        <Link
          href="/ca-nhan/them"
          className="rounded-2xl bg-red-600 px-5 py-3 font-black hover:bg-red-500"
        >
          + Thêm phim
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="mb-5 text-2xl font-black">Phim trong code</h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {customMovieResponses.map((item) => (
            <CustomMovieMiniCard
              key={item.movie.slug}
              name={item.movie.name}
              originName={item.movie.origin_name}
              poster={item.movie.poster_url || item.movie.thumb_url}
              href={`/phim/${item.movie.slug}`}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-5 text-2xl font-black">Phim thêm bằng giao diện</h2>

        {localMovies.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-400">
            Chưa có phim nào được thêm bằng giao diện.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {localMovies.map((item) => (
              <CustomMovieMiniCard
                key={item.movie.slug}
                name={item.movie.name}
                originName={item.movie.origin_name}
                poster={item.movie.poster_url || item.movie.thumb_url}
                href={`/ca-nhan/${item.movie.slug}`}
                onDelete={() => removeMovie(item.movie.slug)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}