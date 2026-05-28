"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FavoriteButton from "@/components/FavoriteButton";
import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";
import { readWatchHistory, type WatchHistoryItem } from "@/lib/watchStore";

type Props = {
  movie: MovieDetail;
  servers: EpisodeServer[];
};

function getFirstWatchHref(movieSlug: string, servers: EpisodeServer[]) {
  const firstServerIndex = servers.findIndex(
    (server) => (server.server_data ?? []).length > 0
  );

  if (firstServerIndex < 0) return "";

  return `/xem/${movieSlug}?server=${firstServerIndex}&tap=0`;
}

function getLatestWatchHref(movieSlug: string, servers: EpisodeServer[]) {
  let bestServerIndex = -1;
  let bestEpisodeIndex = -1;
  let bestEpisodeCount = 0;

  servers.forEach((server, serverIndex) => {
    const episodes = server.server_data ?? [];

    if (episodes.length > bestEpisodeCount) {
      bestServerIndex = serverIndex;
      bestEpisodeIndex = episodes.length - 1;
      bestEpisodeCount = episodes.length;
    }
  });

  if (bestServerIndex < 0 || bestEpisodeIndex < 0) return "";

  return `/xem/${movieSlug}?server=${bestServerIndex}&tap=${bestEpisodeIndex}`;
}

function getLatestEpisodeLabel(servers: EpisodeServer[]) {
  let bestName = "";
  let bestEpisodeCount = 0;

  servers.forEach((server) => {
    const episodes = server.server_data ?? [];

    if (episodes.length > bestEpisodeCount) {
      bestEpisodeCount = episodes.length;
      bestName = episodes[episodes.length - 1]?.name || "";
    }
  });

  return bestName;
}

export default function MovieDetailActions({ movie, servers }: Props) {
  const [historyItem, setHistoryItem] = useState<WatchHistoryItem | null>(null);

  useEffect(() => {
    function refresh() {
      const history = readWatchHistory();

      const found =
        history.find(
          (item) => item.slug === movie.slug && !Boolean(item.isCustom)
        ) || null;

      setHistoryItem(found);
    }

    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [movie.slug]);

  const firstHref = useMemo(
    () => getFirstWatchHref(movie.slug, servers),
    [movie.slug, servers]
  );

  const latestHref = useMemo(
    () => getLatestWatchHref(movie.slug, servers),
    [movie.slug, servers]
  );

  const latestEpisodeLabel = useMemo(
    () => getLatestEpisodeLabel(servers),
    [servers]
  );

  const continueHref = historyItem?.href || "";
  const hasLatestDifferentFromFirst = latestHref && latestHref !== firstHref;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div data-tv-row className="flex flex-wrap items-center gap-3">
        {continueHref ? (
          <Link
            href={continueHref}
            data-tv-default
            className="rounded-2xl bg-yellow-300 px-6 py-3 font-black text-black hover:bg-yellow-200"
          >
            ▶ Xem tiếp
          </Link>
        ) : firstHref ? (
          <Link
            href={firstHref}
            data-tv-default
            className="rounded-2xl bg-yellow-300 px-6 py-3 font-black text-black hover:bg-yellow-200"
          >
            ▶ Xem ngay
          </Link>
        ) : (
          <button
            disabled
            className="rounded-2xl bg-white/10 px-6 py-3 font-black text-white opacity-50"
          >
            Chưa có tập
          </button>
        )}

        {firstHref && (
          <Link
            href={firstHref}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white hover:bg-white/10"
          >
            Tập đầu
          </Link>
        )}

        {hasLatestDifferentFromFirst && (
          <Link
            href={latestHref}
            className="rounded-2xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-500"
          >
            Tập mới nhất
          </Link>
        )}

        <FavoriteButton movie={movie} />
      </div>

      {historyItem && (
        <div className="mt-4 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4">
          <p className="text-sm font-bold text-yellow-200">
            Xem tiếp: {historyItem.episodeName || "Tập đang xem"}
          </p>

          {historyItem.serverName && (
            <p className="mt-1 text-xs text-slate-400">
              Nguồn: {historyItem.serverName}
            </p>
          )}
        </div>
      )}

      {hasLatestDifferentFromFirst && latestEpisodeLabel && (
        <p className="mt-3 text-xs text-slate-500">
          Tập mới nhất hiện có: {latestEpisodeLabel}
        </p>
      )}
    </section>
  );
}