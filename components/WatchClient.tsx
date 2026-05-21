"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import HlsPlayer from "@/components/HlsPlayer";
import { Episode, MovieDetail } from "@/lib/kkphim";
import FullscreenPlayerBox from "@/components/FullscreenPlayerBox";

const HISTORY_KEY = "baoflix_history";
const WATCHED_KEY = "baoflix_watched_episodes";

type EpisodeServer = {
  server_name: string;
  server_data: Episode[];
};

type Props = {
  movie: MovieDetail;
  servers: EpisodeServer[];
  currentServerIndex: number;
  currentEpisodeIndex: number;
};

function makeWatchedKey(
  movieSlug: string,
  serverIndex: number,
  episodeIndex: number
) {
  return `${movieSlug}::${serverIndex}::${episodeIndex}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function WatchClient({
  movie,
  servers,
  currentServerIndex,
  currentEpisodeIndex,
}: Props) {
  const [watchedKeys, setWatchedKeys] = useState<Set<string>>(new Set());
  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);

  const currentServer = servers[currentServerIndex] ?? servers[0];
  const episodes = currentServer?.server_data ?? [];
  const episode = episodes[currentEpisodeIndex] ?? episodes[0];

  const embedUrl = useMemo(() => episode?.link_embed || "", [episode]);
  const hlsUrl = useMemo(() => episode?.link_m3u8 || "", [episode]);

  const previousHref =
    currentEpisodeIndex > 0
      ? `/xem/${movie.slug}?server=${currentServerIndex}&tap=${
          currentEpisodeIndex - 1
        }`
      : "";

  const nextHref =
    currentEpisodeIndex < episodes.length - 1
      ? `/xem/${movie.slug}?server=${currentServerIndex}&tap=${
          currentEpisodeIndex + 1
        }`
      : "";

  useEffect(() => {
    const list = readJson<string[]>(WATCHED_KEY, []);
    setWatchedKeys(new Set(list));
  }, []);

  useEffect(() => {
    if (!movie || !episode || !currentServer) return;

    const historyList = readJson<any[]>(HISTORY_KEY, []);

    const nextHistoryItem = {
      slug: movie.slug,
      name: movie.name,
      origin_name: movie.origin_name,
      poster_url: movie.poster_url,
      thumb_url: movie.thumb_url,
      year: movie.year,
      lang: movie.lang,
      quality: movie.quality,
      type: movie.type,
      category: movie.category,
      country: movie.country,
      episodeName: episode.name,
      episodeIndex: currentEpisodeIndex,
      serverIndex: currentServerIndex,
      serverName: currentServer.server_name,
      watchedAt: new Date().toISOString(),
    };

    const nextHistory = [
      nextHistoryItem,
      ...historyList.filter((item: any) => item.slug !== movie.slug),
    ].slice(0, 50);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));

    const watchedList = readJson<string[]>(WATCHED_KEY, []);
    const nextWatchedSet = new Set(watchedList);

    nextWatchedSet.add(
      makeWatchedKey(movie.slug, currentServerIndex, currentEpisodeIndex)
    );

    const nextWatchedList = Array.from(nextWatchedSet).slice(-1000);

    localStorage.setItem(WATCHED_KEY, JSON.stringify(nextWatchedList));
    setWatchedKeys(new Set(nextWatchedList));
  }, [movie, episode, currentEpisodeIndex, currentServerIndex, currentServer]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setEpisodePanelOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!currentServer || !episode) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        Phim này chưa có tập để xem.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <Link
          href={`/phim/${movie.slug}`}
          className="text-sm text-red-300 hover:text-red-200"
        >
          ← Quay lại chi tiết phim
        </Link>

        <h1 className="mt-2 text-3xl font-black">{movie.name}</h1>

        <p className="mt-1 text-slate-400">Đang xem: {episode.name}</p>

        <p className="mt-1 text-sm text-yellow-300">
          Nguồn:{" "}
          {currentServer.server_name || `Server ${currentServerIndex + 1}`}
        </p>
      </div>

<div className="baoflix-player-fill">
  <FullscreenPlayerBox>
    {episode?.link_embed ? (
      <iframe
        src={episode.link_embed}
        allowFullScreen
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        className="h-full w-full"
        title={`${movie.name} - ${episode.name}`}
      />
    ) : episode?.link_m3u8 ? (
      <HlsPlayer src={episode.link_m3u8} />
    ) : (
      <div className="flex h-full w-full items-center justify-center text-slate-400">
        Tập này chưa có link phát.
      </div>
    )}
  </FullscreenPlayerBox>
</div>

      <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        {previousHref ? (
          <Link
            href={previousHref}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10"
          >
            ← Tập trước
          </Link>
        ) : (
          <button
            disabled
            className="cursor-not-allowed rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold opacity-40"
          >
            ← Tập trước
          </button>
        )}

        <button
          type="button"
          onClick={() => setEpisodePanelOpen(true)}
          className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-black hover:bg-yellow-200"
        >
          Tập phim
        </button>

        {nextHref ? (
          <Link
            href={nextHref}
            className="rounded-2xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500"
          >
            Tập sau →
          </Link>
        ) : (
          <button
            disabled
            className="cursor-not-allowed rounded-2xl bg-red-600 px-5 py-3 font-bold opacity-40"
          >
            Tập sau →
          </button>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-lg font-black">Đang phát</h2>

        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-red-600 px-3 py-1">
            {episode.name}
          </span>

          <span className="rounded-full bg-yellow-300 px-3 py-1 text-black">
            {currentServer.server_name || `Server ${currentServerIndex + 1}`}
          </span>
        </div>
      </section>

      {episodePanelOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Đóng panel"
            onClick={() => setEpisodePanelOpen(false)}
            className="absolute inset-0 h-full w-full"
          />

          <div className="absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto rounded-t-[2rem] border-t border-white/10 bg-[#0b0f19] p-4 shadow-2xl md:left-1/2 md:max-w-5xl md:-translate-x-1/2">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Chọn tập</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Đổi server hoặc chọn tập khác mà không cần quay lại trang chi
                  tiết.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEpisodePanelOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10"
              >
                Đóng
              </button>
            </div>

            <section className="mb-6">
              <h3 className="mb-3 font-black">Phiên bản</h3>

              <div className="flex flex-wrap gap-2">
                {servers.map((server, serverIndex) => (
                  <Link
                    key={`${server.server_name}-${serverIndex}`}
                    href={`/xem/${movie.slug}?server=${serverIndex}&tap=0`}
                    onClick={() => setEpisodePanelOpen(false)}
                    className={[
                      "rounded-xl border px-4 py-2 text-sm font-bold",
                      serverIndex === currentServerIndex
                        ? "border-yellow-300 bg-yellow-300 text-black"
                        : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                    ].join(" ")}
                  >
                    {server.server_name || `Server ${serverIndex + 1}`}
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-black">
                Tập phim -{" "}
                {currentServer.server_name || `Server ${currentServerIndex + 1}`}
              </h3>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10">
                {episodes.map((item, episodeIndex) => {
                  const watched = watchedKeys.has(
                    makeWatchedKey(
                      movie.slug,
                      currentServerIndex,
                      episodeIndex
                    )
                  );

                  return (
                    <Link
                      key={`${currentServerIndex}-${item.name}-${episodeIndex}`}
                      href={`/xem/${movie.slug}?server=${currentServerIndex}&tap=${episodeIndex}`}
                      onClick={() => setEpisodePanelOpen(false)}
                      className={[
                        "rounded-xl border px-3 py-3 text-center text-sm",
                        episodeIndex === currentEpisodeIndex
                          ? "border-red-500 bg-red-600 text-white"
                          : watched
                            ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200"
                            : "border-white/10 bg-white/5 hover:bg-white/10",
                      ].join(" ")}
                    >
                      {watched && episodeIndex !== currentEpisodeIndex
                        ? "✓ "
                        : ""}
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}