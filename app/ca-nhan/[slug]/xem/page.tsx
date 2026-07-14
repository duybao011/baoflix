"use client";

/* eslint-disable react-hooks/exhaustive-deps */

import Link from "next/link";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import HlsPlayer from "@/components/HlsPlayer";
import CustomDrivePlayer from "@/components/CustomDrivePlayer";
import FullscreenPlayerBox from "@/components/FullscreenPlayerBox";
import {
  getCustomMovieBySlugClient,
  StoredCustomMovie,
} from "@/lib/customMoviesClient";
import type { Episode } from "@/lib/kkphim";
import { isTvModeActive } from "@/lib/tvMode";
import {
  getCustomWatchedKey,
  readWatchedEpisodes,
  saveCustomWatchHistory,
  saveWatchedEpisode,
} from "@/lib/watchStore";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type CustomMovieWatchContentProps = {
  movieData: StoredCustomMovie;
  season: number;
  tap: number;
};

type EpisodeGroup = {
  label: string;
  start: number;
  end: number;
  episodes: Episode[];
};

const EPISODE_GROUP_SIZE = 24;

function buildEpisodeGroups(episodes: Episode[]) {
  const groups: EpisodeGroup[] = [];

  for (let start = 0; start < episodes.length; start += EPISODE_GROUP_SIZE) {
    const end = Math.min(start + EPISODE_GROUP_SIZE, episodes.length);

    groups.push({
      label: `${start + 1}-${end}`,
      start,
      end,
      episodes: episodes.slice(start, end),
    });
  }

  return groups;
}

function countTotalEpisodes(seasons: StoredCustomMovie["episodes"]) {
  return (seasons || []).reduce((total, season) => {
    return total + (season.server_data ?? []).length;
  }, 0);
}

function countWatchedCustomEpisodes(
  movieSlug: string,
  seasons: StoredCustomMovie["episodes"],
  watchedEpisodes: string[]
) {
  let count = 0;

  (seasons || []).forEach((season, seasonIndex) => {
    (season.server_data ?? []).forEach((_, episodeIndex) => {
      const watchedKey = getCustomWatchedKey(
        movieSlug,
        seasonIndex,
        episodeIndex
      );

      if (watchedEpisodes.includes(watchedKey)) {
        count += 1;
      }
    });
  });

  return count;
}

function getGlobalEpisodeNumber(
  seasons: StoredCustomMovie["episodes"],
  seasonIndex: number,
  episodeIndex: number
) {
  let number = 0;

  for (let index = 0; index < seasons.length; index += 1) {
    const episodes = seasons[index]?.server_data ?? [];

    if (index < seasonIndex) {
      number += episodes.length;
      continue;
    }

    if (index === seasonIndex) {
      number += episodeIndex + 1;
      break;
    }
  }

  return number;
}

function getFirstCustomHref(movieSlug: string, seasons: StoredCustomMovie["episodes"]) {
  const seasonIndex = seasons.findIndex(
    (season) => (season.server_data ?? []).length > 0
  );

  if (seasonIndex < 0) return "";

  return `/ca-nhan/${movieSlug}/xem?season=${seasonIndex}&tap=0`;
}

function getLatestCustomTarget(seasons: StoredCustomMovie["episodes"]) {
  for (let seasonIndex = seasons.length - 1; seasonIndex >= 0; seasonIndex -= 1) {
    const episodes = seasons[seasonIndex]?.server_data ?? [];

    if (episodes.length > 0) {
      return {
        seasonIndex,
        episodeIndex: episodes.length - 1,
        episode: episodes[episodes.length - 1],
        seasonName: seasons[seasonIndex]?.server_name || `Mùa ${seasonIndex + 1}`,
      };
    }
  }

  return null;
}

function getLatestCustomHref(movieSlug: string, seasons: StoredCustomMovie["episodes"]) {
  const target = getLatestCustomTarget(seasons);

  if (!target) return "";

  return `/ca-nhan/${movieSlug}/xem?season=${target.seasonIndex}&tap=${target.episodeIndex}`;
}

function getWatchStateLabel(watchedCount: number, totalEpisodes: number) {
  if (totalEpisodes <= 0) return "Chưa có tập";
  if (watchedCount <= 0) return "Chưa xem";
  if (watchedCount >= totalEpisodes) return "Đã xem hết";
  return "Đang xem dở";
}

