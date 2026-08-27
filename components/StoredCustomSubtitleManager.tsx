"use client";

import { useState } from "react";
import type { EpisodeSubtitle } from "@/lib/kkphim";
import { getCustomSubtitleStoragePath, uploadCustomSubtitle } from "@/lib/customSubtitleStorage";
import { upsertCustomMovie, type StoredCustomMovie } from "@/lib/customMoviesClient";

type Status = { key: string; message: string; error?: boolean } | null;

function uploadedTrack(input: {
  url: string;
  storagePath: string;
  originalName: string;
}): EpisodeSubtitle {
  return {
    label: "Tiếng Việt",
    lang: "vi",
    url: input.url,
    source: "upload",
    storagePath: input.storagePath,
    originalName: input.originalName,
    default: true,
  };
}

export default function StoredCustomSubtitleManager({
  movie,
  onMovieChange,
}: {
  movie: StoredCustomMovie;
  onMovieChange: (movie: StoredCustomMovie) => void;
}) {
  const [busyKey, setBusyKey] = useState("");
  const [status, setStatus] = useState<Status>(null);

  function updateEpisode(
    seasonIndex: number,
    episodeIndex: number,
    subtitles: EpisodeSubtitle[]
  ) {
    const next: StoredCustomMovie = {
      ...movie,
      updatedAt: new Date().toISOString(),
      episodes: movie.episodes.map((season, si) =>
        si !== seasonIndex
          ? season
          : {
              ...season,
              server_data: season.server_data.map((episode, ei) =>
                ei !== episodeIndex ? episode : { ...episode, subtitles }
              ),
            }
      ),
    };

    upsertCustomMovie(next);
    onMovieChange(next);
  }

  async function upload(
    seasonIndex: number,
    episodeIndex: number,
    file: File
  ) {
    const key = `${seasonIndex}:${episodeIndex}`;
    setBusyKey(key);
    setStatus({ key, message: "Đang kiểm tra và upload..." });

    try {
      const result = await uploadCustomSubtitle({
        file,
        movieSlug: movie.movie.slug,
        seasonIndex,
        episodeIndex,
      });

      updateEpisode(seasonIndex, episodeIndex, [uploadedTrack(result)]);
      setStatus({ key, message: `✅ ${file.name} đã upload và lưu vào phim.` });
    } catch (error) {
      setStatus({
        key,
        message: error instanceof Error ? error.message : "Upload phụ đề thất bại.",
        error: true,
      });
    } finally {
      setBusyKey("");
    }
  }

  function remove(seasonIndex: number, episodeIndex: number) {
    const key = `${seasonIndex}:${episodeIndex}`;
    updateEpisode(seasonIndex, episodeIndex, []);
    setStatus({
      key,
      message: "Đã xóa phụ đề khỏi phim. File Storage cũ sẽ được dọn tự động.",
    });
  }

  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
      <h2 className="text-xl font-black text-cyan-100">Phụ đề từng tập</h2>
      <p className="mt-1 text-sm leading-6 text-slate-300">
        Upload SRT/VTT/ASS/SSA trực tiếp. Thay hoặc xóa ở đây được lưu ngay.
      </p>

      <div className="mt-4 grid gap-3">
        {movie.episodes.flatMap((season, seasonIndex) =>
          (season.server_data || []).map((episode, episodeIndex) => {
            const key = `${seasonIndex}:${episodeIndex}`;
            const subtitle = episode.subtitles?.[0];
            const uploadedPath = getCustomSubtitleStoragePath(subtitle);

            return (
              <div key={key} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black">{season.server_name} · {episode.name}</p>
                    {subtitle?.url ? (
                      <p className="mt-2 break-all text-xs text-emerald-300">
                        {uploadedPath ? "☁️ Upload BảoFlix" : "🔗 Link ngoài"} · {subtitle.url}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">Chưa có phụ đề.</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label
                      className={[
                        "cursor-pointer rounded-xl px-3 py-2 text-xs font-black",
                        busyKey === key
                          ? "cursor-wait bg-white/10 text-slate-500"
                          : "bg-cyan-300 text-black hover:bg-cyan-200",
                      ].join(" ")}
                    >
                      {busyKey === key ? "Đang upload..." : subtitle?.url ? "Thay file" : "Upload SRT"}
                      <input
                        type="file"
                        accept=".srt,.vtt,.ass,.ssa,text/plain,text/vtt,application/x-subrip"
                        disabled={busyKey === key}
                        className="hidden"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = "";
                          if (file) void upload(seasonIndex, episodeIndex, file);
                        }}
                      />
                    </label>

                    {subtitle?.url && (
                      <button
                        type="button"
                        onClick={() => remove(seasonIndex, episodeIndex)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black hover:bg-white/10"
                      >
                        Xóa phụ đề
                      </button>
                    )}
                  </div>
                </div>

                {status?.key === key && (
                  <p className={["mt-2 text-xs font-bold", status.error ? "text-red-300" : "text-cyan-200"].join(" ")}>
                    {status.message}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
