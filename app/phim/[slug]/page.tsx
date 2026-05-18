import FavoriteButton from "@/components/FavoriteButton";
import EpisodeServerList from "@/components/EpisodeServerList";
import MovieDetailTabs from "@/components/MovieDetailTabs";
import RelatedMovies from "@/components/RelatedMovies";
import {
  getImageUrl,
  getMovieDetail,
  stripHtml,
  getPeopleList,
} from "@/lib/kkphim";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function MovieDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getMovieDetail(slug);

  const movie = data.movie;
  const servers = data.episodes ?? [];

  const actors = getPeopleList(movie.actor);
  const directors = getPeopleList(movie.director);

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
            <span className="font-bold text-white">Ngôn ngữ:</span>{" "}
            {movie.lang}
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
              <span
                key={item.slug}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300"
              >
                {item.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {movie.category && movie.category.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-black">Thể loại</h3>

          <div className="flex flex-wrap gap-2">
            {movie.category.map((item) => (
              <span
                key={item.slug}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300"
              >
                {item.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-2 font-black">Nội dung</h3>

        <p className="max-w-4xl leading-7 text-slate-300">
          {stripHtml(movie.content) || "Chưa có mô tả."}
        </p>
      </div>
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
        <p className="text-slate-400">
          API chưa có dữ liệu diễn viên cho phim này.
        </p>
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

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <aside>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <img
            src={getImageUrl(movie.poster_url || movie.thumb_url)}
            alt={movie.name}
            className="aspect-[2/3] w-full object-cover"
          />
        </div>

        <div className="mt-4">
          <FavoriteButton movie={movie} />
        </div>
      </aside>

      <section>
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-red-400">
          {movie.episode_current || "Đang cập nhật"}
        </p>

        <h1 className="text-4xl font-black md:text-5xl">{movie.name}</h1>

        <p className="mt-2 text-lg text-slate-400">{movie.origin_name}</p>

        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          {movie.year && (
            <span className="rounded-full bg-white/10 px-3 py-1">
              {movie.year}
            </span>
          )}

          {movie.quality && (
            <span className="rounded-full bg-white/10 px-3 py-1">
              {movie.quality}
            </span>
          )}

          {movie.lang && (
            <span className="rounded-full bg-white/10 px-3 py-1">
              {movie.lang}
            </span>
          )}

          {movie.time && (
            <span className="rounded-full bg-white/10 px-3 py-1">
              {movie.time}
            </span>
          )}
        </div>

        <MovieDetailTabs
          info={infoTab}
          episodes={<EpisodeServerList movieSlug={movie.slug} servers={servers} />}
          cast={castTab}
          related={<RelatedMovies movie={movie} />}
        />
      </section>
    </div>
  );
}