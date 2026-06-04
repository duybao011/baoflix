"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FavoriteButton from "@/components/FavoriteButton";
import type { EpisodeServer, MovieDetail } from "@/lib/kkphim";
import {
  getNormalWatchedKey,
  readWatchHistory,
  readWatchedEpisodes,
  type WatchHistoryItem,
} from "@/lib/watchStore";

type Props = {
  movie: MovieDetail;
  servers: EpisodeServer[];
};

type LatestEpisodeInfo = {
  href: string;
  label: string;
  serverIndex: number;
  episodeIndex: number;
  totalEpisodes: number;
};

function getFirstWatchHref(movieSlug: string, servers: EpisodeServer[]) {
  const firstServerIndex = servers.findIndex(
    (server) => (server.server_data ?? []).length > 0
  );

  if (firstServerIndex < 0) return "";

  return `/xem/${movieSlug}?server=${firstServerIndex}&tap=0`;
}

function getLatestEpisodeInfo(
  movieSlug: string,
  servers: EpisodeServer[]
): LatestEpisodeInfo | null {
  let bestServerIndex = -1;
  let bestEpisodeIndex = -1;
  let bestEpisodeCount = 0;
  let bestEpisodeLabel = "";

  servers.forEach((server, serverIndex) => {
    const episodes = server.server_data ?? [];

    if (episodes.length > bestEpisodeCount) {
      bestServerIndex = serverIndex;
      bestEpisodeIndex = episodes.length - 1;
      bestEpisodeCount = episodes.length;
      bestEpisodeLabel = episodes[bestEpisodeIndex]?.name || "Tập mới nhất";
    }
  });

  if (bestServerIndex < 0 || bestEpisodeIndex < 0) return null;

  return {
    href: `/xem/${movieSlug}?server=${bestServerIndex}&tap=${bestEpisodeIndex}`,
    label: bestEpisodeLabel,
    serverIndex: bestServerIndex,
    episodeIndex: bestEpisodeIndex,
    totalEpisodes: bestEpisodeCount,
  };
}

function getWatchedEpisodeIndexes(
  movieSlug: string,
  servers: EpisodeServer[],
  watchedKeys: string[]
) {
  const watchedKeySet = new Set(watchedKeys);
  const watchedEpisodeIndexes = new Set<number>();

  servers.forEach((server, serverIndex) => {
    const episodes = server.server_data ?? [];

    episodes.forEach((_, episodeIndex) => {
      const key = getNormalWatchedKey(movieSlug, serverIndex, episodeIndex);

      if (watchedKeySet.has(key)) {
        watchedEpisodeIndexes.add(episodeIndex);
      }
    });
  });

  return watchedEpisodeIndexes;
}

function getWatchStatus(input: {
  totalEpisodes: number;
  watchedCount: number;
  hasHistory: boolean;
}) {
  const { totalEpisodes, watchedCount, hasHistory } = input;

  if (!totalEpisodes) {
    return {
      label: "Chưa có tập",
      tone: "neutral" as const,
      description: "Phim này chưa có dữ liệu tập để theo dõi trạng thái.",
    };
  }

  if (watchedCount >= totalEpisodes) {
    return {
      label: totalEpisodes <= 1 ? "Đã xem" : "Đã xem hết",
      tone: "done" as const,
      description:
        totalEpisodes <= 1
          ? "Fen đã mở phim này rồi."
          : "Fen đã xem đủ số tập hiện có trên server dài nhất.",
    };
  }

  if (watchedCount > 0 || hasHistory) {
    return {
      label: "Đang xem dở",
      tone: "watching" as const,
      description: "Có lịch sử xem, có thể bấm Xem tiếp để quay lại đúng tập.",
    };
  }

  return {
    label: "Chưa xem",
    tone: "new" as const,
    description: "Phim này chưa có trong lịch sử xem của fen.",
  };
}

