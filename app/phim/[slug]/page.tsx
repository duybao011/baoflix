import Link from "next/link";
import { notFound } from "next/navigation";
import EpisodeServerList from "@/components/EpisodeServerList";
import MovieDetailActions from "@/components/MovieDetailActions";
import MovieDetailTabs from "@/components/MovieDetailTabs";
import RelatedMovies from "@/components/RelatedMovies";
import {
  getImageUrl,
  getMovieDetail,
  getPeopleList,
  stripHtml,
} from "@/lib/kkphim";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function InfoPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200">
      {children}
    </span>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-sm font-black text-white">{title}</h3>
      {children}
    </div>
  );
}

export default async function MovieDetailPage({ params }: PageProps) {
  const { slug } = await params;

  let data;

  try {
    data = await getMovieDetail(slug);
  } catch {
    notFound();
  }

  if (!data?.movie) {
    notFound();
  }

  const movie = data.movie;
  const servers = data.episodes ?? [];

  const actors = getPeopleList(movie.actor);
  const directors = getPeopleList(movie.director);

  const content = stripHtml(movie.content);

  const firstServerIndex = servers.findIndex(
    (server) => (server.server_data ?? []).length > 0
  );

  const firstWatchHref =
    firstServerIndex >= 0
      ? `/xem/${movie.slug}?server=${firstServerIndex}&tap=0`
      : "";

  const infoTab = (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="mb-4 text-2xl font-black">Thông tin phim</h2>

      <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
        {movie.origin_name && (
          <p>
            <span className="font-bold text-white">Tên gốc:</span>{" "}
            {movie.origin_name}
          </p>
        )}

        {movie.year && (
          <p>
            <span className="font-bold text-white">Năm:</span> {movie.year}
          </p>
        )}

        {movie.time && (
          <p>
            <span className="font-bold text-white">Thời lượng:</span>{" "}
            {movie.time}
          </p>
        )}

        {movie.episode_current && (
          <p>
            <span className="font-bold text-white">Tập hiện tại:</span>{" "}
            {movie.episode_current}
          </p>
        )}

        {movie.episode_total && (
          <p>
            <span className="font-bold text-white">Tổng tập:</span>{" "}
            {movie.episode_total}
          </p>
        )}

        {movie.quality && (
          <p>
            <span className="font-bold text-white">Chất lượng:</span>{" "}
            {movie.quality}
          </p>
        )}

        {movie.lang && (
          <p>
            <span className="font-bold text-white">Ngôn ngữ:</span> {movie.lang}
          </p>
        )}

        {movie.status && (
          <p>
            <span className="font-bold text-white">Trạng thái:</span>{" "}
            {movie.status}
          </p>
        )}
      </div>

      {movie.country && movie.country.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-black">Quốc gia</h3>

          <div className="flex flex-wrap gap-2">
            {movie.country.map((item) => (
              <InfoPill key={item.slug}>{item.name}</InfoPill>
            ))}
          </div>
        </div>
      )}

      {movie.category && movie.category.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-black">Thể loại</h3>

          <div className="flex flex-wrap gap-2">
            {movie.category.map((item) => (
              <InfoPill key={item.slug}>{item.name}</InfoPill>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-2 font-black">Nội dung</h3>

        <p className="whitespace-pre-line leading-7 text-slate-300">
          {content || "Chưa có mô tả."}
        </p>
      </div>
    </section>
  );

  const episodesTab = (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Tập phim</h2>

          <p className="mt-1 text-sm text-slate-400">
            Chọn bản chiếu hoặc tập phim để xem ngay.
          </p>
        </div>

        {firstWatchHref && (
          <Link
            href={firstWatchHref}
            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black hover:bg-red-500"
          >
            Xem ngay
          </Link>
        )}
      </div>

      <EpisodeServerList movieSlug={movie.slug} servers={servers} />
    </section>
  );

  const castTab = (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="mb-4 text-2xl font-black">Diễn viên & đạo diễn</h2>

      {actors.length > 0 ? (
        <div>
          <h3 className="mb-3 font-black">Diễn viên</h3>

          <div className="flex flex-wrap gap-2">
            {actors.map((actor) => (
              <span
                key={actor}
                className="rounded-full border border-yellow-300/20 bg-yellow-300/10 px-3 py-1 text-sm text-yellow-200"
              >
                {actor}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-slate-400">Chưa có dữ liệu diễn viên.</p>
      )}

      {directors.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 font-black">Đạo diễn</h3>

          <div className="flex flex-wrap gap-2">
            {directors.map((director) => (
              <span
                key={director}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300"
              >
                {director}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );

  const relatedTab = <RelatedMovies movie={movie} />;

return (
  <div
    data-tv-scope="movie-detail"
    data-tv-lock="true"
    data-tv-autofocus="true"
  >
      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#111521] shadow-2xl">
            <div className="p-5">
              <div className="overflow-hidden rounded-2xl bg-white/5">
                <img
                  src={getImageUrl(movie.poster_url || movie.thumb_url)}
                  alt={movie.name}
                  className="aspect-[2/3] w-full object-cover"
                />
              </div>

              <h1 className="mt-5 text-2xl font-black leading-tight">
                {movie.name}
              </h1>

              {movie.origin_name && (
                <p className="mt-1 text-sm font-bold text-yellow-300">
                  {movie.origin_name}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {movie.year && <InfoPill>{movie.year}</InfoPill>}
                {movie.quality && <InfoPill>{movie.quality}</InfoPill>}
                {movie.time && <InfoPill>{movie.time}</InfoPill>}
                {movie.lang && <InfoPill>{movie.lang}</InfoPill>}
              </div>

              <SidebarSection title="Giới thiệu">
                <p className="line-clamp-[10] text-sm leading-6 text-slate-300">
                  {content || "Chưa có mô tả."}
                </p>
              </SidebarSection>

              {movie.country && movie.country.length > 0 && (
                <SidebarSection title="Quốc gia">
                  <div className="flex flex-wrap gap-2">
                    {movie.country.map((item) => (
                      <InfoPill key={item.slug}>{item.name}</InfoPill>
                    ))}
                  </div>
                </SidebarSection>
              )}

              {movie.category && movie.category.length > 0 && (
                <SidebarSection title="Thể loại">
                  <div className="flex flex-wrap gap-2">
                    {movie.category.slice(0, 6).map((item) => (
                      <InfoPill key={item.slug}>{item.name}</InfoPill>
                    ))}
                  </div>
                </SidebarSection>
              )}

              {directors.length > 0 && (
                <SidebarSection title="Đạo diễn">
                  <p className="text-sm text-slate-300">
                    {directors.join(", ")}
                  </p>
                </SidebarSection>
              )}

              {actors.length > 0 && (
                <SidebarSection title="Diễn viên">
                  <div className="flex flex-wrap gap-2">
                    {actors.slice(0, 8).map((actor) => (
                      <span
                        key={actor}
                        className="rounded-full border border-yellow-300/20 bg-yellow-300/10 px-3 py-1 text-xs font-bold text-yellow-200"
                      >
                        {actor}
                      </span>
                    ))}
                  </div>
                </SidebarSection>
              )}
            </div>
          </section>
        </aside>

        <main>
          <MovieDetailActions movie={movie} servers={servers} />

          <MovieDetailTabs
            defaultTab="episodes"
            episodes={episodesTab}
            cast={castTab}
            related={relatedTab}
            info={infoTab}
          />
        </main>
      </div>
    </div>
  );
}