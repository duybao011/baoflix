"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EpisodeServer } from "@/lib/kkphim";
import { getNormalWatchedKey, readWatchedEpisodes } from "@/lib/watchStore";

export default function EpisodeServerList({
  movieSlug,
  servers,
}: {
  movieSlug: string;
  servers: EpisodeServer[];
}) {
  const [watchedEpisodes, setWatchedEpisodes] = useState<string[]>([]);

  useEffect(() => {
    setWatchedEpisodes(readWatchedEpisodes());

    function refresh() {
      setWatchedEpisodes(readWatchedEpisodes());
    }

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (!servers?.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-400">
        Chưa có tập phim.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {servers.map((server, serverIndex) => {
        const episodes = server.server_data ?? [];

        return (
          <div
            key={`${server.server_name}-${serverIndex}`}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">
                  {server.server_name || `Server ${serverIndex + 1}`}
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  {episodes.length} tập
                </p>
              </div>

              {episodes.length > 0 && (
                <Link
                  href={`/xem/${movieSlug}?server=${serverIndex}&tap=0`}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-500"
                >
                  Xem server này
                </Link>
              )}
            </div>

            {episodes.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                Server này chưa có tập.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {episodes.map((episode, episodeIndex) => {
                  const watchedKey = getNormalWatchedKey(
                    movieSlug,
                    serverIndex,
                    episodeIndex
                  );

                  const watched = watchedEpisodes.includes(watchedKey);

                  return (
                    <Link
                      key={`${serverIndex}-${episode.name}-${episodeIndex}`}
                      href={`/xem/${movieSlug}?server=${serverIndex}&tap=${episodeIndex}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-bold hover:bg-red-600"
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        {watched && (
                          <span className="text-yellow-300">✓</span>
                        )}
                        <span>{episode.name}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}