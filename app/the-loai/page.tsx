import Link from "next/link";
import { getGenres } from "@/lib/kkphim";

export default async function GenresPage() {
  const genres = await getGenres();

  return (
    <div>
      <h1 className="mb-2 text-3xl font-black">Thể loại</h1>

      <p className="mb-6 text-slate-400">
        Chọn thể loại để xem danh sách phim tương ứng.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {genres.map((item) => (
          <Link
            key={item.slug}
            href={`/the-loai/${item.slug}`}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm hover:bg-white/10"
          >
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}