"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getCustomMovieBySlugClient,
  StoredCustomMovie,
} from "@/lib/customMoviesClient";

function buildCustomMovieObjectCode(movieData: StoredCustomMovie) {
  const cleanObject = {
    movie: movieData.movie,
    episodes: movieData.episodes,
  };

  return JSON.stringify(cleanObject, null, 2);
}

function buildFullFileExample(movieCode: string) {
  return `export const customMovieResponses = [
  ${movieCode}
];

export function getCustomMovieBySlug(slug: string) {
  return customMovieResponses.find((item) => item.movie.slug === slug);
}

export function getCustomMovieItems() {
  return customMovieResponses.map((item) => item.movie);
}
`;
}

export default function ExportCustomMovieCode({ slug }: { slug: string }) {
  const [movieData, setMovieData] = useState<StoredCustomMovie | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"object" | "full">("object");

  useEffect(() => {
    setMovieData(getCustomMovieBySlugClient(slug) || null);
  }, [slug]);

  const objectCode = useMemo(() => {
    if (!movieData) return "";
    return buildCustomMovieObjectCode(movieData);
  }, [movieData]);

  const fullFileCode = useMemo(() => {
    if (!objectCode) return "";
    return buildFullFileExample(objectCode);
  }, [objectCode]);

  const code = mode === "object" ? objectCode : fullFileCode;

  async function copyCode() {
    if (!code) return;

    await navigator.clipboard.writeText(code);
    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1600);
  }

  function downloadCode() {
    if (!code || !movieData) return;

    const blob = new Blob([code], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download =
      mode === "object"
        ? `${movieData.movie.slug}-custom-movie-object.txt`
        : `custom-movies.ts.txt`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  if (!movieData) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h1 className="text-2xl font-black">Không tìm thấy phim riêng</h1>

        <p className="mt-2 text-slate-400">
          Phim này có thể chưa được lưu trên thiết bị hiện tại.
        </p>

        <Link
          href="/ca-nhan"
          className="mt-5 inline-block rounded-2xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500"
        >
          Quay lại phim riêng
        </Link>
      </section>
    );
  }

  return (
    <div>
      <Link href={`/ca-nhan/${movieData.movie.slug}`} className="text-sm text-red-300">
        ← Quay lại phim
      </Link>

      <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h1 className="text-3xl font-black">Xuất phim riêng thành code</h1>

        <p className="mt-2 text-slate-400">
          Phim: <span className="font-bold text-white">{movieData.movie.name}</span>
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("object")}
            className={[
              "rounded-xl border px-4 py-2 text-sm font-bold",
              mode === "object"
                ? "border-yellow-300 bg-yellow-300 text-black"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
            ].join(" ")}
          >
            Chỉ object phim
          </button>

          <button
            type="button"
            onClick={() => setMode("full")}
            className={[
              "rounded-xl border px-4 py-2 text-sm font-bold",
              mode === "full"
                ? "border-yellow-300 bg-yellow-300 text-black"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
            ].join(" ")}
          >
            Full file mẫu
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm text-yellow-100">
          {mode === "object" ? (
            <p>
              Copy đoạn object này rồi dán vào mảng{" "}
              <b>customMovieResponses</b> trong file{" "}
              <b>data/custom-movies.ts</b>. Nếu trong mảng đã có phim khác, nhớ
              thêm dấu phẩy giữa các object.
            </p>
          ) : (
            <p>
              Đây là bản full file mẫu. Chỉ dùng khi fen muốn thay toàn bộ file{" "}
              <b>data/custom-movies.ts</b>. Nếu đang có phim cũ như Sabakan thì
              đừng dùng chế độ này để ghi đè mất phim cũ.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copyCode}
            className="rounded-2xl bg-red-600 px-5 py-3 font-black hover:bg-red-500"
          >
            {copied ? "Đã copy ✓" : "Copy code"}
          </button>

          <button
            type="button"
            onClick={downloadCode}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10"
          >
            Tải file .txt
          </button>
        </div>

        <textarea
          value={code}
          readOnly
          spellCheck={false}
          className="mt-5 h-[520px] w-full rounded-2xl border border-white/10 bg-[#070a12] p-4 font-mono text-sm text-slate-200 outline-none"
        />
      </section>
    </div>
  );
}