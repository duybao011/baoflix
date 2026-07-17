"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  checkEpisodeLink,
  countEpisodes,
  driveToPreviewUrl,
  getCustomMovieBySlugClient,
  readCustomMovies,
  saveCustomMovies,
  StoredCustomMovie,
  type EpisodeLinkCheck,
} from "@/lib/customMoviesClient";
import { slugify } from "@/lib/slugify";
import type { EpisodeSubtitle } from "@/lib/kkphim";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type EpisodeDraft = {
  name: string;
  link: string;
  subtitleLink: string;
};

function parseBulkEpisodes(raw: string): EpisodeDraft[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes("|")) {
        const parts = line.split("|");

        return {
          name: parts[0]?.trim() || "",
          link: parts[1]?.trim() || "",
          subtitleLink: parts.slice(2).join("|").trim(),
        };
      }

      return {
        name: "",
        link: line,
        subtitleLink: "",
      };
    })
    .filter((item) => item.link);
}

function getEpisodeLinkValue(episode: { link_embed?: string; link_m3u8?: string }) {
  return episode.link_m3u8 || episode.link_embed || "";
}

function buildDefaultSubtitle(url: string): EpisodeSubtitle[] {
  const cleanUrl = String(url || "").trim();

  return cleanUrl
    ? [
        {
          label: "Tiếng Việt",
          lang: "vi",
          url: cleanUrl,
          default: true,
        },
      ]
    : [];
}

