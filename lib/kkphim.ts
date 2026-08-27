import { getCustomMovieBySlug } from "@/data/custom-movies";

const API_BASE = "https://phimapi.com";
const IMAGE_BASE = "https://phimimg.com";
const PLACEHOLDER_IMAGE = "/placeholder.svg";

export type Taxonomy = {
  name: string;
  slug: string;
};

export type MovieItem = {
  _id?: string;
  name: string;
  slug: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  year?: number;
  episode_current?: string;
  episode_total?: string;
  quality?: string;
  lang?: string;
  time?: string;
  type?: string;
  status?: string;
  category?: Taxonomy[];
  country?: Taxonomy[];
};

export type MovieDetail = MovieItem & {
  content?: string;
  actor?: string[] | string;
  director?: string[] | string;
};

export type EpisodeSubtitle = {
  label: string;
  lang: string;
  url: string;
  source?: "external" | "upload";
  storagePath?: string;
  originalName?: string;
  default?: boolean;
};

export type Episode = {
  name: string;
  slug?: string;
  filename?: string;
  link_embed?: string;
  link_m3u8?: string;
  subtitles?: EpisodeSubtitle[];
};

export type EpisodeServer = {
  server_name: string;
  server_data: Episode[];
};

export type MovieDetailResponse = {
  movie: MovieDetail;
  episodes: EpisodeServer[];
};

export type PaginationData = {
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  totalItemsPerPage?: number;
};

export type MovieListResult = {
  title: string;
  items: MovieItem[];
  pagination: PaginationData;
};

export type FilterValues = {
  type?: string;
  subtype?: string;
  category?: string;
  country?: string;
  year?: string;
  sort_lang?: string;
  sort_field?: string;
  sort_type?: string;
  page?: number;
  limit?: number;
};

async function fetchJson<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const res = await fetch(url, {
    next: {
      revalidate: 1800,
    },
  });

  if (!res.ok) {
    throw new Error(`KKPhim API error: ${res.status}`);
  }

  return res.json();
}

function extractItems(data: any): MovieItem[] {
  return data?.items || data?.data?.items || data?.data || [];
}

function getTitle(data: any, fallback: string) {
  return (
    data?.titlePage ||
    data?.data?.titlePage ||
    data?.data?.seoOnPage?.titleHead ||
    fallback
  );
}

function getPagination(data: any): PaginationData {
  return (
    data?.pagination ||
    data?.data?.params?.pagination ||
    data?.data?.pagination || {
      currentPage: 1,
      totalPages: 0,
      totalItems: 0,
      totalItemsPerPage: 0,
    }
  );
}

function emptyMovieResult(title = "Không có kết quả", page = 1): MovieListResult {
  return {
    title,
    items: [],
    pagination: {
      currentPage: page,
      totalPages: 0,
      totalItems: 0,
      totalItemsPerPage: 0,
    },
  };
}

function appendFilterParams(
  params: URLSearchParams,
  filters: Partial<FilterValues>
) {
  if (filters.sort_lang && filters.sort_lang !== "tat-ca") {
    params.set("sort_lang", filters.sort_lang);
  }

  if (filters.category && filters.category !== "tat-ca") {
    params.set("category", filters.category);
  }

  if (filters.country && filters.country !== "tat-ca") {
    params.set("country", filters.country);
  }

  if (filters.year && filters.year !== "tat-ca") {
    params.set("year", filters.year);
  }
}

function buildListResult(data: any, fallbackTitle: string): MovieListResult {
  return {
    title: getTitle(data, fallbackTitle),
    items: extractItems(data),
    pagination: getPagination(data),
  };
}

function getEpisodeNumber(value?: string) {
  const text = String(value || "").toLowerCase();
  const numberMatch = text.match(/\d+/);

  if (!numberMatch) return 0;

  return Number(numberMatch[0]);
}

// BAOFLIX_V9_ANIMATION_CLASSIFICATION
function isSingleAnimation(movie: MovieItem) {
  const total = getEpisodeNumber(movie.episode_total);
  const current = String(movie.episode_current || "").toLowerCase();
  const type = String(movie.type || "").toLowerCase();

  if (type === "single") return true;
  if (type === "series") return false;

  // episode_total rõ ràng đáng tin hơn cách viết episode_current.
  // Ví dụ episode_total="1", episode_current="Tập 1" vẫn là phim lẻ.
  if (total === 1) return true;
  if (total > 1) return false;

  if (current.includes("full")) return true;
  if (current.includes("1/1")) return true;
  if (current.includes("hoàn tất") && current.includes("1/1")) return true;

  if (current.includes("tập")) return false;
  if (current.includes("/") && !current.includes("1/1")) return false;

  return false;
}

