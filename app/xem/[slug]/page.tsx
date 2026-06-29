import Link from "next/link";
import LocalCustomMovieRouteSync from "@/components/LocalCustomMovieRouteSync";
import WatchClient from "@/components/WatchClient";
import { getMovieDetail } from "@/lib/kkphim";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    tap?: string;
    server?: string;
  }>;
};

function getFirstPlayableServerIndex(servers: Awaited<ReturnType<typeof getMovieDetail>>["episodes"]) {
  return servers.findIndex((server) => (server.server_data ?? []).length > 0);
}

export default async function WatchPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;

  const data = await getMovieDetail(slug);
  const servers = data.episodes ?? [];
  const firstPlayableServerIndex = getFirstPlayableServerIndex(servers);

  const rawServerIndex = Number(query.server || 0);
  const rawEpisodeIndex = Number(query.tap || 0);

  const requestedServerIsPlayable =
    !Number.isNaN(rawServerIndex) &&
    rawServerIndex >= 0 &&
    rawServerIndex < servers.length &&
    (servers[rawServerIndex]?.server_data ?? []).length > 0;

  const safeServerIndex = requestedServerIsPlayable
    ? rawServerIndex
    : Math.max(firstPlayableServerIndex, 0);

  const currentServer = servers[safeServerIndex];
  const episodes = currentServer?.server_data ?? [];

  const safeEpisodeIndex =
    Number.isNaN(rawEpisodeIndex) ||
    rawEpisodeIndex < 0 ||
    rawEpisodeIndex >= episodes.length
      ? 0
      : rawEpisodeIndex;

  if (!servers.length || firstPlayableServerIndex < 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <LocalCustomMovieRouteSync
          slug={slug}
          mode="watch"
          serverIndex={safeServerIndex}
          episodeIndex={safeEpisodeIndex}
        />

        <h1 className="text-2xl font-black">Chưa có tập để xem</h1>

        <p className="mt-2 text-slate-400">
          Phim này chưa có danh sách tập hoặc nguồn phát đang lỗi.
        </p>

        <Link
          href={`/phim/${slug}`}
          className="mt-5 inline-block rounded-2xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500"
        >
          Quay lại chi tiết phim
        </Link>
      </div>
    );
  }

  return (
    <>
      <LocalCustomMovieRouteSync
        slug={slug}
        mode="watch"
        serverIndex={safeServerIndex}
        episodeIndex={safeEpisodeIndex}
      />

      <WatchClient
        movie={data.movie}
        servers={servers}
        currentServerIndex={safeServerIndex}
        currentEpisodeIndex={safeEpisodeIndex}
      />
    </>
  );
}
