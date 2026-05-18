const API_BASE = "https://phimapi.com";
const IMAGE_BASE = "https://phimimg.com";
import { getCustomMovieBySlug } from "@/data/custom-movies";

export type MovieItem = {
  _id?: string;
  name: string;
  slug: string;
  origin_name?: string;
  thumb_url?: string;
  poster_url?: string;
  year?: number;
  episode_current?: string;
  quality?: string;
  lang?: string;
};

export type Taxonomy = {
  name: string;
  slug: string;
};

export type Episode = {
  name: string;
  slug?: string;
  filename?: string;
  link_embed?: string;
  link_m3u8?: string;
};

export type MovieDetail = MovieItem & {
  content?: string;
  type?: string;
  status?: string;
  time?: string;
  episode_total?: string;
  category?: Taxonomy[];
  country?: Taxonomy[];
  actor?: string[] | string;
  director?: string[] | string;
};

export type MovieDetailResponse = {
  movie: MovieDetail;
  episodes: {
    server_name: string;
    server_data: Episode[];
  }[];
};

export type FilterValues = {
  page?: number;
  limit?: number;
  type?: string;
  category?: string;
  country?: string;
  year?: string;
  sort_lang?: string;
  sort_field?: string;
  sort_type?: string;
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    throw new Error(`KKPhim API error: ${res.status}`);
  }

  return res.json();
}

function extractItems(data: any): MovieItem[] {
  return data?.items ?? data?.data?.items ?? [];
}

function getTitle(data: any, fallback: string) {
  return data?.data?.titlePage ?? data?.titlePage ?? fallback;
}

function getPagination(data: any) {
  return data?.data?.params?.pagination ?? data?.params?.pagination ?? null;
}

function cleanValue(value?: string) {
  if (!value) return "";
  if (value === "tat-ca") return "";
  return value;
}

function appendFilterParams(
  params: URLSearchParams,
  filters: Partial<FilterValues>
) {
  const sortLang = cleanValue(filters.sort_lang);
  const category = cleanValue(filters.category);
  const country = cleanValue(filters.country);
  const year = cleanValue(filters.year);

  if (sortLang) params.set("sort_lang", sortLang);
  if (category) params.set("category", category);
  if (country) params.set("country", country);
  if (year) params.set("year", year);
}

export function getImageUrl(url?: string) {
  if (!url) return "/placeholder.png";

  // Ảnh local trong thư mục public
  // Ví dụ: /custom-posters/poster.jpg
  if (url.startsWith("/")) {
    return url;
  }

  // Ảnh full URL
  if (url.startsWith("http")) {
    return url;
  }

  // Ảnh từ KKPhim
  return `${IMAGE_BASE}/${url.replace(/^\/+/, "")}`;
}

export function getWebpImageUrl(url?: string) {
  const imageUrl = getImageUrl(url);

  if (imageUrl === "/placeholder.png") {
    return imageUrl;
  }

  // Không convert ảnh local qua API KKPhim
  if (imageUrl.startsWith("/")) {
    return imageUrl;
  }

  return `${API_BASE}/image.php?url=${encodeURIComponent(imageUrl)}`;
}

export async function getLatestMovies(page = 1) {
  const data = await fetchJson<any>(
    `/danh-sach/phim-moi-cap-nhat-v3?page=${page}`
  );

  return extractItems(data);
}

export async function getMovieDetail(slug: string) {
  const customMovie = getCustomMovieBySlug(slug);

  if (customMovie) {
    return customMovie as MovieDetailResponse;
  }

  return fetchJson<MovieDetailResponse>(`/phim/${slug}`);
}

export async function getMoviesByList(
  type: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
) {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, filters);

  const data = await fetchJson<any>(`/v1/api/danh-sach/${type}?${params}`);

  return {
    title: getTitle(data, "Danh sách phim"),
    items: extractItems(data),
    pagination: getPagination(data),
  };
}