function getToneClass(tone: "neutral" | "done" | "watching" | "new") {
  if (tone === "done") return "border-emerald-300/30 bg-emerald-300/15 text-emerald-200";
  if (tone === "watching") return "border-yellow-300/30 bg-yellow-300/15 text-yellow-200";
  if (tone === "new") return "border-sky-300/30 bg-sky-300/15 text-sky-200";

  return "border-white/10 bg-white/5 text-slate-300";
}

function WatchStateSummary({
  totalEpisodes,
  watchedCount,
  progressPercent,
  status,
  historyItem,
  latestInfo,
  latestWatched,
}: {
  totalEpisodes: number;
  watchedCount: number;
  progressPercent: number;
  status: ReturnType<typeof getWatchStatus>;
  historyItem: WatchHistoryItem | null;
  latestInfo: LatestEpisodeInfo | null;
  latestWatched: boolean;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">Trạng thái xem</p>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            {status.description}
          </p>
        </div>

        <span
          className={[
            "rounded-full border px-3 py-1 text-xs font-black",
            getToneClass(status.tone),
          ].join(" ")}
        >
          {status.label}
        </span>
      </div>

      {totalEpisodes > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-400">
            <span>
              Đã xem {watchedCount}/{totalEpisodes} tập
            </span>

            <span>{progressPercent}%</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-yellow-300 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="font-black text-white">Xem tiếp</p>
          <p className="mt-1 line-clamp-1 text-slate-400">
            {historyItem?.episodeName || "Chưa có"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="font-black text-white">Tập mới nhất</p>
          <p className="mt-1 line-clamp-1 text-slate-400">
            {latestInfo?.label || "Chưa có"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <p className="font-black text-white">Tập mới</p>
          <p className="mt-1 line-clamp-1 text-slate-400">
            {latestInfo ? (latestWatched ? "Đã xem" : "Chưa xem") : "Chưa có"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MovieDetailActions({ movie, servers }: Props) {
  const [historyItem, setHistoryItem] = useState<WatchHistoryItem | null>(null);
  const [watchedEpisodes, setWatchedEpisodes] = useState<string[]>([]);

  useEffect(() => {
    function refresh() {
      const history = readWatchHistory();

      const found =
        history.find(
          (item) => item.slug === movie.slug && !Boolean(item.isCustom)
        ) || null;

      setHistoryItem(found);
      setWatchedEpisodes(readWatchedEpisodes());
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

  const latestInfo = useMemo(
    () => getLatestEpisodeInfo(movie.slug, servers),
    [movie.slug, servers]
  );

  const watchedEpisodeIndexes = useMemo(() => {
    return getWatchedEpisodeIndexes(movie.slug, servers, watchedEpisodes);
  }, [movie.slug, servers, watchedEpisodes]);

  const totalEpisodes = latestInfo?.totalEpisodes ?? 0;
  const watchedCount = Math.min(watchedEpisodeIndexes.size, totalEpisodes);
  const progressPercent = totalEpisodes
    ? Math.round((watchedCount / totalEpisodes) * 100)
    : 0;

  const latestWatched = Boolean(
    latestInfo && watchedEpisodeIndexes.has(latestInfo.episodeIndex)
  );

  const status = getWatchStatus({
    totalEpisodes,
    watchedCount,
    hasHistory: Boolean(historyItem),
  });

  const continueHref = historyItem?.href || "";
  const hasLatestDifferentFromFirst =
    Boolean(latestInfo?.href) && latestInfo?.href !== firstHref;

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

        {hasLatestDifferentFromFirst && latestInfo && (
          <Link
            href={latestInfo.href}
            className="rounded-2xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-500"
          >
            Tập mới nhất
          </Link>
        )}

        <FavoriteButton movie={movie} />
      </div>

      <WatchStateSummary
        totalEpisodes={totalEpisodes}
        watchedCount={watchedCount}
        progressPercent={progressPercent}
        status={status}
        historyItem={historyItem}
        latestInfo={latestInfo}
        latestWatched={latestWatched}
      />

      {historyItem?.serverName && (
        <p className="mt-3 text-xs text-slate-500">
          Nguồn xem tiếp: {historyItem.serverName}
        </p>
      )}
    </section>
  );
}