export default function ManageCustomMoviePage({ params }: PageProps) {
  const { slug } = use(params);

  const [movieData, setMovieData] = useState<StoredCustomMovie | null>(null);
  const [seasonName, setSeasonName] = useState("Mùa 1");
  const [episodeName, setEpisodeName] = useState("");
  const [episodeLink, setEpisodeLink] = useState("");
  const [episodeSubtitleLink, setEpisodeSubtitleLink] = useState("");
  const [bulkEpisodesText, setBulkEpisodesText] = useState("");
  const [status, setStatus] = useState("");
  const [linkChecks, setLinkChecks] = useState<Record<string, EpisodeLinkCheck>>({});

  useEffect(() => {
    const found = getCustomMovieBySlugClient(slug) || null;
    setMovieData(found);

    if (found?.episodes?.[0]?.server_name) {
      setSeasonName(found.episodes[0].server_name);
    }
  }, [slug]);

  const totalEpisodes = useMemo(() => {
    return movieData ? countEpisodes(movieData.episodes || []) : 0;
  }, [movieData]);

  if (!movieData) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-black">Không tìm thấy phim riêng</h1>

        <p className="mt-2 text-slate-400">
          Nếu đây là phim nằm trong code như Sabakan, hãy vào trang Phim riêng
          rồi bấm “Đưa vào giao diện” trước.
        </p>

        <div className="mt-5">
          <Link href="/ca-nhan" className="text-red-300">
            ← Quay lại phim riêng
          </Link>
        </div>
      </div>
    );
  }

  const movie = movieData.movie;
  const seasons = movieData.episodes ?? [];

  function saveUpdatedMovie(updated: StoredCustomMovie, message?: string) {
    const all = readCustomMovies();

    const total = countEpisodes(updated.episodes || []);

    const normalized: StoredCustomMovie = {
      ...updated,
      movie: {
        ...updated.movie,
        episode_current: `${total} tập`,
        episode_total: String(total),
      },
      updatedAt: new Date().toISOString(),
    };

    const next = [
      normalized,
      ...all.filter((item) => item.movie.slug !== normalized.movie.slug),
    ];

    saveCustomMovies(next);
    setMovieData(normalized);

    if (message) setStatus(message);
  }

  function getOrCreateSeasonIndex(
    cloned: StoredCustomMovie,
    cleanSeasonName: string
  ) {
    let seasonIndex = cloned.episodes.findIndex(
      (item) => item.server_name.toLowerCase() === cleanSeasonName.toLowerCase()
    );

    if (seasonIndex < 0) {
      cloned.episodes.push({
        server_name: cleanSeasonName,
        server_data: [],
      });

      seasonIndex = cloned.episodes.length - 1;
    }

    return seasonIndex;
  }

  function normalizeEpisodeLink(rawLink: string) {
    const cleanLink = rawLink.trim();
    const isHls = /\.m3u8(\?|$)/i.test(cleanLink);

    return {
      link_embed: isHls ? "" : driveToPreviewUrl(cleanLink),
      link_m3u8: isHls ? cleanLink : "",
    };
  }

  function addEpisode() {
    const cleanSeasonName = seasonName.trim() || "Mùa 1";
    const cleanEpisodeName = episodeName.trim();
    const cleanLink = episodeLink.trim();
    const cleanSubtitleLink = episodeSubtitleLink.trim();

    if (!cleanLink) {
      alert("Dán link tập phim đã fen.");
      return;
    }

    const cloned: StoredCustomMovie = JSON.parse(JSON.stringify(movieData));
    const seasonIndex = getOrCreateSeasonIndex(cloned, cleanSeasonName);
    const currentSeason = cloned.episodes[seasonIndex];
    const nextEpisodeNumber = currentSeason.server_data.length + 1;

    const finalEpisodeName =
      cleanEpisodeName || `Tập ${String(nextEpisodeNumber).padStart(2, "0")}`;

    currentSeason.server_data.push({
      name: finalEpisodeName,
      slug: slugify(finalEpisodeName),
      filename: `${movie.name} - ${cleanSeasonName} - ${finalEpisodeName}`,
      ...normalizeEpisodeLink(cleanLink),
      subtitles: buildDefaultSubtitle(cleanSubtitleLink),
    });

    saveUpdatedMovie(
      cloned,
      `Đã thêm ${finalEpisodeName} vào ${cleanSeasonName}.`
    );

    setEpisodeName("");
    setEpisodeLink("");
    setEpisodeSubtitleLink("");
  }

  function addBulkEpisodes() {
    const cleanSeasonName = seasonName.trim() || "Mùa 1";
    const drafts = parseBulkEpisodes(bulkEpisodesText);

    if (drafts.length === 0) {
      alert("Dán danh sách tập đã fen.");
      return;
    }

    const cloned: StoredCustomMovie = JSON.parse(JSON.stringify(movieData));
    const seasonIndex = getOrCreateSeasonIndex(cloned, cleanSeasonName);
    const currentSeason = cloned.episodes[seasonIndex];

    drafts.forEach((draft) => {
      const nextEpisodeNumber = currentSeason.server_data.length + 1;
      const finalEpisodeName =
        draft.name || `Tập ${String(nextEpisodeNumber).padStart(2, "0")}`;

      currentSeason.server_data.push({
        name: finalEpisodeName,
        slug: slugify(finalEpisodeName),
        filename: `${movie.name} - ${cleanSeasonName} - ${finalEpisodeName}`,
        ...normalizeEpisodeLink(draft.link),
        subtitles: buildDefaultSubtitle(draft.subtitleLink),
      });
    });

    saveUpdatedMovie(
      cloned,
      `Đã thêm ${drafts.length} tập vào ${cleanSeasonName}.`
    );

    setBulkEpisodesText("");
  }

  function updateEpisode(
    seasonIndex: number,
    episodeIndex: number,
    nextValue: {
      name?: string;
      link_embed?: string;
      link_m3u8?: string;
      subtitles?: EpisodeSubtitle[];
    }
  ) {
    const cloned: StoredCustomMovie = JSON.parse(JSON.stringify(movieData));
    const episode = cloned.episodes[seasonIndex]?.server_data?.[episodeIndex];

    if (!episode) return;

    const nextName = nextValue.name ?? episode.name;

    episode.name = nextName;
    episode.slug = slugify(nextName);
    episode.filename = `${movie.name} - ${
      cloned.episodes[seasonIndex].server_name
    } - ${nextName}`;

    if (typeof nextValue.link_embed === "string") {
      episode.link_embed = driveToPreviewUrl(nextValue.link_embed);
    }

    if (typeof nextValue.link_m3u8 === "string") {
      episode.link_m3u8 = nextValue.link_m3u8;
    }

    if (Array.isArray(nextValue.subtitles)) {
      episode.subtitles = nextValue.subtitles;
    }

    saveUpdatedMovie(cloned, "Đã cập nhật tập.");
  }

  function renameSeason(seasonIndex: number) {
    const current = seasons[seasonIndex];
    const nextName = window.prompt("Tên mùa mới:", current?.server_name || "");

    if (!nextName?.trim()) return;

    const cloned: StoredCustomMovie = JSON.parse(JSON.stringify(movieData));
    cloned.episodes[seasonIndex].server_name = nextName.trim();

    cloned.episodes[seasonIndex].server_data = cloned.episodes[
      seasonIndex
    ].server_data.map((episode) => ({
      ...episode,
      filename: `${movie.name} - ${nextName.trim()} - ${episode.name}`,
    }));

    saveUpdatedMovie(cloned, "Đã đổi tên mùa.");
  }

  function deleteEpisode(seasonIndex: number, episodeIndex: number) {
    const confirmed = window.confirm("Xóa tập này hả fen?");

    if (!confirmed) return;

    const cloned: StoredCustomMovie = JSON.parse(JSON.stringify(movieData));

    cloned.episodes[seasonIndex].server_data.splice(episodeIndex, 1);

    saveUpdatedMovie(cloned, "Đã xóa tập.");
  }

  function deleteSeason(seasonIndex: number) {
    const confirmed = window.confirm("Xóa cả mùa này hả fen?");

    if (!confirmed) return;

    const cloned: StoredCustomMovie = JSON.parse(JSON.stringify(movieData));

    cloned.episodes.splice(seasonIndex, 1);

    saveUpdatedMovie(cloned, "Đã xóa mùa.");
  }

  function moveEpisode(seasonIndex: number, episodeIndex: number, direction: -1 | 1) {
    const targetIndex = episodeIndex + direction;

    if (targetIndex < 0) return;

    const season = seasons[seasonIndex];

    if (!season || targetIndex >= season.server_data.length) return;

    const cloned: StoredCustomMovie = JSON.parse(JSON.stringify(movieData));
    const list = cloned.episodes[seasonIndex].server_data;

    const [item] = list.splice(episodeIndex, 1);
    list.splice(targetIndex, 0, item);

    saveUpdatedMovie(cloned, "Đã đổi thứ tự tập.");
  }

  function checkOneEpisodeLink(seasonIndex: number, episodeIndex: number) {
    const episode = seasons[seasonIndex]?.server_data?.[episodeIndex];
    if (!episode) return;

    const key = `${seasonIndex}-${episodeIndex}`;
    const result = checkEpisodeLink(getEpisodeLinkValue(episode));

    setLinkChecks((prev) => ({
      ...prev,
      [key]: result,
    }));
  }

  function checkAllEpisodeLinks() {
    const next: Record<string, EpisodeLinkCheck> = {};

    seasons.forEach((season, seasonIndex) => {
      season.server_data.forEach((episode, episodeIndex) => {
        next[`${seasonIndex}-${episodeIndex}`] = checkEpisodeLink(
          getEpisodeLinkValue(episode)
        );
      });
    });

    setLinkChecks(next);
    setStatus("Đã kiểm tra nhanh tất cả link tập.");
  }

  return (
    <div>
      <Link href={`/ca-nhan/${movie.slug}`} className="text-sm text-red-300">
        ← Quay lại chi tiết phim
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Quản lý mùa / tập</h1>
          <p className="mt-2 text-slate-400">{movie.name}</p>
          <p className="mt-1 text-sm text-yellow-300">
            {seasons.length} mùa · {totalEpisodes} tập · Lưu trên trình duyệt
            hiện tại
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/ca-nhan/${movie.slug}/sua`}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black hover:bg-white/10"
          >
            Sửa thông tin
          </Link>

          <button
            type="button"
            onClick={checkAllEpisodeLinks}
            className="rounded-2xl border border-yellow-300/30 bg-yellow-300/10 px-5 py-3 text-sm font-black text-yellow-100 hover:bg-yellow-300 hover:text-black"
          >
            Check tất cả link
          </button>

          <Link
            href={`/ca-nhan/${movie.slug}/xem?season=0&tap=0`}
            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black hover:bg-red-500"
          >
            Xem từ đầu
          </Link>
        </div>
      </div>

      {status && (
        <div className="mt-5 rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-sm font-semibold text-yellow-100">
          {status}
        </div>
      )}

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-black">Thêm tập vào mùa</h2>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold">Chọn hoặc nhập mùa</span>

            <input
              list="season-list"
              value={seasonName}
              onChange={(event) => setSeasonName(event.target.value)}
              placeholder="Mùa 1"
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
            />

            <datalist id="season-list">
              {seasons.map((season) => (
                <option key={season.server_name} value={season.server_name} />
              ))}
            </datalist>

            <span className="text-xs text-slate-400">
              Nếu nhập tên mùa chưa có, app sẽ tự tạo mùa mới.
            </span>
          </label>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_2fr_2fr_auto]">
            <label className="grid gap-2">
              <span className="text-sm font-bold">Tên tập</span>

              <input
                value={episodeName}
                onChange={(event) => setEpisodeName(event.target.value)}
                placeholder="Để trống sẽ tự đặt Tập 01, Tập 02..."
                className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">Link tập</span>

              <input
                value={episodeLink}
                onChange={(event) => setEpisodeLink(event.target.value)}
                placeholder="Google Drive / embed / m3u8 public"
                className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold">
                Link phụ đề ASS / SRT / VTT
              </span>

              <input
                value={episodeSubtitleLink}
                onChange={(event) =>
                  setEpisodeSubtitleLink(event.target.value)
                }
                placeholder="Google Drive public, có thể để trống"
                className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={addEpisode}
                className="w-full rounded-2xl bg-red-600 px-5 py-3 font-black hover:bg-red-500 md:w-auto"
              >
                Thêm tập
              </button>
            </div>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-bold">Thêm nhiều tập một lần</span>

            <textarea
              value={bulkEpisodesText}
              onChange={(event) => setBulkEpisodesText(event.target.value)}
              rows={7}
              placeholder={`Tập 04 | https://drive.google.com/file/d/video04/view | https://drive.google.com/file/d/sub04/view
Tập 05 | https://drive.google.com/file/d/video05/view | https://drive.google.com/file/d/sub05/view
Tập 06 | https://drive.google.com/file/d/video06/view`}
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
            />

            <span className="text-xs text-slate-400">
              Mỗi dòng một tập. Dùng dạng{" "}
              <b>Tên tập | Link video | Link phụ đề</b>. Cột phụ đề có thể
              để trống; hỗ trợ ASS, SRT và VTT trên Google Drive.
            </span>
          </label>

          <button
            type="button"
            onClick={addBulkEpisodes}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black hover:bg-white/10"
          >
            Thêm nhiều tập
          </button>
        </div>
      </section>

      <section className="mt-8 space-y-6">
        {seasons.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-slate-400">
            Chưa có mùa nào. Hãy thêm tập đầu tiên để tạo mùa.
          </div>
        ) : (
          seasons.map((season, seasonIndex) => (
            <div
              key={`${season.server_name}-${seasonIndex}`}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">
                    {season.server_name || `Mùa ${seasonIndex + 1}`}
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    {season.server_data.length} tập
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => renameSeason(seasonIndex)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-white/10"
                  >
                    Đổi tên mùa
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteSeason(seasonIndex)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-red-600"
                  >
                    Xóa mùa
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                {season.server_data.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
                    Mùa này chưa có tập.
                  </div>
                ) : (
                  season.server_data.map((episode, episodeIndex) => {
                    const checkKey = `${seasonIndex}-${episodeIndex}`;
                    const checkResult = linkChecks[checkKey];

                    return (
                      <details
                        key={`${episode.name}-${episodeIndex}`}
                        className="rounded-2xl border border-white/10 bg-black/20 p-3"
                      >
                        <summary className="cursor-pointer list-none">
                          <div className="flex items-center justify-between gap-3">
                            <Link
                              href={`/ca-nhan/${movie.slug}/xem?season=${seasonIndex}&tap=${episodeIndex}`}
                              className="font-bold hover:text-red-300"
                            >
                              <span>
                                {episodeIndex + 1}. {episode.name}
                              </span>
                              {episode.subtitles?.length ? (
                                <span className="ml-2 rounded-full border border-yellow-300/30 bg-yellow-300/10 px-2 py-0.5 text-[10px] font-black text-yellow-200">
                                  CC
                                </span>
                              ) : null}
                            </Link>

                            <span className="text-xs text-slate-500">
                              Bấm để sửa
                            </span>
                          </div>
                        </summary>

                        {checkResult && (
                          <div
                            className={[
                              "mt-3 rounded-xl border p-3 text-xs font-semibold",
                              checkResult.level === "ok"
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                : checkResult.level === "warning"
                                  ? "border-yellow-300/20 bg-yellow-300/10 text-yellow-100"
                                  : "border-red-400/20 bg-red-500/10 text-red-100",
                            ].join(" ")}
                          >
                            {checkResult.message}
                          </div>
                        )}

                        <div className="mt-4 grid gap-3">
                          <label className="grid gap-2">
                            <span className="text-xs font-bold text-slate-400">
                              Tên tập
                            </span>

                            <input
                              defaultValue={episode.name}
                              onBlur={(event) =>
                                updateEpisode(seasonIndex, episodeIndex, {
                                  name: event.currentTarget.value,
                                })
                              }
                              className="rounded-xl border border-white/10 bg-[#10131d] px-3 py-2 text-sm text-white outline-none"
                            />
                          </label>

                          <label className="grid gap-2">
                            <span className="text-xs font-bold text-slate-400">
                              Link embed
                            </span>

                            <input
                              defaultValue={episode.link_embed || ""}
                              onBlur={(event) =>
                                updateEpisode(seasonIndex, episodeIndex, {
                                  link_embed: event.currentTarget.value,
                                })
                              }
                              className="rounded-xl border border-white/10 bg-[#10131d] px-3 py-2 text-sm text-white outline-none"
                            />
                          </label>

                          <label className="grid gap-2">
                            <span className="text-xs font-bold text-slate-400">
                              Link m3u8 nếu có
                            </span>

                            <input
                              defaultValue={episode.link_m3u8 || ""}
                              onBlur={(event) =>
                                updateEpisode(seasonIndex, episodeIndex, {
                                  link_m3u8: event.currentTarget.value,
                                })
                              }
                              className="rounded-xl border border-white/10 bg-[#10131d] px-3 py-2 text-sm text-white outline-none"
                            />
                          </label>

                          <label className="grid gap-2">
                            <span className="text-xs font-bold text-slate-400">
                              Phụ đề ASS / SRT / VTT
                            </span>

                            <input
                              defaultValue={episode.subtitles?.[0]?.url || ""}
                              onBlur={(event) =>
                                updateEpisode(seasonIndex, episodeIndex, {
                                  subtitles: buildDefaultSubtitle(
                                    event.currentTarget.value
                                  ),
                                })
                              }
                              placeholder="Link Google Drive public; để trống để tắt"
                              className="rounded-xl border border-white/10 bg-[#10131d] px-3 py-2 text-sm text-white outline-none"
                            />
                          </label>

                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/ca-nhan/${movie.slug}/xem?season=${seasonIndex}&tap=${episodeIndex}`}
                              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black hover:bg-red-500"
                            >
                              Xem tập này
                            </Link>

                            <button
                              type="button"
                              onClick={() => checkOneEpisodeLink(seasonIndex, episodeIndex)}
                              className="rounded-xl border border-yellow-300/30 bg-yellow-300/10 px-3 py-2 text-xs font-bold text-yellow-100 hover:bg-yellow-300 hover:text-black"
                            >
                              Check link
                            </button>

                            <button
                              type="button"
                              onClick={() => moveEpisode(seasonIndex, episodeIndex, -1)}
                              disabled={episodeIndex === 0}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              ↑ Lên
                            </button>

                            <button
                              type="button"
                              onClick={() => moveEpisode(seasonIndex, episodeIndex, 1)}
                              disabled={episodeIndex === season.server_data.length - 1}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              ↓ Xuống
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteEpisode(seasonIndex, episodeIndex)}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-red-600"
                            >
                              Xóa tập
                            </button>
                          </div>
                        </div>
                      </details>
                    );
                  })
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
