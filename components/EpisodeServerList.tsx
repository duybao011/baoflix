"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Episode } from "@/lib/kkphim";

const WATCHED_KEY = "baoflix_watched_episodes";

type EpisodeServer = {
  server_name: string;
  server_data: Episode[];
};

type Props = {
  movieSlug: string;
  servers: EpisodeServer[];
};

function makeWatchedKey(movieSlug: string, serverIndex: number, episodeIndex: number) {
  return `${movieSlug}::${serverIndex}::${episodeIndex}`;
}

export default function EpisodeServerList({ movieSlug, servers }: Props) {
  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHED_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      setWatchedKeys(new Set(list));
    } catch {
      setWatchedKeys(new Set());
    }
  }, []);

  const firstHref = useMemo(() => {
    const firstServerIndex = servers.findIndex(
      (server) => server.server_data && server.server_data.length > 0
    );

    if (firstServerIndex < 0) return "#";

    return `/xem/${movieSlug}?server=${firstServerIndex}&tap=0`;
  }, [movieSlug, servers]);

  if (!servers.length) {
    return (
      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-400">
        Phim này chưa có danh sách tập.
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Danh sách tập</h2>
          <p className="mt-1 text-sm text-slate-400">
            Tập đã xem sẽ có dấu ✓.
          </p>
        </div>

        <Link
          href={firstHref}
          className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold hover:bg-red-500"
        >
          Xem ngay
        </Link>
      </div>

      <div className="space-y-8">
        {servers.map((server, serverIndex) => {
          const episodes = server.server_data ?? [];
          if (!episodes.length) return null;

          return (
            <div
              key={`${server.server_name}-${serverIndex}`}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-black">
                  {server.server_name || `Server ${serverIndex + 1}`}
                </h3>

                <Link
                  href={`/xem/${movieSlug}?server=${serverIndex}&tap=0`}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-500"
                >
                  Xem server này
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {episodes.map((episode, episodeIndex) => {
                  const watched = watchedKeys.has(
                    makeWatchedKey(movieSlug, serverIndex, episodeIndex)
                  );

                  return (
                    <Link
                      key={`${serverIndex}-${episode.name}-${episodeIndex}`}
                      href={`/xem/${movieSlug}?server=${serverIndex}&tap=${episodeIndex}`}
                      className={[
                        "rounded-xl border px-3 py-3 text-center text-sm",
                        watched
                          ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200"
                          : "border-white/10 bg-white/5 hover:bg-red-600",
                      ].join(" ")}
                    >
                      {watched ? "✓ " : ""}
                      {episode.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}