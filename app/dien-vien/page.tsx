import Link from "next/link";
import { actors } from "@/data/actors";

export default function ActorsPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-black">Diễn viên</h1>

      <p className="mb-6 text-slate-400">
        Danh sách diễn viên được lưu thủ công trong app cá nhân.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {actors.map((actor) => (
          <Link
            key={actor.slug}
            href={`/dien-vien/${actor.slug}`}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10"
          >
            <h2 className="text-2xl font-black">{actor.name}</h2>

            {actor.koreanName && (
              <p className="mt-1 text-slate-400">{actor.koreanName}</p>
            )}

            <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">
              {actor.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {actor.aliases.map((alias) => (
                <span
                  key={alias}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                >
                  {alias}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}