function isSeriesAnimation(movie: MovieItem) {
  const total = getEpisodeNumber(movie.episode_total);
  const current = String(movie.episode_current || "").toLowerCase();
  const type = String(movie.type || "").toLowerCase();

  if (type === "series") return true;
  if (type === "single") return false;

  if (total === 1) return false;
  if (total > 1) return true;
  if (current.includes("tập")) return true;
  if (current.includes("/") && !current.includes("1/1")) return true;

  return false;
}

function filterAnimationSubtype(
  result: MovieListResult,
  subtype?: string
): MovieListResult {
  if (!subtype || subtype === "tat-ca") return result;

  if (subtype === "phim-le") {
    return {
      ...result,
      title: `${result.title} - Phim lẻ`,
      items: result.items.filter(isSingleAnimation),
    };
  }

  if (subtype === "phim-bo") {
    return {
      ...result,
      title: `${result.title} - Phim bộ`,
      items: result.items.filter(isSeriesAnimation),
    };
  }

  return result;
}

const ANIMATION_AGGREGATE_SOURCE_PAGES = 5;
const ANIMATION_SOURCE_LIMIT = 48;

function uniqueMovies(items: MovieItem[]) {
  const map = new Map<string, MovieItem>();

  items.forEach((movie) => {
    if (!movie?.slug) return;

    if (!map.has(movie.slug)) {
      map.set(movie.slug, movie);
    }
  });

  return Array.from(map.values());
}

function paginateLocalMovies(items: MovieItem[], page: number, limit: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const start = (safePage - 1) * limit;
  const end = start + limit;

  return {
    items: items.slice(start, end),
    pagination: {
      currentPage: safePage,
      totalPages,
      totalItems,
      totalItemsPerPage: limit,
    },
  };
}

async function getAggregatedAnimationBySubtype(
  page: number,
  limit: number,
  filters: Partial<FilterValues>,
  subtype?: string
): Promise<MovieListResult> {
  const firstResult = await getMoviesByList(
    "hoat-hinh",
    1,
    ANIMATION_SOURCE_LIMIT,
    filters
  );

  const totalSourcePages = Number(firstResult.pagination?.totalPages || 1);
  const targetCount = Math.max(1, page) * Math.max(1, limit);

  let sourcePage = 2;
  let allItems = uniqueMovies(firstResult.items || []);
  let filteredResult = filterAnimationSubtype(
    { ...firstResult, items: allItems },
    subtype
  );

  while (
    sourcePage <= totalSourcePages &&
    (sourcePage <= ANIMATION_AGGREGATE_SOURCE_PAGES ||
      filteredResult.items.length < targetCount)
  ) {
    const batchPages = Array.from(
      { length: Math.min(3, totalSourcePages - sourcePage + 1) },
      (_, index) => sourcePage + index
    );

    const batch = await Promise.allSettled(
      batchPages.map((sourcePageNumber) =>
        getMoviesByList(
          "hoat-hinh",
          sourcePageNumber,
          ANIMATION_SOURCE_LIMIT,
          filters
        )
      )
    );

    allItems = uniqueMovies([
      ...allItems,
      ...batch.flatMap((result) =>
        result.status === "fulfilled" ? result.value.items || [] : []
      ),
    ]);

    filteredResult = filterAnimationSubtype(
      { ...firstResult, items: allItems },
      subtype
    );

    sourcePage += batchPages.length;
  }

  const paginated = paginateLocalMovies(filteredResult.items, page, limit);
  const hasMoreSourcePages = sourcePage <= totalSourcePages;

  return {
    ...filteredResult,
    items: paginated.items,
    pagination: {
      ...paginated.pagination,
      totalPages: hasMoreSourcePages
        ? Math.max(paginated.pagination.totalPages || 1, page + 1)
        : paginated.pagination.totalPages,
    },
  };
}

/* =========================
   Multi-tag filter merge
========================= */

const MULTI_FILTER_SOURCE_LIMIT = 40;

function parseMultiFilterValue(value?: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item !== "tat-ca");
}

