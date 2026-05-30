"use client";

import Link from "next/link";
import type { ReactNode, ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { customMovieResponses } from "@/data/custom-movies";
import {
  cloneCustomMovieResponseToLocal,
  deleteCustomMovie,
  exportCustomMoviesJson,
  importCustomMoviesJson,
  readCustomMovies,
  StoredCustomMovie,
} from "@/lib/customMoviesClient";
import { getImageUrl } from "@/lib/kkphim";

function CustomMovieMiniCard({
  name,
  originName,
  poster,
  href,
  badge,
  action,
  onDelete,
}: {
  name: string;
  originName?: string;
  poster?: string;
  href: string;
  badge?: string;
  action?: ReactNode;
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
          {badge && (
            <span className="mb-2 inline-block rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-200">
              {badge}
            </span>
          )}

          <h3 className="line-clamp-2 text-sm font-bold">{name}</h3>
          <p className="line-clamp-1 text-xs text-slate-400">{originName}</p>
        </div>
      </Link>

      {action && <div className="border-t border-white/10 p-2">{action}</div>}

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
  const [status, setStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLocalMovies(readCustomMovies());
  }, []);

  const localMovieSlugs = useMemo(() => {
    return new Set(localMovies.map((item) => item.movie.slug));
  }, [localMovies]);

  function removeMovie(slug: string) {
    const confirmed = window.confirm(
      "Xóa phim thêm bằng giao diện trên thiết bị này hả fen?"
    );

    if (!confirmed) return;

    const next = deleteCustomMovie(slug);
    setLocalMovies(next);
    setStatus("Đã xóa phim khỏi thư viện giao diện.");
  }

  function cloneBuiltInMovie(
    movieResponse: (typeof customMovieResponses)[number]
  ) {
    const next = cloneCustomMovieResponseToLocal(movieResponse);
    setLocalMovies(next);
    setStatus(
      `Đã đưa “${movieResponse.movie.name}” vào thư viện giao diện. Giờ fen có thể quản lý mùa/tập ngay trên web.`
    );
  }

  function downloadBackup() {
    const json = exportCustomMoviesJson();
    const blob = new Blob([json], {
      type: "application/json;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `baoflix-phim-rieng-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 500);
    setStatus("Đã xuất file backup phim riêng.");
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) return;

    try {
      const raw = await file.text();
      const next = importCustomMoviesJson(raw);
      setLocalMovies(next);
      setStatus(`Đã import ${next.length} phim riêng vào thiết bị này.`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Không import được file backup phim riêng."
      );
    } finally {
      event.currentTarget.value = "";
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Phim riêng</h1>
          <p className="mt-2 text-slate-400">
            Thư viện phim do fen tự thêm vào BảoFlix. Phim trong code có thể
            được copy sang đây để quản lý mùa/tập ngay trên web.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/ca-nhan/them"
            className="rounded-2xl bg-red-600 px-5 py-3 font-black hover:bg-red-500"
          >
            + Thêm phim
          </Link>

          <button
            type="button"
            onClick={downloadBackup}
            disabled={localMovies.length === 0}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Backup JSON
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10"
          >
            Import JSON
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={importBackup}
            className="hidden"
          />
        </div>
      </div>

      {status && (
        <div className="mb-6 rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm font-semibold text-yellow-100">
          {status}
        </div>
      )}

      <section className="mb-10">
        <h2 className="mb-2 text-2xl font-black">Phim trong code</h2>

        <p className="mb-5 text-sm leading-6 text-slate-400">
          Mấy phim này vẫn giữ nguyên như cũ. Muốn thêm tập ngay trên web thì
          bấm <b>Đưa vào giao diện</b>, app sẽ tạo một bản local để quản lý.
        </p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {customMovieResponses.map((item) => {
            const hasLocalVersion = localMovieSlugs.has(item.movie.slug);

            return (
              <CustomMovieMiniCard
                key={item.movie.slug}
                name={item.movie.name}
                originName={item.movie.origin_name}
                poster={item.movie.poster_url || item.movie.thumb_url}
                href={`/phim/${item.movie.slug}`}
                badge="Trong code"
                action={
                  hasLocalVersion ? (
                    <div className="grid gap-2">
                      <Link
                        href={`/ca-nhan/${item.movie.slug}`}
                        className="rounded-xl bg-yellow-300 px-3 py-2 text-center text-xs font-black text-black hover:bg-yellow-200"
                      >
                        Mở bản giao diện
                      </Link>

                      <Link
                        href={`/ca-nhan/${item.movie.slug}/quan-ly`}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-bold hover:bg-white/10"
                      >
                        Quản lý tập
                      </Link>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => cloneBuiltInMovie(item)}
                      className="w-full rounded-xl bg-red-600 px-3 py-2 text-xs font-black hover:bg-red-500"
                    >
                      Đưa vào giao diện
                    </button>
                  )
                }
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-2xl font-black">Phim thêm bằng giao diện</h2>

        <p className="mb-5 text-sm leading-6 text-slate-400">
          Các phim trong mục này lưu trên trình duyệt hiện tại bằng localStorage.
          Có thể thêm tập, thêm mùa, xóa tập và backup/import bằng JSON.
        </p>

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
                badge="Giao diện"
                action={
                  <Link
                    href={`/ca-nhan/${item.movie.slug}/quan-ly`}
                    className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-bold hover:bg-white/10"
                  >
                    Quản lý mùa / tập
                  </Link>
                }
                onDelete={() => removeMovie(item.movie.slug)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
