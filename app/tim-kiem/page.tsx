import Link from "next/link";
import MovieGrid from "@/components/MovieGrid";
import Pagination from "@/components/Pagination";
import { searchMovies, smartFilterMoviesByKeyword } from "@/lib/kkphim";
import SearchHistoryRecorder from "@/components/SearchHistoryRecorder";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    mode?: string;
  }>;
};

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const keyword = params.q?.trim() || "";
  const page = Number(params.page || 1);
  const mode = params.mode || "smart";

  if (!keyword) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-black">Tìm kiếm phim</h1>
        <p className="mt-3 text-slate-400">
          Nhập tên phim vào ô tìm kiếm phía trên để bắt đầu.
        </p>
      </section>
    );
  }

  const result = await searchMovies(keyword, page, 64);

  const movies =
    mode === "wide"
      ? result.items
      : smartFilterMoviesByKeyword(result.items, keyword);

  const totalPages = Number(result.pagination?.totalPages || 0);

  return (
    <div>
	<SearchHistoryRecorder keyword={keyword} />
      <h1 className="mb-2 text-3xl font-black">Kết quả tìm kiếm</h1>

      <p className="mb-4 text-slate-400">
        Từ khóa: {keyword}
      </p>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href={`/tim-kiem?q=${encodeURIComponent(keyword)}&mode=smart`}
          className={[
            "rounded-2xl border px-4 py-2 text-sm font-bold",
            mode !== "wide"
              ? "border-red-500 bg-red-600 text-white"
              : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
          ].join(" ")}
        >
          Tìm chính xác hơn
        </Link>

        <Link
          href={`/tim-kiem?q=${encodeURIComponent(keyword)}&mode=wide`}
          className={[
            "rounded-2xl border px-4 py-2 text-sm font-bold",
            mode === "wide"
              ? "border-red-500 bg-red-600 text-white"
              : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
          ].join(" ")}
        >
          Tìm rộng
        </Link>
      </div>

      {mode !== "wide" && result.items.length > movies.length && (
        <div className="mb-6 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm text-yellow-100">
          Đã lọc bớt {result.items.length - movies.length} kết quả không khớp sát với từ khóa.
          Bấm “Tìm rộng” nếu fen muốn xem toàn bộ kết quả từ KKPhim.
        </div>
      )}

      <MovieGrid title={result.title} movies={movies} />

      {mode === "wide" && (
        <Pagination
          basePath="/tim-kiem"
          currentPage={page}
          totalPages={totalPages}
          searchParams={{
            q: keyword,
            mode,
          }}
        />
      )}
    </div>
  );
}