function focusTvDefaultInModal() {
  window.setTimeout(() => {
    const modal = document.querySelector<HTMLElement>(
      "[data-tv-modal='custom-episode-panel']"
    );

    if (!modal) return;

    const target =
      modal.querySelector<HTMLElement>("[data-tv-default]") ||
      modal.querySelector<HTMLElement>("a[href], button:not([disabled])");

    if (!target) return;

    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
  }, 80);
}

function CustomMovieWatchShell({ params }: PageProps) {
  const { slug } = use(params);
  const searchParams = useSearchParams();

  const season = Number(searchParams.get("season") || 0);
  const tap = Number(searchParams.get("tap") || 0);

  const [movieData, setMovieData] = useState<StoredCustomMovie | null>(null);

  useEffect(() => {
    setMovieData(getCustomMovieBySlugClient(slug) || null);
  }, [slug]);

  if (!movieData) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-black">Không tìm thấy phim riêng</h1>

        <p className="mt-2 text-slate-400">
          Phim này có thể nằm trên thiết bị khác, chưa được import vào trình
          duyệt này, hoặc đã bị xóa khỏi danh sách phim riêng.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/ca-nhan"
            className="inline-block rounded-2xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500"
          >
            Quay lại phim riêng
          </Link>

          <Link
            href="/ca-nhan/them"
            className="inline-block rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10"
          >
            Import / thêm phim
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CustomMovieWatchContent movieData={movieData} season={season} tap={tap} />
  );
}

export default function CustomMovieWatchPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-400">
          Đang mở phim riêng...
        </div>
      }
    >
      <CustomMovieWatchShell params={params} />
    </Suspense>
  );
}