function shouldUseMultiTagMerge(filters: FilterValues) {
  const categorySlugs = parseMultiFilterValue(filters.category);
  const countrySlugs = parseMultiFilterValue(filters.country);

  return categorySlugs.length > 1 || countrySlugs.length > 1;
}

function matchAnyTaxonomy(
  movie: MovieItem,
  key: "category" | "country",
  selectedSlugs: string[]
) {
  if (!selectedSlugs.length) return true;

  const list = movie[key] || [];

  if (!list.length) return false;

  return list.some((item) => selectedSlugs.includes(item.slug));
}

function applyLocalMultiTagFilter(
  items: MovieItem[],
  categorySlugs: string[],
  countrySlugs: string[]
) {
  return items.filter((movie) => {
    return (
      matchAnyTaxonomy(movie, "category", categorySlugs) &&
      matchAnyTaxonomy(movie, "country", countrySlugs)
    );
  });
}

function sortLocalMoviesByFilter(items: MovieItem[], filters: FilterValues) {
  const sortField = filters.sort_field || "modified.time";
  const sortType = filters.sort_type || "desc";
  const direction = sortType === "asc" ? 1 : -1;

  if (sortField === "year") {
    return [...items].sort((a, b) => {
      return (Number(a.year || 0) - Number(b.year || 0)) * direction;
    });
  }

  if (sortField === "_id") {
    return [...items].sort((a, b) => {
      return String(a._id || "").localeCompare(String(b._id || "")) * direction;
    });
  }

  return items;
}

function getMultiFilterTitle(
  categorySlugs: string[],
  countrySlugs: string[],
  type?: string
) {
  const parts: string[] = [];

  if (type && type !== "tat-ca") {
    parts.push(`Loại: ${type}`);
  }

  if (countrySlugs.length) {
    parts.push(`${countrySlugs.length} quốc gia`);
  }

  if (categorySlugs.length) {
    parts.push(`${categorySlugs.length} thể loại`);
  }

  return parts.length ? `Kết quả lọc: ${parts.join(" • ")}` : "Kết quả lọc";
}

async function getAggregatedMultiFilterMovies(
  filters: FilterValues = {}
): Promise<MovieListResult> {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.max(1, Number(filters.limit || 36));
  const type = filters.type || "tat-ca";
  const subtype = filters.subtype || "tat-ca";
  const year = filters.year || "tat-ca";
  const categorySlugs = parseMultiFilterValue(filters.category);
  const countrySlugs = parseMultiFilterValue(filters.country);
  const sourceLimit = Math.max(limit, MULTI_FILTER_SOURCE_LIMIT);

  const baseFilters: Partial<FilterValues> = {
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    sort_lang: filters.sort_lang,
    year: year !== "tat-ca" ? year : undefined,
  };

  function buildTasks(sourcePage: number) {
    const tasks: Promise<MovieListResult>[] = [];

    // BAOFLIX_V9_MULTI_FILTER_REQUESTS
    // Không nhân chéo category x country. Chọn phía ít lựa chọn hơn làm nguồn,
    // rồi applyLocalMultiTagFilter() giữ AND giữa hai nhóm điều kiện.
    if (categorySlugs.length && countrySlugs.length) {
      const useCategorySources =
        categorySlugs.length <= countrySlugs.length;

      if (useCategorySources) {
        categorySlugs.forEach((categorySlug) => {
          if (type && type !== "tat-ca") {
            tasks.push(getMoviesByList(type, sourcePage, sourceLimit, {
              ...baseFilters,
              category: categorySlug,
            }));
          } else {
            tasks.push(
              getMoviesByGenre(
                categorySlug,
                sourcePage,
                sourceLimit,
                baseFilters
              )
            );
          }
        });
      } else {
        countrySlugs.forEach((countrySlug) => {
          if (type && type !== "tat-ca") {
            tasks.push(getMoviesByList(type, sourcePage, sourceLimit, {
              ...baseFilters,
              country: countrySlug,
            }));
          } else {
            tasks.push(
              getMoviesByCountry(
                countrySlug,
                sourcePage,
                sourceLimit,
                baseFilters
              )
            );
          }
        });
      }

      return tasks;
    }

    if (type && type !== "tat-ca") {
      categorySlugs.forEach((categorySlug) => {
        tasks.push(getMoviesByList(type, sourcePage, sourceLimit, {
          ...baseFilters,
          category: categorySlug,
        }));
      });
      countrySlugs.forEach((countrySlug) => {
        tasks.push(getMoviesByList(type, sourcePage, sourceLimit, {
          ...baseFilters,
          country: countrySlug,
        }));
      });
      return tasks;
    }

    categorySlugs.forEach((categorySlug) => {
      tasks.push(getMoviesByGenre(categorySlug, sourcePage, sourceLimit, baseFilters));
    });
    countrySlugs.forEach((countrySlug) => {
      tasks.push(getMoviesByCountry(countrySlug, sourcePage, sourceLimit, baseFilters));
    });
    return tasks;
  }

  if (!categorySlugs.length && !countrySlugs.length) {
    return getLatestMovieListResult(page, limit);
  }

  let sourcePage = 1;
  let mergedItems: MovieItem[] = [];
  let finalItems: MovieItem[] = [];
  let hasMoreSourcePages = true;
  // Đủ current page + 1 item là đủ biết còn trang sau.
  const targetCount = page * limit + 1;

  while (hasMoreSourcePages) {
    const results = await Promise.allSettled(buildTasks(sourcePage));
    const fulfilled = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    );

    if (!fulfilled.length) break;

    mergedItems = uniqueMovies([
      ...mergedItems,
      ...fulfilled.flatMap((result) => result.items || []),
    ]);

    const locallyFiltered = applyLocalMultiTagFilter(
      mergedItems,
      categorySlugs,
      countrySlugs
    );

    const subtypeFiltered =
      type === "hoat-hinh" && subtype !== "tat-ca"
        ? filterAnimationSubtype({
            title: "Hoạt hình",
            items: locallyFiltered,
            pagination: {},
          }, subtype).items
        : locallyFiltered;

    finalItems = sortLocalMoviesByFilter(subtypeFiltered, filters);

    hasMoreSourcePages = fulfilled.some((result) =>
      Number(result.pagination?.totalPages || 0) > sourcePage
    );

    if (finalItems.length >= targetCount) break;
    if (!hasMoreSourcePages) break;
    sourcePage += 1;
  }

  const paginated = paginateLocalMovies(finalItems, page, limit);

  return {
    title: getMultiFilterTitle(categorySlugs, countrySlugs, type),
    items: paginated.items,
    pagination: {
      ...paginated.pagination,
      totalPages: hasMoreSourcePages
        ? Math.max(paginated.pagination.totalPages || 1, page + 1)
        : paginated.pagination.totalPages,
    },
  };
}

