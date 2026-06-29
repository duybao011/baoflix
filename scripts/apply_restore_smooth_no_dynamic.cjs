
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const fp = (p) => path.join(root, p);
const exists = (p) => fs.existsSync(fp(p));
const read = (p) => fs.readFileSync(fp(p), "utf8");
function write(p, c) {
  fs.mkdirSync(path.dirname(fp(p)), { recursive: true });
  fs.writeFileSync(fp(p), c, "utf8");
  console.log(`patched ${p}`);
}

function removeConnection(p) {
  if (!exists(p)) return;
  let c = read(p);
  c = c
    .replace(/import\s+\{\s*connection\s*\}\s+from\s+["']next\/server["'];\r?\n/g, "")
    .replace(/[ \t]*await\s+connection\(\);\r?\n/g, "");
  write(p, c);
}

function ensureAfterImports(c, line) {
  if (c.includes(line)) return c;
  const lines = c.split("\n");
  let i = 0;
  while (i < lines.length && (lines[i].startsWith("import ") || lines[i].trim() === "" || lines[i].trim() === '"use client";')) i++;
  lines.splice(i, 0, line);
  return lines.join("\n");
}

function replaceExportedFunction(c, name, replacement) {
  const start = c.indexOf(`export async function ${name}`);
  if (start < 0) return c;
  const next = c.indexOf("\nexport ", start + 1);
  return next < 0
    ? c.slice(0, start) + replacement.trimEnd() + "\n"
    : c.slice(0, start) + replacement.trimEnd() + "\n\n" + c.slice(next + 1);
}

const defaultGenres = `export const DEFAULT_GENRES: Taxonomy[] = [
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

`;

function patchKkphim() {
  const p = "lib/kkphim.ts";
  if (!exists(p)) return;
  let c = read(p);

  if (!c.includes("const KKPHIM_FETCH_TIMEOUT_MS")) {
    c = c.replace('const PLACEHOLDER_IMAGE = "/placeholder.svg";', 'const PLACEHOLDER_IMAGE = "/placeholder.svg";\nconst KKPHIM_FETCH_TIMEOUT_MS = 8000;');
  }

  c = c.replace(
    /async function fetchJson<T>\(path: string\): Promise<T> \{[\s\S]*?\n\}\n\nfunction extractItems/,
`async function fetchJson<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : \`\${API_BASE}\${path}\`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KKPHIM_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      next: { revalidate: 1800 },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(\`KKPhim API error: \${res.status}\`);
    }

    return res.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(\`KKPhim API timeout after \${KKPHIM_FETCH_TIMEOUT_MS}ms\`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractItems`
  );

  if (!c.includes("export const DEFAULT_GENRES")) {
    const idx = c.indexOf("export async function getGenres()");
    if (idx >= 0) c = c.slice(0, idx) + defaultGenres + c.slice(idx);
  }

  c = replaceExportedFunction(c, "getGenres", `export async function getGenres() {
  return DEFAULT_GENRES;
}`);
  c = replaceExportedFunction(c, "getCountries", `export async function getCountries() {
  return DEFAULT_COUNTRIES;
}`);
  c = replaceExportedFunction(c, "getMoviesByList", `export async function getMoviesByList(
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
    const data = await fetchJson<any>(\`/v1/api/danh-sach/\${typeList}?\${params}\`);
    return buildListResult(data, \`Danh sách: \${typeList}\`);
  } catch (error) {
    console.warn("Lỗi lấy danh sách phim:", typeList, error);
    return emptyMovieResult(\`Danh sách: \${typeList}\`, page);
  }
}`);
  c = replaceExportedFunction(c, "getMoviesByGenre", `export async function getMoviesByGenre(
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
    const data = await fetchJson<any>(\`/v1/api/the-loai/\${genreSlug}?\${params}\`);
    return buildListResult(data, \`Thể loại: \${genreSlug}\`);
  } catch (error) {
    console.warn("Lỗi lấy phim theo thể loại:", genreSlug, error);
    return emptyMovieResult(\`Thể loại: \${genreSlug}\`, page);
  }
}`);
  c = replaceExportedFunction(c, "getMoviesByCountry", `export async function getMoviesByCountry(
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
    const data = await fetchJson<any>(\`/v1/api/quoc-gia/\${countrySlug}?\${params}\`);
    return buildListResult(data, \`Quốc gia: \${countrySlug}\`);
  } catch (error) {
    console.warn("Lỗi lấy phim theo quốc gia:", countrySlug, error);
    return emptyMovieResult(\`Quốc gia: \${countrySlug}\`, page);
  }
}`);
  c = replaceExportedFunction(c, "getMoviesByYear", `export async function getMoviesByYear(
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
    const data = await fetchJson<any>(\`/v1/api/nam/\${year}?\${params}\`);
    return buildListResult(data, \`Năm: \${year}\`);
  } catch (error) {
    console.warn("Lỗi lấy phim theo năm:", year, error);
    return emptyMovieResult(\`Năm: \${year}\`, page);
  }
}`);

  write(p, c);
}

function writeStaticPages() {
  write("app/quoc-gia/page.tsx", `import Link from "next/link";
import { DEFAULT_COUNTRIES } from "@/lib/kkphim";

export const revalidate = false;

export default function CountriesPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-black">Quốc gia</h1>
      <p className="mb-6 text-slate-400">Chọn quốc gia để xem danh sách phim tương ứng.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {DEFAULT_COUNTRIES.map((item) => (
          <Link key={item.slug} href={\`/quoc-gia/\${item.slug}\`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm hover:bg-white/10">
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
`);
  write("app/the-loai/page.tsx", `import Link from "next/link";
import { DEFAULT_GENRES } from "@/lib/kkphim";

export const revalidate = false;

export default function GenresPage() {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-black">Thể loại</h1>
      <p className="mb-6 text-slate-400">Chọn thể loại để xem danh sách phim tương ứng.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {DEFAULT_GENRES.map((item) => (
          <Link key={item.slug} href={\`/the-loai/\${item.slug}\`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm hover:bg-white/10">
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
`);
}

function patchHomeAndTv() {
  ["app/page.tsx", "app/tv/page.tsx"].forEach((p) => {
    if (!exists(p)) return;
    let c = read(p)
      .replace(/import\s+\{\s*connection\s*\}\s+from\s+["']next\/server["'];\r?\n/g, "")
      .replace(/[ \t]*await\s+connection\(\);\r?\n/g, "");
    c = ensureAfterImports(c, "export const revalidate = 1800;");
    write(p, c);
  });
}

function writeRelatedSafe() {
  if (!exists("components/RelatedMovies.tsx")) return;
  write("components/RelatedMovies.tsx", `import MovieGrid from "@/components/MovieGrid";
import { getMoviesByCountry, getMoviesByGenre, getMoviesByYear, MovieDetail, MovieItem, MovieListResult } from "@/lib/kkphim";

function addUniqueMovies(target: MovieItem[], source: MovieItem[], currentSlug: string) {
  const existingSlugs = new Set(target.map((movie) => movie.slug));
  source.forEach((movie) => {
    if (!movie?.slug || movie.slug === currentSlug || existingSlugs.has(movie.slug)) return;
    target.push(movie);
    existingSlugs.add(movie.slug);
  });
}

async function safeRelatedResult(label: string, loader: () => Promise<MovieListResult>) {
  try {
    return await loader();
  } catch (error) {
    console.warn("Lỗi lấy phim liên quan:", label, error);
    return null;
  }
}

export default async function RelatedMovies({ movie }: { movie: MovieDetail }) {
  const countrySlug = movie.country?.[0]?.slug;
  const categorySlug = movie.category?.[0]?.slug;
  const year = movie.year ? String(movie.year) : "";
  const relatedMovies: MovieItem[] = [];

  if (countrySlug) {
    const result = await safeRelatedResult(countrySlug, () => getMoviesByCountry(countrySlug, 1, 24));
    addUniqueMovies(relatedMovies, result?.items || [], movie.slug);
  }

  if (categorySlug && relatedMovies.length < 18) {
    const result = await safeRelatedResult(categorySlug, () => getMoviesByGenre(categorySlug, 1, 24));
    addUniqueMovies(relatedMovies, result?.items || [], movie.slug);
  }

  if (year && relatedMovies.length < 18) {
    const result = await safeRelatedResult(year, () => getMoviesByYear(year, 1, 24));
    addUniqueMovies(relatedMovies, result?.items || [], movie.slug);
  }

  const movies = relatedMovies.slice(0, 18);
  if (!movies.length) return null;

  return (
    <section>
      <MovieGrid title="Có thể fen sẽ thích" movies={movies} />
    </section>
  );
}
`);
}

[
  "app/page.tsx",
  "app/tv/page.tsx",
  "app/loc/page.tsx",
  "app/tim-kiem/page.tsx",
  "app/danh-sach/[slug]/page.tsx",
  "app/the-loai/[slug]/page.tsx",
  "app/quoc-gia/[slug]/page.tsx",
  "app/nam/[year]/page.tsx",
  "app/quoc-gia/page.tsx",
  "app/the-loai/page.tsx",
].forEach(removeConnection);

patchKkphim();
writeStaticPages();
patchHomeAndTv();
writeRelatedSafe();

console.log("Done. Run: npm run lint && npm run build && npm run dev");
