import MovieGrid from "@/components/MovieGrid";
import Pagination from "@/components/Pagination";
import { getMoviesByList } from "@/lib/kkphim";

const typeNames: Record<string, string> = {
  "phim-bo": "Phim bộ",
  "phim-le": "Phim lẻ",
  "tv-shows": "TV Shows",
  "hoat-hinh": "Hoạt hình",
  "phim-vietsub": "Phim Vietsub",
  "phim-thuyet-minh": "Phim thuyết minh",
  "phim-long-tieng": "Phim lồng tiếng",
};

type PageProps = {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ page?: string }>;
};

export default async function ListPage({ params, searchParams }: PageProps) {
  const { type } = await params;
  const query = await searchParams;
  const page = Number(query.page || 1);

  const result = await getMoviesByList(type, page, 36);
  const totalPages = Number(result.pagination?.totalPages || 0);

  return (
    <div>
      <h1 className="mb-2 text-3xl font-black">
        {typeNames[type] || result.title}
      </h1>

      <p className="mb-4 text-slate-400">
        Danh sách phim đang được cập nhật từ KKPhim.
      </p>

      <MovieGrid title={result.title} movies={result.items} />

      <Pagination
        basePath={`/danh-sach/${type}`}
        currentPage={page}
        totalPages={totalPages}
        searchParams={query}
      />
    </div>
  );
}