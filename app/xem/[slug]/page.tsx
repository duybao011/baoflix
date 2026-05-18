import WatchClient from "@/components/WatchClient";
import { getMovieDetail } from "@/lib/kkphim";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tap?: string; server?: string }>;
};

export default async function WatchPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;

  const data = await getMovieDetail(slug);
  const servers = data.episodes ?? [];

  const rawServerIndex = Number(query.server || 0);
  const rawEpisodeIndex = Number(query.tap || 0);

  const safeServerIndex =
    Number.isNaN(rawServerIndex) ||
    rawServerIndex < 0 ||
    rawServerIndex >= servers.length
      ? 0
      : rawServerIndex;

  const currentServer = servers[safeServerIndex];
  const episodes = currentServer?.server_data ?? [];

  const safeEpisodeIndex =
    Number.isNaN(rawEpisodeIndex) ||
    rawEpisodeIndex < 0 ||
    rawEpisodeIndex >= episodes.length
      ? 0
      : rawEpisodeIndex;

  return (
    <WatchClient
      movie={data.movie}
      servers={servers}
      currentServerIndex={safeServerIndex}
      currentEpisodeIndex={safeEpisodeIndex}
    />
  );
}