export async function searchMovies(
  keyword: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
) {
  const params = new URLSearchParams({
    keyword,
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, filters);

  const data = await fetchJson<any>(`/v1/api/tim-kiem?${params}`);

  return {
    title: getTitle(data, `Tìm kiếm: ${keyword}`),
    items: extractItems(data),
    pagination: getPagination(data),
  };
}

export async function getGenres() {
  return fetchJson<Taxonomy[]>(`/the-loai`);
}

export async function getCountries() {
  return fetchJson<Taxonomy[]>(`/quoc-gia`);
}

export async function getMoviesByGenre(
  slug: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
) {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  const sortLang = cleanValue(filters.sort_lang);
  const country = cleanValue(filters.country);
  const year = cleanValue(filters.year);

  if (sortLang) params.set("sort_lang", sortLang);
  if (country) params.set("country", country);
  if (year) params.set("year", year);

  const data = await fetchJson<any>(`/v1/api/the-loai/${slug}?${params}`);

  return {
    title: getTitle(data, "Thể loại phim"),
    items: extractItems(data),
    pagination: getPagination(data),
  };
}

export async function getMoviesByCountry(
  slug: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
) {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  const sortLang = cleanValue(filters.sort_lang);
  const category = cleanValue(filters.category);
  const year = cleanValue(filters.year);

  if (sortLang) params.set("sort_lang", sortLang);
  if (category) params.set("category", category);
  if (year) params.set("year", year);

  const data = await fetchJson<any>(`/v1/api/quoc-gia/${slug}?${params}`);

  return {
    title: getTitle(data, "Quốc gia phim"),
    items: extractItems(data),
    pagination: getPagination(data),
  };
}

export async function getMoviesByYear(
  year: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
) {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  const sortLang = cleanValue(filters.sort_lang);
  const category = cleanValue(filters.category);
  const country = cleanValue(filters.country);

  if (sortLang) params.set("sort_lang", sortLang);
  if (category) params.set("category", category);
  if (country) params.set("country", country);

  const data = await fetchJson<any>(`/v1/api/nam/${year}?${params}`);

  return {
    title: getTitle(data, `Phim năm ${year}`),
    items: extractItems(data),
    pagination: getPagination(data),
  };
}

export async function getFilteredMovies(filters: FilterValues = {}) {
  const page = Number(filters.page || 1);
  const limit = Number(filters.limit || 36);

  const type = cleanValue(filters.type);
  const category = cleanValue(filters.category);
  const country = cleanValue(filters.country);
  const year = cleanValue(filters.year);

  const commonFilters: Partial<FilterValues> = {
    sort_lang: filters.sort_lang,
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    category,
    country,
    year,
  };

  if (type) {
    return getMoviesByList(type, page, limit, commonFilters);
  }

  if (category) {
    return getMoviesByGenre(category, page, limit, commonFilters);
  }

  if (country) {
    return getMoviesByCountry(country, page, limit, commonFilters);
  }

  if (year) {
    return getMoviesByYear(year, page, limit, commonFilters);
  }

  return getMoviesByList("phim-bo", page, limit, commonFilters);
}

export async function getMoviesFromSlugs(slugs: string[]) {
  const results = await Promise.allSettled(
    slugs.map((slug) => getMovieDetail(slug))
  );

  const movies: MovieDetail[] = [];
  const missingSlugs: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      movies.push(result.value.movie);
    } else {
      missingSlugs.push(slugs[index]);
    }
  });

  return {
    movies,
    missingSlugs,
  };
}

export function getPeopleList(value?: string[] | string | null) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
      .filter((item) => item.toLowerCase() !== "đang cập nhật");
  }

  return String(value)
    .split(/,|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.toLowerCase() !== "đang cập nhật");
}

function normalizeSearchText(text?: string) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSearchText(text?: string) {
  return normalizeSearchText(text).split(" ").filter(Boolean);
}

function hasExactTokenMatch(title: string, keyword: string) {
  const titleTokens = tokenizeSearchText(title);
  const keywordTokens = tokenizeSearchText(keyword);

  if (!keywordTokens.length) return true;

  return keywordTokens.every((keywordToken) =>
    titleTokens.some((titleToken) => titleToken === keywordToken)
  );
}

function hasPhraseMatch(title: string, keyword: string) {
  const normalizedTitle = normalizeSearchText(title);
  const normalizedKeyword = normalizeSearchText(keyword);

  if (!normalizedKeyword) return true;

  const pattern = new RegExp(`(^|\\s)${normalizedKeyword}(\\s|$)`, "i");
  return pattern.test(normalizedTitle);
}

export function smartFilterMoviesByKeyword<T extends MovieItem>(
  movies: T[],
  keyword: string
) {
  const q = normalizeSearchText(keyword);

  if (!q) return movies;

  const strictMatches = movies.filter((movie) => {
    const name = movie.name || "";
    const originName = movie.origin_name || "";

    return (
      hasPhraseMatch(name, keyword) ||
      hasPhraseMatch(originName, keyword) ||
      hasExactTokenMatch(name, keyword) ||
      hasExactTokenMatch(originName, keyword)
    );
  });

  if (strictMatches.length > 0) {
    return strictMatches;
  }

  return movies;
}

export function stripHtml(html?: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}