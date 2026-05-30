"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  countEpisodes,
  driveToPreviewUrl,
  getCustomMovieBySlugClient,
  readCustomMovies,
  saveCustomMovies,
  StoredCustomMovie,
} from "@/lib/customMoviesClient";
import { slugify } from "@/lib/slugify";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type EpisodeDraft = {
  name: string;
  link: string;
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
          link: parts.slice(1).join("|").trim(),
        };
      }

      return {
        name: "",
        link: line,
      };
    })
    .filter((item) => item.link);
}

export default function ManageCustomMoviePage({ params }: PageProps) {
  const { slug } = use(params);

  const [movieData, setMovieData] = useState<StoredCustomMovie | null>(null);
  const [seasonName, setSeasonName] = useState("Mùa 1");
  const [episodeName, setEpisodeName] = useState("");
  const [episodeLink, setEpisodeLink] = useState("");
  const [bulkEpisodesText, setBulkEpisodesText] = useState("");
  const [status, setStatus] = useState("");

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

  function addEpisode() {
    const cleanSeasonName = seasonName.trim() || "Mùa 1";
    const cleanEpisodeName = episodeName.trim();
    const cleanLink = episodeLink.trim();

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
      link_embed: driveToPreviewUrl(cleanLink),
      link_m3u8: cleanLink.endsWith(".m3u8") ? cleanLink : "",
    });

    saveUpdatedMovie(
      cloned,
      `Đã thêm ${finalEpisodeName} vào ${cleanSeasonName}.`
    );

    setEpisodeName("");
    setEpisodeLink("");
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
        link_embed: draft.link.endsWith(".m3u8") ? "" : driveToPreviewUrl(draft.link),
        link_m3u8: draft.link.endsWith(".m3u8") ? draft.link : "",
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

        <Link
          href={`/ca-nhan/${movie.slug}/xem?season=0&tap=0`}
          className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black hover:bg-red-500"
        >
          Xem từ đầu
        </Link>
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

          <div className="grid gap-4 md:grid-cols-[1fr_2fr_auto]">
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
              placeholder={`Tập 04 | https://drive.google.com/file/d/xxx/view
Tập 05 | https://drive.google.com/file/d/yyy/view
Tập 06 | https://drive.google.com/file/d/zzz/view`}
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
            />

            <span className="text-xs text-slate-400">
              Mỗi dòng một tập. Có thể dùng dạng <b>Tên tập | Link</b>. Nếu chỉ
              dán link, app tự đặt tên tập tiếp theo.
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
                  season.server_data.map((episode, episodeIndex) => (
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
                            {episode.name}
                          </Link>

                          <span className="text-xs text-slate-500">
                            Bấm để sửa
                          </span>
                        </div>
                      </summary>

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

                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/ca-nhan/${movie.slug}/xem?season=${seasonIndex}&tap=${episodeIndex}`}
                            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black hover:bg-red-500"
                          >
                            Xem tập này
                          </Link>

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
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
