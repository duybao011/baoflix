import Link from "next/link";
import { notFound } from "next/navigation";
import MovieGrid from "@/components/MovieGrid";
import { getActorBySlug } from "@/data/actors";
import { searchMovies, MovieItem } from "@/lib/kkphim";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function uniqueMovies(movies: MovieItem[]) {
  const map = new Map<string, MovieItem>();

  movies.forEach((movie) => {
    if (!movie?.slug) return;
    if (!map.has(movie.slug)) {
      map.set(movie.slug, movie);
    }
  });

  return Array.from(map.values());
}

export default async function ActorDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const actor = getActorBySlug(slug);

  if (!actor) {
    notFound();
  }

  const results = await Promise.allSettled(
    actor.works.flatMap((work) =>
      work.keywords.map((keyword) => searchMovies(keyword, 1, 8))
    )
  );

  const movies = uniqueMovies(
    results.flatMap((result) => {
      if (result.status !== "fulfilled") return [];
      return result.value.items || [];
    })
  );

  return (
    <div>
      <Link
        href="/dien-vien"
        className="text-sm text-red-300 hover:text-red-200"
      >
        ← Quay lại danh sách diễn viên
      </Link>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-4xl font-black">{actor.name}</h1>

        {actor.koreanName && (
          <p className="mt-2 text-lg text-slate-400">{actor.koreanName}</p>
        )}

        <p className="mt-4 max-w-3xl leading-7 text-slate-300">
          {actor.description}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {actor.aliases.map((alias) => (
            <span
              key={alias}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300"
            >
              {alias}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-5">
        <h2 className="text-xl font-black text-yellow-200">
          Lưu ý về kết quả
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          Đây là kết quả tìm theo tên tác phẩm trên KKPhim, không phải lọc diễn
          viên chính thức từ API. Nếu thấy phim sai, chỉ cần bỏ keyword đó hoặc
          tự thêm slug chuẩn vào dữ liệu sau.
        </p>
      </section>

      <MovieGrid title={`Kết quả liên quan đến ${actor.name}`} movies={movies} />

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-xl font-black">Tác phẩm đang dùng để tìm</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {actor.works.map((work) => (
            <div
              key={work.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <h3 className="font-black">{work.title}</h3>

              {work.year && (
                <p className="mt-1 text-sm text-slate-400">Năm: {work.year}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {work.keywords.map((keyword) => (
                  <Link
                    key={keyword}
                    href={`/tim-kiem?q=${encodeURIComponent(keyword)}`}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-white/10"
                  >
                    {keyword}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}