export const DEFAULT_GENRES: Taxonomy[] = [
  { name: "Hành Động", slug: "hanh-dong" },
  { name: "Tình Cảm", slug: "tinh-cam" },
  { name: "Hài Hước", slug: "hai-huoc" },
  { name: "Cổ Trang", slug: "co-trang" },
  { name: "Tâm Lý", slug: "tam-ly" },
  { name: "Hình Sự", slug: "hinh-su" },
  { name: "Chiến Tranh", slug: "chien-tranh" },
  { name: "Thể Thao", slug: "the-thao" },
  { name: "Võ Thuật", slug: "vo-thuat" },
  { name: "Viễn Tưởng", slug: "vien-tuong" },
  { name: "Phiêu Lưu", slug: "phieu-luu" },
  { name: "Khoa Học", slug: "khoa-hoc" },
  { name: "Kinh Dị", slug: "kinh-di" },
  { name: "Âm Nhạc", slug: "am-nhac" },
  { name: "Thần Thoại", slug: "than-thoai" },
  { name: "Tài Liệu", slug: "tai-lieu" },
  { name: "Gia Đình", slug: "gia-dinh" },
  { name: "Chính Kịch", slug: "chinh-kich" },
  { name: "Bí Ẩn", slug: "bi-an" },
  { name: "Học Đường", slug: "hoc-duong" },
  { name: "Kinh Điển", slug: "kinh-dien" },
  { name: "Phim 18+", slug: "phim-18" },
];

