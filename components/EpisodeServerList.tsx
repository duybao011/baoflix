"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { EpisodeServer } from "@/lib/kkphim";
import { getNormalWatchedKey, readWatchedEpisodes } from "@/lib/watchStore";

type ValidServer = {
  server: EpisodeServer;
  originalIndex: number;
};

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

  const validServers = useMemo<ValidServer[]>(() => {
    return (servers || [])
      .map((server, originalIndex) => ({
        server,
        originalIndex,
      }))
      .filter((item) => {
        return (item.server.server_data ?? []).length > 0;
      });
  }, [servers]);

  const isSingleMovieLayout = useMemo(() => {
    if (!validServers.length) return false;

    return validServers.every((item) => {
      const episodes = item.server.server_data ?? [];
      return episodes.length <= 1;
    });
  }, [validServers]);

  if (!servers?.length || !validServers.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-400">
        Chưa có tập phim.
      </div>
    );
  }

  if (isSingleMovieLayout) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-5">
          <h3 className="text-2xl font-black">Các bản chiếu</h3>

          <p className="mt-1 text-sm text-slate-400">
            Chọn bản Vietsub, thuyết minh hoặc lồng tiếng nếu phim có nhiều
            nguồn.
          </p>
        </div>

        <div data-tv-row className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {validServers.map((item, visibleIndex) => {
            const server = item.server;
            const serverIndex = item.originalIndex;
            const episode = server.server_data?.[0];

            const watchedKey = getNormalWatchedKey(movieSlug, serverIndex, 0);
            const watched = watchedEpisodes.includes(watchedKey);

            return (
              <Link
                key={`${server.server_name}-${serverIndex}`}
                href={`/xem/${movieSlug}?server=${serverIndex}&tap=0`}
                data-tv-default={visibleIndex === 0 ? true : undefined}
                className="group rounded-3xl border border-white/10 bg-black/20 p-4 transition hover:border-red-500/50 hover:bg-red-600/10 focus-visible:border-yellow-300 focus-visible:bg-yellow-300/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white">
                      {normalizeServerName(server.server_name)}
                    </p>

                    <p className="mt-1 text-sm text-slate-400">
                      {episode?.name || "Full"}
                    </p>
                  </div>

                  {watched && (
                    <span className="rounded-full bg-yellow-300 px-2.5 py-1 text-xs font-black text-black">
                      ✓ Đã xem
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
                    {episode?.filename ? "Nguồn phát" : "Sẵn sàng"}
                  </span>

                  <span className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white group-hover:bg-red-500">
                    Xem bản này
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {servers.map((server, serverIndex) => {
        const episodes = server.server_data ?? [];

        const hasPreviousPlayableEpisode = servers
          .slice(0, serverIndex)
          .some((previousServer) => {
            return (previousServer.server_data ?? []).length > 0;
          });

        return (
          <div
            key={`${server.server_name}-${serverIndex}`}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">
                  {normalizeServerName(server.server_name)}
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  {episodes.length} tập
                </p>
              </div>

              {episodes.length > 0 && (
                <Link
                  href={`/xem/${movieSlug}?server=${serverIndex}&tap=0`}
                  data-tv-skip
                  tabIndex={-1}
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
              <div
                data-tv-row
                className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
              >
                {episodes.map((episode, episodeIndex) => {
                  const watchedKey = getNormalWatchedKey(
                    movieSlug,
                    serverIndex,
                    episodeIndex
                  );

                  const watched = watchedEpisodes.includes(watchedKey);

                  const shouldBeDefault =
                    !hasPreviousPlayableEpisode && episodeIndex === 0;

                  return (
                    <Link
                      key={`${serverIndex}-${episode.name}-${episodeIndex}`}
                      href={`/xem/${movieSlug}?server=${serverIndex}&tap=${episodeIndex}`}
                      data-tv-default={shouldBeDefault ? true : undefined}
                      className="flex min-h-[54px] items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-bold hover:bg-red-600 focus-visible:border-yellow-300 focus-visible:bg-yellow-300 focus-visible:text-black"
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

function normalizeServerName(name?: string) {
  const text = String(name || "").toLowerCase();

  if (text.includes("lồng") || text.includes("long")) return "Lồng tiếng";
  if (text.includes("thuyết") || text.includes("thuyet")) return "Thuyết minh";
  if (text.includes("vietsub") || text.includes("sub")) return "Vietsub";

  return name || "Server";
}