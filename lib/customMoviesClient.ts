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

  const next = [
    movie,
    ...movies.filter((item) => item.movie.slug !== movie.movie.slug),
  ];

  saveCustomMovies(next);
  return next;
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

  const episodeLines = input.episodesText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const episodes = episodeLines.map((line, index) => {
  let episodeName = `Tập ${String(index + 1).padStart(2, "0")}`;
  let linkRaw = line;

  if (line.includes("|")) {
    const parts = line.split("|");
    episodeName = parts[0]?.trim() || episodeName;
    linkRaw = parts.slice(1).join("|").trim();
  }

  const link = driveToPreviewUrl(linkRaw || "");

  return {
    name: episodeName,
    slug: slugify(episodeName),
    filename: `${name} - ${episodeName}`,
    link_embed: link,
    link_m3u8: "",
  };
});

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
      thumb_url: input.thumbUrl?.trim() || input.posterUrl?.trim() || "/placeholder.png",
      episode_current: `${episodes.length} tập`,
      episode_total: String(episodes.length),
      quality: "HD",
      lang: "Phim riêng",
      type: "series",
      status: "ongoing",
      year: Number.isFinite(yearNumber) ? yearNumber : undefined,
      content: input.content?.trim() || "Phim riêng do bạn tự thêm vào BảoFlix.",
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
    episodes: [
      {
        server_name: "Nguồn riêng",
        server_data: episodes,
      },
    ],
  };

  return response;
}