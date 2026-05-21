"use client";

import type { MovieDetailResponse } from "@/lib/kkphim";
import { slugify } from "@/lib/slugify";

export const CUSTOM_MOVIES_KEY = "baoflix_custom_movies";

export type StoredCustomMovie = MovieDetailResponse & {
  source: "local";
  createdAt: string;
  updatedAt: string;
};

export function driveToPreviewUrl(url: string) {
  const raw = url.trim();

  if (!raw) return "";

  const fileMatch = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/);

  if (fileMatch?.[1]) {
    return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  }

  const idMatch = raw.match(/[?&]id=([^&]+)/);

  if (idMatch?.[1]) {
    return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  }

  return raw;
}

export function readCustomMovies(): StoredCustomMovie[] {
  try {
    const raw = localStorage.getItem(CUSTOM_MOVIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomMovies(movies: StoredCustomMovie[]) {
  localStorage.setItem(CUSTOM_MOVIES_KEY, JSON.stringify(movies));
}

export function getCustomMovieBySlugClient(slug: string) {
  return readCustomMovies().find((item) => item.movie.slug === slug);
}

export function deleteCustomMovie(slug: string) {
  const next = readCustomMovies().filter((item) => item.movie.slug !== slug);
  saveCustomMovies(next);
  return next;
}

export function upsertCustomMovie(movie: StoredCustomMovie) {
  const movies = readCustomMovies();

  const oldMovie = movies.find((item) => item.movie.slug === movie.movie.slug);

  const nextMovie: StoredCustomMovie = {
    ...movie,
    createdAt: oldMovie?.createdAt || movie.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const next = [
    nextMovie,
    ...movies.filter((item) => item.movie.slug !== movie.movie.slug),
  ];

  saveCustomMovies(next);

  return next;
}

function parseSeasonsFromText(name: string, episodesText: string) {
  const lines = episodesText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const seasons: {
    server_name: string;
    server_data: {
      name: string;
      slug: string;
      filename: string;
      link_embed: string;
      link_m3u8: string;
    }[];
  }[] = [];

  let currentSeason = {
    server_name: "Mùa 1",
    server_data: [] as {
      name: string;
      slug: string;
      filename: string;
      link_embed: string;
      link_m3u8: string;
    }[],
  };

  function pushCurrentSeason() {
    if (currentSeason.server_data.length > 0) {
      seasons.push(currentSeason);
    }
  }

  lines.forEach((line) => {
    if (line.startsWith("#")) {
      pushCurrentSeason();

      currentSeason = {
        server_name:
          line.replace(/^#+/, "").trim() || `Mùa ${seasons.length + 1}`,
        server_data: [],
      };

      return;
    }

    const index = currentSeason.server_data.length + 1;

    let episodeName = `Tập ${String(index).padStart(2, "0")}`;
    let linkRaw = line;

    if (line.includes("|")) {
      const parts = line.split("|");
      episodeName = parts[0]?.trim() || episodeName;
      linkRaw = parts.slice(1).join("|").trim();
    }

    const link = driveToPreviewUrl(linkRaw || "");

    currentSeason.server_data.push({
      name: episodeName,
      slug: slugify(episodeName),
      filename: `${name} - ${currentSeason.server_name} - ${episodeName}`,
      link_embed: link,
      link_m3u8: "",
    });
  });

  pushCurrentSeason();

  return seasons.length > 0
    ? seasons
    : [
        {
          server_name: "Mùa 1",
          server_data: [],
        },
      ];
}

function countEpisodes(
  seasons: {
    server_name: string;
    server_data: unknown[];
  }[]
) {
  return seasons.reduce((total, season) => total + season.server_data.length, 0);
}

export function createCustomMovieFromForm(input: {
  name: string;
  originName?: string;
  slug?: string;
  posterUrl?: string;
  thumbUrl?: string;
  content?: string;
  year?: string;
  countryName?: string;
  countrySlug?: string;
  categories?: string;
  actors?: string;
  episodesText: string;
}) {
  const now = new Date().toISOString();
  const name = input.name.trim();
  const slug = input.slug?.trim() || slugify(name);

  const seasons = parseSeasonsFromText(name, input.episodesText);
  const totalEpisodes = countEpisodes(seasons);

  const categoryList = (input.categories || "Phim riêng")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({
      name: item,
      slug: slugify(item),
    }));

  const actorList = (input.actors || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const yearNumber = input.year ? Number(input.year) : undefined;

  const response: StoredCustomMovie = {
    source: "local",
    createdAt: now,
    updatedAt: now,
    movie: {
      _id: `custom-${slug}`,
      name,
      slug,
      origin_name: input.originName?.trim() || name,
      poster_url: input.posterUrl?.trim() || "/placeholder.png",
      thumb_url:
        input.thumbUrl?.trim() ||
        input.posterUrl?.trim() ||
        "/placeholder.png",
      episode_current: `${totalEpisodes} tập`,
      episode_total: String(totalEpisodes),
      quality: "HD",
      lang: "Phim riêng",
      type: "series",
      status: "ongoing",
      year: Number.isFinite(yearNumber) ? yearNumber : undefined,
      content:
        input.content?.trim() || "Phim riêng do bạn tự thêm vào BảoFlix.",
      category: categoryList,
      country: [
        {
          name: input.countryName?.trim() || "Nhật Bản",
          slug: input.countrySlug?.trim() || "nhat-ban",
        },
      ],
      actor: actorList,
      director: [],
    },
    episodes: seasons,
  };

  return response;
}