function CustomMovieWatchContent({
  movieData,
  season,
  tap,
}: CustomMovieWatchContentProps) {
  const [episodePanelOpen, setEpisodePanelOpen] = useState(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState<string[]>([]);
  const [activeSeasonInModal, setActiveSeasonInModal] = useState(0);
  const [activeGroupBySeason, setActiveGroupBySeason] = useState<Record<number, number>>({});
  const [tvDriveMode, setTvDriveMode] = useState(false);

  const movie = movieData.movie;
  const seasons = movieData.episodes ?? [];

  const safeSeasonIndex =
    Number.isNaN(season) || season < 0 || season >= seasons.length ? 0 : season;

  const currentSeason = seasons[safeSeasonIndex];
  const episodes = currentSeason?.server_data ?? [];

  const safeIndex =
    Number.isNaN(tap) || tap < 0 || tap >= episodes.length ? 0 : tap;

  const episode = episodes[safeIndex];

  useEffect(() => {
    function refreshTvDriveMode() {
      setTvDriveMode(
        Boolean(episode?.link_embed) &&
          isTvModeActive({ allowSessionOnDesktop: false })
      );
    }

    refreshTvDriveMode();

    window.addEventListener("baoflix-tv-mode-change", refreshTvDriveMode);
    window.addEventListener("storage", refreshTvDriveMode);
    window.addEventListener("focus", refreshTvDriveMode);

    return () => {
      window.removeEventListener("baoflix-tv-mode-change", refreshTvDriveMode);
      window.removeEventListener("storage", refreshTvDriveMode);
      window.removeEventListener("focus", refreshTvDriveMode);
    };
  }, [episode?.link_embed]);

  const currentWatchedKey = getCustomWatchedKey(
    movie.slug,
    safeSeasonIndex,
    safeIndex
  );

  useEffect(() => {
    setWatchedEpisodes(readWatchedEpisodes());

    function refreshWatchedEpisodes() {
      setWatchedEpisodes(readWatchedEpisodes());
    }

    window.addEventListener("storage", refreshWatchedEpisodes);
    window.addEventListener("focus", refreshWatchedEpisodes);

    return () => {
      window.removeEventListener("storage", refreshWatchedEpisodes);
      window.removeEventListener("focus", refreshWatchedEpisodes);
    };
  }, []);

  useEffect(() => {
    const next = saveWatchedEpisode(currentWatchedKey);
    setWatchedEpisodes(next);

    saveCustomWatchHistory({
      movie,
      seasonIndex: safeSeasonIndex,
      episodeIndex: safeIndex,
      seasonName: currentSeason?.server_name,
      episodeName: episode?.name,
    });
  }, [
    currentWatchedKey,
    movie,
    safeSeasonIndex,
    safeIndex,
    currentSeason?.server_name,
    episode?.name,
  ]);

  useEffect(() => {
    if (!episodePanelOpen) return;

    const oldOverflow = document.body.style.overflow;
    const oldTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    setActiveSeasonInModal(safeSeasonIndex);
    focusTvDefaultInModal();

    return () => {
      document.body.style.overflow = oldOverflow;
      document.body.style.touchAction = oldTouchAction;
    };
  }, [episodePanelOpen, safeSeasonIndex]);

  const previousHref =
    safeIndex > 0
      ? `/ca-nhan/${movie.slug}/xem?season=${safeSeasonIndex}&tap=${safeIndex - 1}`
      : "";

  const nextHref =
    safeIndex < episodes.length - 1
      ? `/ca-nhan/${movie.slug}/xem?season=${safeSeasonIndex}&tap=${safeIndex + 1}`
      : "";

  const firstHref = getFirstCustomHref(movie.slug, seasons);
  const latestHref = getLatestCustomHref(movie.slug, seasons);
  const latestTarget = getLatestCustomTarget(seasons);

  const totalEpisodes = countTotalEpisodes(seasons);
  const watchedCount = countWatchedCustomEpisodes(
    movie.slug,
    seasons,
    watchedEpisodes
  );

  const progressPercent =
    totalEpisodes > 0
      ? Math.min(100, Math.round((watchedCount / totalEpisodes) * 100))
      : 0;

  const currentEpisodeNumber = getGlobalEpisodeNumber(
    seasons,
    safeSeasonIndex,
    safeIndex
  );

  const latestWatched = latestTarget
    ? watchedEpisodes.includes(
        getCustomWatchedKey(
          movie.slug,
          latestTarget.seasonIndex,
          latestTarget.episodeIndex
        )
      )
    : false;

  const watchTimeKey = `baoflix_custom_watch_time_${movie.slug}_season_${safeSeasonIndex}_episode_${safeIndex}`;

  const activeSeason = seasons[activeSeasonInModal];
  const activeSeasonEpisodes = activeSeason?.server_data ?? [];
  const activeGroups = useMemo(
    () => buildEpisodeGroups(activeSeasonEpisodes),
    [activeSeasonEpisodes]
  );

  const activeGroupIndex = Math.min(
    Math.max(activeGroupBySeason[activeSeasonInModal] ?? 0, 0),
    Math.max(activeGroups.length - 1, 0)
  );

  const activeGroup = activeGroups[activeGroupIndex];

  return (
    <div
      data-tv-scope="custom-watch-page"
      data-tv-lock="true"
      data-tv-autofocus="true"
      data-tv-watch-immersive={tvDriveMode ? "true" : "false"}
    >
      <Link
        href={`/ca-nhan/${movie.slug}`}
        data-tv-skip
        tabIndex={-1}
        className="text-sm text-red-300"
      >
        ← Quay lại chi tiết phim
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{movie.name}</h1>

          <p className="mt-1 text-slate-400">
            {movie.origin_name || "Phim riêng"}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-red-600 px-3 py-1">
              {episode?.name || "Chưa có tập"}
            </span>

            <span className="rounded-full bg-white/10 px-3 py-1">
              {currentSeason?.server_name || `Mùa ${safeSeasonIndex + 1}`}
            </span>

            <span className="rounded-full bg-yellow-300 px-3 py-1 font-black text-black">
              {getWatchStateLabel(watchedCount, totalEpisodes)}
            </span>
          </div>
        </div>

        <button
          type="button"
          data-tv-default
          onClick={() => setEpisodePanelOpen(true)}
          className="rounded-2xl bg-red-600 px-5 py-3 font-black hover:bg-red-500 focus-visible:border-yellow-300 focus-visible:bg-yellow-300 focus-visible:text-black"
        >
          Tập / nguồn
        </button>
      </div>

      <section className="mt-5 rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
              Trạng thái xem
            </p>

            <h2 className="mt-2 text-xl font-black text-white">
              {getWatchStateLabel(watchedCount, totalEpisodes)}
            </h2>

            <p className="mt-1 text-sm text-slate-300">
              Đã xem {watchedCount}/{totalEpisodes} tập
              {currentEpisodeNumber > 0
                ? ` • đang ở tập ${currentEpisodeNumber}/${totalEpisodes}`
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {firstHref && (
              <Link
                href={firstHref}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
              >
                Tập đầu
              </Link>
            )}

            {latestHref && latestHref !== firstHref && (
              <Link
                href={latestHref}
                className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white hover:bg-red-500"
              >
                Tập mới nhất
              </Link>
            )}
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30">
          <div
            className="h-full rounded-full bg-yellow-300 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {latestTarget && (
          <p className="mt-3 text-xs text-slate-400">
            Tập mới nhất: {latestTarget.seasonName} • {latestTarget.episode.name}
            {latestWatched ? " • đã xem" : " • chưa xem"}
          </p>
        )}
      </section>

      <div className="baoflix-player-fill mt-5">
        <FullscreenPlayerBox tvImmersive={tvDriveMode}>
          {episode?.link_embed ? (
            <CustomDrivePlayer
              src={episode.link_embed}
              title={`${movie.name} - ${episode.name}`}
              progressKey={`${watchTimeKey}_drive_native`}
              movie={movie}
              currentSeason={currentSeason}
              seasonIndex={safeSeasonIndex}
              episodeIndex={safeIndex}
              watchedEpisodes={watchedEpisodes}
              previousHref={previousHref}
              nextHref={nextHref}
              detailHref={`/ca-nhan/${movie.slug}`}
              poster={movie.thumb_url || movie.poster_url}
              onOpenEpisodes={() => setEpisodePanelOpen(true)}
            />
          ) : episode?.link_m3u8 ? (
            <HlsPlayer src={episode.link_m3u8} storageKey={watchTimeKey} autoResume />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              Tập này chưa có link phát.
            </div>
          )}
        </FullscreenPlayerBox>
      </div>

      <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-3 md:p-4">
        <div
          data-tv-row
          className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:items-center md:justify-between md:gap-3"
        >
          {previousHref ? (
            <Link
              href={previousHref}
              className="flex min-h-[56px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-black hover:bg-white/10 md:min-h-[52px] md:px-5"
            >
              ← Tập trước
            </Link>
          ) : (
            <button
              disabled
              className="flex min-h-[56px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center text-sm font-black opacity-40 md:min-h-[52px] md:px-5"
            >
              ← Tập trước
            </button>
          )}

          <button
            type="button"
            onClick={() => setEpisodePanelOpen(true)}
            className="flex min-h-[56px] items-center justify-center rounded-2xl bg-yellow-300 px-3 py-3 text-center text-sm font-black text-black hover:bg-yellow-200 md:min-h-[52px] md:px-5"
          >
            Tập / nguồn
          </button>

          {nextHref ? (
            <Link
              href={nextHref}
              className="flex min-h-[56px] items-center justify-center rounded-2xl bg-red-600 px-3 py-3 text-center text-sm font-black hover:bg-red-500 md:min-h-[52px] md:px-5"
            >
              Tập sau →
            </Link>
          ) : (
            <button
              disabled
              className="flex min-h-[56px] items-center justify-center rounded-2xl bg-red-600 px-3 py-3 text-center text-sm font-black opacity-40 md:min-h-[52px] md:px-5"
            >
              Tập sau →
            </button>
          )}
        </div>
      </section>

      {episodePanelOpen && (
        <div
          data-tv-scope="custom-episode-panel"
          data-tv-lock="true"
          data-tv-modal="custom-episode-panel"
          className="fixed inset-0 z-[140] flex items-end justify-center overflow-hidden bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6"
        >
          <section className="flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0b0f19] shadow-2xl md:max-h-[86dvh] md:rounded-3xl">
            <div className="shrink-0 border-b border-white/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Tập / nguồn</h2>

                  <p className="mt-1 text-sm text-slate-400">
                    Chọn mùa hoặc tập khác mà không cần quay lại trang chi tiết.
                  </p>
                </div>

                <button
                  type="button"
                  data-tv-close
                  onClick={() => setEpisodePanelOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold hover:bg-white/10"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div
              className="baoflix-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-5"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="mb-6">
                <h3 className="mb-3 text-lg font-black">Mùa</h3>

                {seasons.length === 0 ? (
                  <p className="text-sm text-slate-400">Chưa có mùa nào.</p>
                ) : (
                  <div data-tv-row className="flex flex-wrap gap-2">
                    {seasons.map((seasonItem, index) => {
                      const active = index === activeSeasonInModal;

                      return (
                        <button
                          key={`${seasonItem.server_name}-${index}`}
                          type="button"
                          onClick={() => setActiveSeasonInModal(index)}
                          className={[
                            "rounded-xl border px-4 py-2 text-sm font-black",
                            active
                              ? "border-yellow-300 bg-yellow-300 text-black"
                              : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                          ].join(" ")}
                        >
                          {seasonItem.server_name || `Mùa ${index + 1}`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {activeSeason && (
                <div className="rounded-3xl border border-yellow-300/40 bg-yellow-300/5 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black">
                        {activeSeason.server_name ||
                          `Mùa ${activeSeasonInModal + 1}`}
                      </h3>

                      <p className="mt-1 text-sm text-slate-400">
                        {activeSeasonEpisodes.length} tập
                        {activeGroup && activeGroups.length > 1
                          ? ` • đang hiện ${activeGroup.start + 1}-${activeGroup.end}`
                          : ""}
                      </p>
                    </div>

                    {activeSeasonEpisodes.length > 0 && (
                      <div data-tv-row className="flex flex-wrap gap-2">
                        <Link
                          href={`/ca-nhan/${movie.slug}/xem?season=${activeSeasonInModal}&tap=0`}
                          onClick={() => setEpisodePanelOpen(false)}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10"
                        >
                          Tập đầu
                        </Link>

                        <Link
                          href={`/ca-nhan/${movie.slug}/xem?season=${activeSeasonInModal}&tap=${activeSeasonEpisodes.length - 1}`}
                          onClick={() => setEpisodePanelOpen(false)}
                          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-500"
                        >
                          Tập mới nhất
                        </Link>
                      </div>
                    )}
                  </div>

                  {activeGroups.length > 1 && (
                    <div data-tv-row className="mb-4 flex flex-wrap gap-2">
                      {activeGroups.map((group, groupIndex) => {
                        const active = groupIndex === activeGroupIndex;

                        return (
                          <button
                            key={`${activeSeasonInModal}-${group.label}`}
                            type="button"
                            onClick={() =>
                              setActiveGroupBySeason((old) => ({
                                ...old,
                                [activeSeasonInModal]: groupIndex,
                              }))
                            }
                            className={[
                              "rounded-xl border px-4 py-2 text-sm font-black",
                              active
                                ? "border-yellow-300 bg-yellow-300 text-black"
                                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                            ].join(" ")}
                          >
                            {group.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {activeSeasonEpisodes.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                      Mùa này chưa có tập.
                    </div>
                  ) : (
                    <div
                      data-tv-row
                      className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
                    >
                      {(activeGroup?.episodes ?? activeSeasonEpisodes).map(
                        (episodeItem, localEpisodeIndex) => {
                          const episodeIndex = activeGroup
                            ? activeGroup.start + localEpisodeIndex
                            : localEpisodeIndex;

                          const active =
                            activeSeasonInModal === safeSeasonIndex &&
                            episodeIndex === safeIndex;

                          const watchedKey = getCustomWatchedKey(
                            movie.slug,
                            activeSeasonInModal,
                            episodeIndex
                          );

                          const watched = watchedEpisodes.includes(watchedKey);

                          return (
                            <Link
                              key={`${activeSeasonInModal}-${episodeItem.name}-${episodeIndex}`}
                              href={`/ca-nhan/${movie.slug}/xem?season=${activeSeasonInModal}&tap=${episodeIndex}`}
                              data-tv-default={active ? true : undefined}
                              onClick={() => setEpisodePanelOpen(false)}
                              className={[
                                "flex min-h-[54px] items-center justify-center rounded-xl border px-3 py-3 text-center text-sm font-bold",
                                active
                                  ? "border-red-500 bg-red-600 text-white"
                                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                              ].join(" ")}
                            >
                              <span className="inline-flex items-center justify-center gap-1">
                                {watched && (
                                  <span className="text-yellow-300">✓</span>
                                )}
                                <span>{episodeItem.name}</span>
                              </span>
                            </Link>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              )}

              <div data-tv-row className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/ca-nhan/${movie.slug}`}
                  onClick={() => setEpisodePanelOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold hover:bg-white/10"
                >
                  Về trang chi tiết
                </Link>
              </div>

              <div className="h-6" />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