export const DEFAULT_COUNTRIES: Taxonomy[] = [
  { name: "Trung Quốc", slug: "trung-quoc" },
  { name: "Hàn Quốc", slug: "han-quoc" },
  { name: "Nhật Bản", slug: "nhat-ban" },
  { name: "Thái Lan", slug: "thai-lan" },
  { name: "Âu Mỹ", slug: "au-my" },
  { name: "Hồng Kông", slug: "hong-kong" },
  { name: "Ấn Độ", slug: "an-do" },
  { name: "Anh", slug: "anh" },
  { name: "Pháp", slug: "phap" },
  { name: "Đức", slug: "duc" },
  { name: "Tây Ban Nha", slug: "tay-ban-nha" },
  { name: "Ý", slug: "y" },
  { name: "Nga", slug: "nga" },
  { name: "Úc", slug: "uc" },
  { name: "Canada", slug: "canada" },
  { name: "Việt Nam", slug: "viet-nam" },
  { name: "Đài Loan", slug: "dai-loan" },
  { name: "Indonesia", slug: "indonesia" },
  { name: "Philippines", slug: "philippines" },
  { name: "Singapore", slug: "singapore" },
  { name: "Malaysia", slug: "malaysia" },
];

export async function getGenres() {
  return DEFAULT_GENRES;
}

export async function getCountries() {
  return DEFAULT_COUNTRIES;
}

export async function getLatestMovies(page = 1) {
  try {
    const data = await fetchJson<any>(
      `/danh-sach/phim-moi-cap-nhat?page=${page}`
    );

    return extractItems(data);
  } catch {
    return [];
  }
}

export async function getLatestMovieListResult(
  page = 1,
  limit = 36
): Promise<MovieListResult> {
  try {
    const data = await fetchJson<any>(
      `/danh-sach/phim-moi-cap-nhat?page=${page}`
    );

    const items = extractItems(data).slice(0, limit);

    return {
      title: getTitle(data, "Phim mới cập nhật"),
      items,
      pagination: getPagination(data),
    };
  } catch (error) {
    console.warn("Lỗi lấy phim mới cập nhật:", error);
    return emptyMovieResult("Phim mới cập nhật", page);
  }
}

export async function getMoviesByList(
  typeList: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, filters);

  try {
    const data = await fetchJson<any>(`/v1/api/danh-sach/${typeList}?${params}`);
    return buildListResult(data, `Danh sách: ${typeList}`);
  } catch (error) {
    console.warn("Lỗi lấy danh sách phim:", typeList, error);
    return emptyMovieResult(`Danh sách: ${typeList}`, page);
  }
}

export async function getMoviesByGenre(
  genreSlug: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, { ...filters, category: undefined });

  try {
    const data = await fetchJson<any>(`/v1/api/the-loai/${genreSlug}?${params}`);
    return buildListResult(data, `Thể loại: ${genreSlug}`);
  } catch (error) {
    console.warn("Lỗi lấy phim theo thể loại:", genreSlug, error);
    return emptyMovieResult(`Thể loại: ${genreSlug}`, page);
  }
}

export async function getMoviesByCountry(
  countrySlug: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, { ...filters, country: undefined });

  try {
    const data = await fetchJson<any>(`/v1/api/quoc-gia/${countrySlug}?${params}`);
    return buildListResult(data, `Quốc gia: ${countrySlug}`);
  } catch (error) {
    console.warn("Lỗi lấy phim theo quốc gia:", countrySlug, error);
    return emptyMovieResult(`Quốc gia: ${countrySlug}`, page);
  }
}

export async function getMoviesByYear(
  year: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, { ...filters, year: undefined });

  try {
    const data = await fetchJson<any>(`/v1/api/nam/${year}?${params}`);
    return buildListResult(data, `Năm: ${year}`);
  } catch (error) {
    console.warn("Lỗi lấy phim theo năm:", year, error);
    return emptyMovieResult(`Năm: ${year}`, page);
  }
}

