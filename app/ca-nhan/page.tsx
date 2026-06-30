"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  deleteCustomMovie,
  exportCustomMoviesJson,
  importCustomMoviesJson,
  readCustomMovies,
  StoredCustomMovie,
} from "@/lib/customMoviesClient";
import { getImageUrl } from "@/lib/kkphim";

const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

function CustomMovieMiniCard({
  name,
  originName,
  poster,
  href,
  badge,
  onDelete,
}: {
  name: string;
  originName?: string;
  poster?: string;
  href: string;
  badge?: string;
  onDelete?: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <Link
        href={href}
        prefetch={false}
        data-tv-focus-key={`custom-card:${href}`}
        className={["block rounded-2xl", TV_FOCUS_CLASS].join(" ")}
      >
        <img
          src={getImageUrl(poster)}
          alt={name}
          className="aspect-[2/3] w-full object-cover"
          loading="lazy"
          decoding="async"
        />

        <div className="p-3">
          {badge && (
            <span className="mb-2 inline-block rounded-full bg-yellow-300 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black">
              {badge}
            </span>
          )}

          <h3 className="line-clamp-2 text-sm font-bold">{name}</h3>
          <p className="line-clamp-1 text-xs text-slate-400">{originName}</p>
        </div>
      </Link>

      <div data-tv-row className="grid gap-2 border-t border-white/10 p-2">
        <Link
          href={`${href}/quan-ly`}
          prefetch={false}
          data-tv-focus-key={`custom-manage:${href}`}
          className={[
            "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-bold hover:bg-white/10",
            TV_FOCUS_CLASS,
          ].join(" ")}
        >
          Quản lý mùa / tập
        </Link>

        <Link
          href={`${href}/sua`}
          prefetch={false}
          data-tv-focus-key={`custom-edit:${href}`}
          className={[
            "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-bold hover:bg-white/10",
            TV_FOCUS_CLASS,
          ].join(" ")}
        >
          Sửa thông tin
        </Link>
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          data-tv-skip
          tabIndex={-1}
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

  function removeMovie(slug: string) {
    const confirmed = window.confirm(
      "Xóa phim riêng này khỏi thiết bị hiện tại hả fen?"
    );

    if (!confirmed) return;

    const next = deleteCustomMovie(slug);
    setLocalMovies(next);
    setStatus("Đã xóa phim khỏi thư viện phim riêng.");
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
    <div
      data-tv-scope="custom-page"
      data-tv-lock="true"
      data-tv-autofocus="true"
      className="baoflix-tv-page"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Phim riêng</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Thư viện phim được thêm và quản lý bằng giao diện trên thiết bị này.
          </p>
        </div>

        <div data-tv-row data-tv-row-wrap="true" className="flex flex-wrap gap-2">
          <Link
            href="/ca-nhan/them"
            prefetch={false}
            data-tv-default
            data-tv-focus-key="custom:add"
            className={[
              "rounded-2xl bg-red-600 px-5 py-3 font-black hover:bg-red-500",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            + Thêm phim
          </Link>

          <button
            type="button"
            onClick={downloadBackup}
            disabled={localMovies.length === 0}
            data-tv-focus-key="custom:backup"
            className={[
              "rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            Backup JSON
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-tv-focus-key="custom:import"
            className={[
              "rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10",
              TV_FOCUS_CLASS,
            ].join(" ")}
          >
            Import JSON
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={importBackup}
            className="hidden"
            data-tv-skip
            tabIndex={-1}
          />
        </div>
      </div>

      {status && (
        <div className="mb-6 rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm font-semibold text-yellow-100">
          {status}
        </div>
      )}

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Thư viện phim riêng</h2>
            <p className="mt-1 text-sm text-slate-400">
              {localMovies.length} phim đang lưu trên trình duyệt hiện tại.
            </p>
          </div>

          {localMovies.length > 0 && (
            <Link
              href="/ca-nhan/them"
              prefetch={false}
              data-tv-focus-key="custom:add-more"
              className={[
                "rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10",
                TV_FOCUS_CLASS,
              ].join(" ")}
            >
              Thêm phim khác
            </Link>
          )}
        </div>

        {localMovies.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h3 className="text-xl font-black">Chưa có phim riêng nào</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Bấm <b>+ Thêm phim</b> để tạo phim mới bằng giao diện. Nếu đã có
              backup JSON từ máy khác hoặc từ bản cũ, dùng <b>Import JSON</b> để
              khôi phục thư viện.
            </p>

            <div data-tv-row className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/ca-nhan/them"
                prefetch={false}
                data-tv-focus-key="custom:first-add"
                className={[
                  "rounded-2xl bg-red-600 px-5 py-3 font-black hover:bg-red-500",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                + Thêm phim đầu tiên
              </Link>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-tv-focus-key="custom:first-import"
                className={[
                  "rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10",
                  TV_FOCUS_CLASS,
                ].join(" ")}
              >
                Import JSON
              </button>
            </div>
          </div>
        ) : (
          <div
            data-tv-row
            data-tv-row-wrap="true"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
          >
            {localMovies.map((item) => (
              <CustomMovieMiniCard
                key={item.movie.slug}
                name={item.movie.name}
                originName={item.movie.origin_name}
                poster={item.movie.poster_url || item.movie.thumb_url}
                href={`/ca-nhan/${item.movie.slug}`}
                badge="Giao diện"
                onDelete={() => removeMovie(item.movie.slug)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
