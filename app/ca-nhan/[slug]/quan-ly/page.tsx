"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
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

export default function ManageCustomMoviePage({ params }: PageProps) {
  const { slug } = use(params);

  const [movieData, setMovieData] = useState<StoredCustomMovie | null>(null);
  const [seasonName, setSeasonName] = useState("Mùa 1");
  const [episodeName, setEpisodeName] = useState("");
  const [episodeLink, setEpisodeLink] = useState("");

  useEffect(() => {
    const found = getCustomMovieBySlugClient(slug) || null;
    setMovieData(found);

    if (found?.episodes?.[0]?.server_name) {
      setSeasonName(found.episodes[0].server_name);
    }
  }, [slug]);

  if (!movieData) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        Không tìm thấy phim riêng.

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

  function saveUpdatedMovie(updated: StoredCustomMovie) {
    const all = readCustomMovies();

    const next = [
      updated,
      ...all.filter((item) => item.movie.slug !== updated.movie.slug),
    ];

    saveCustomMovies(next);
    setMovieData(updated);
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

    const currentSeason = cloned.episodes[seasonIndex];
    const nextEpisodeNumber = currentSeason.server_data.length + 1;

    const finalEpisodeName =
      cleanEpisodeName || `Tập ${String(nextEpisodeNumber).padStart(2, "0")}`;

    currentSeason.server_data.push({
      name: finalEpisodeName,
      slug: slugify(finalEpisodeName),
      filename: `${movie.name} - ${cleanSeasonName} - ${finalEpisodeName}`,
      link_embed: driveToPreviewUrl(cleanLink),
      link_m3u8: "",
    });

    const totalEpisodes = cloned.episodes.reduce(
      (total, item) => total + item.server_data.length,
      0
    );

    cloned.movie.episode_current = `${totalEpisodes} tập`;
    cloned.movie.episode_total = String(totalEpisodes);
    cloned.updatedAt = new Date().toISOString();

    saveUpdatedMovie(cloned);

    setEpisodeName("");
    setEpisodeLink("");
  }

  function deleteEpisode(seasonIndex: number, episodeIndex: number) {
    const confirmed = window.confirm("Xóa tập này hả fen?");

    if (!confirmed) return;

    const cloned: StoredCustomMovie = JSON.parse(JSON.stringify(movieData));

    cloned.episodes[seasonIndex].server_data.splice(episodeIndex, 1);

    const totalEpisodes = cloned.episodes.reduce(
      (total, item) => total + item.server_data.length,
      0
    );

    cloned.movie.episode_current = `${totalEpisodes} tập`;
    cloned.movie.episode_total = String(totalEpisodes);
    cloned.updatedAt = new Date().toISOString();

    saveUpdatedMovie(cloned);
  }

  function deleteSeason(seasonIndex: number) {
    const confirmed = window.confirm("Xóa cả mùa này hả fen?");

    if (!confirmed) return;

    const cloned: StoredCustomMovie = JSON.parse(JSON.stringify(movieData));

    cloned.episodes.splice(seasonIndex, 1);

    const totalEpisodes = cloned.episodes.reduce(
      (total, item) => total + item.server_data.length,
      0
    );

    cloned.movie.episode_current = `${totalEpisodes} tập`;
    cloned.movie.episode_total = String(totalEpisodes);
    cloned.updatedAt = new Date().toISOString();

    saveUpdatedMovie(cloned);
  }

  return (
    <div>
      <Link href={`/ca-nhan/${movie.slug}`} className="text-sm text-red-300">
        ← Quay lại chi tiết phim
      </Link>

      <h1 className="mt-4 text-3xl font-black">Quản lý mùa / tập</h1>

      <p className="mt-2 text-slate-400">{movie.name}</p>

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
              placeholder="https://drive.google.com/file/d/xxx/view"
              className="rounded-2xl border border-white/10 bg-[#10131d] px-4 py-3 text-white outline-none"
            />
          </label>

          <button
            type="button"
            onClick={addEpisode}
            className="rounded-2xl bg-red-600 px-5 py-3 font-black hover:bg-red-500"
          >
            Thêm tập
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

                <button
                  type="button"
                  onClick={() => deleteSeason(seasonIndex)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-red-600"
                >
                  Xóa mùa
                </button>
              </div>

              <div className="grid gap-2">
                {season.server_data.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
                    Mùa này chưa có tập.
                  </div>
                ) : (
                  season.server_data.map((episode, episodeIndex) => (
                    <div
                      key={`${episode.name}-${episodeIndex}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"
                    >
                      <Link
                        href={`/ca-nhan/${movie.slug}/xem?season=${seasonIndex}&tap=${episodeIndex}`}
                        className="font-bold hover:text-red-300"
                      >
                        {episode.name}
                      </Link>

                      <button
                        type="button"
                        onClick={() => deleteEpisode(seasonIndex, episodeIndex)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-red-600"
                      >
                        Xóa
                      </button>
                    </div>
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