export async function getFilteredMovies(
  filters: FilterValues = {}
): Promise<MovieListResult> {
  const page = Number(filters.page || 1);
  const limit = Number(filters.limit || 36);

  const type = filters.type || "tat-ca";
  const category = filters.category || "tat-ca";
  const country = filters.country || "tat-ca";
  const year = filters.year || "tat-ca";

  if (shouldUseMultiTagMerge(filters)) {
    try {
      return await getAggregatedMultiFilterMovies(filters);
    } catch (error) {
      console.warn("Lỗi lọc nhiều tag:", error);
      return emptyMovieResult("Kết quả lọc nhiều tag", page);
    }
  }

  const commonFilters: Partial<FilterValues> = {
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    sort_lang: filters.sort_lang,
    country,
    year,
  };

  if (type === "hoat-hinh") {
    try {
      const animationFilters = {
        sort_field: commonFilters.sort_field,
        sort_type: commonFilters.sort_type,
        sort_lang: commonFilters.sort_lang,
        country,
        year,
        category: category !== "tat-ca" ? category : undefined,
      };

      if (filters.subtype && filters.subtype !== "tat-ca") {
        return await getAggregatedAnimationBySubtype(
          page,
          limit,
          animationFilters,
          filters.subtype
        );
      }

      return await getMoviesByList("hoat-hinh", page, limit, animationFilters);
    } catch (error) {
      console.warn("Lỗi lọc hoạt hình:", error);
      return emptyMovieResult("Hoạt hình", page);
    }
  }

  if (type && type !== "tat-ca") {
    try {
      return await getMoviesByList(type, page, limit, {
        ...commonFilters,
        category: category !== "tat-ca" ? category : undefined,
      });
    } catch (error) {
      console.warn("Lỗi lọc loại phim:", type, error);
      return emptyMovieResult("Kết quả lọc", page);
    }
  }

  if (category && category !== "tat-ca") {
    try {
      return await getMoviesByGenre(category, page, limit, commonFilters);
    } catch (error) {
      console.warn("Lỗi lọc thể loại:", category, error);
      return emptyMovieResult("Kết quả lọc", page);
    }
  }

  if (country && country !== "tat-ca") {
    try {
      return await getMoviesByCountry(country, page, limit, {
        sort_field: commonFilters.sort_field,
        sort_type: commonFilters.sort_type,
        sort_lang: commonFilters.sort_lang,
        year,
      });
    } catch (error) {
      console.warn("Lỗi lọc quốc gia:", country, error);
      return emptyMovieResult("Kết quả lọc", page);
    }
  }

  if (year && year !== "tat-ca") {
    try {
      return await getMoviesByYear(year, page, limit, {
        sort_field: commonFilters.sort_field,
        sort_type: commonFilters.sort_type,
        sort_lang: commonFilters.sort_lang,
      });
    } catch (error) {
      console.warn("Lỗi lọc năm:", year, error);
      return emptyMovieResult("Kết quả lọc", page);
    }
  }

  return await getLatestMovieListResult(page, limit);
}

export async function searchMovies(
  keyword: string,
  page = 1,
  limit = 36,
  filters: Partial<FilterValues> = {}
): Promise<MovieListResult> {
  const params = new URLSearchParams({
    keyword,
    page: String(page),
    sort_field: filters.sort_field || "modified.time",
    sort_type: filters.sort_type || "desc",
    limit: String(limit),
  });

  appendFilterParams(params, filters);

  try {
    const data = await fetchJson<any>(`/v1/api/tim-kiem?${params}`);

    return {
      title: getTitle(data, `Tìm kiếm: ${keyword}`),
      items: extractItems(data),
      pagination: getPagination(data),
    };
  } catch (error) {
    console.warn("Lỗi tìm kiếm:", error);
    return emptyMovieResult(`Tìm kiếm: ${keyword}`, page);
  }
}

export async function getMovieDetail(slug: string): Promise<MovieDetailResponse> {
  const customMovie = getCustomMovieBySlug(slug);

  if (customMovie) {
    return customMovie as MovieDetailResponse;
  }

  return fetchJson<MovieDetailResponse>(`/phim/${slug}`);
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

export function getImageUrl(url?: string) {
  const rawUrl = String(url || "").trim();

  if (!rawUrl) return PLACEHOLDER_IMAGE;

  // Chặn dữ liệu cũ còn lưu /placeholder.png trong localStorage/history/favorite.
  if (
    rawUrl === "/placeholder.png" ||
    rawUrl === "placeholder.png" ||
    rawUrl.endsWith("/placeholder.png")
  ) {
    return PLACEHOLDER_IMAGE;
  }

  if (rawUrl.startsWith("/")) {
    return rawUrl;
  }

  if (rawUrl.startsWith("http")) {
    return rawUrl;
  }

  return `${IMAGE_BASE}/${rawUrl.replace(/^\/+/, "")}`;
}

export function getWebpImageUrl(url?: string) {
  const imageUrl = getImageUrl(url);

  if (imageUrl === PLACEHOLDER_IMAGE) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    return imageUrl;
  }

  return `${API_BASE}/image.php?url=${encodeURIComponent(imageUrl)}`;
}

export function stripHtml(html?: string) {
  return String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
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
  moviesInput: T[] | { items?: T[] } | null | undefined,
  keyword: string
) {
  const movies: T[] = Array.isArray(moviesInput)
    ? moviesInput
    : Array.isArray(moviesInput?.items)
      ? moviesInput.items
      : [];

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
