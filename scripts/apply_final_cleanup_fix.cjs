const fs = require("fs");
const path = require("path");

const root = process.cwd();

function filePath(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(filePath(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(filePath(relativePath), "utf8");
}

function write(relativePath, content) {
  fs.writeFileSync(filePath(relativePath), content, "utf8");
  console.log(`patched ${relativePath}`);
}

function patchKkphim() {
  const relativePath = "lib/kkphim.ts";
  if (!exists(relativePath)) {
    throw new Error("Không tìm thấy lib/kkphim.ts");
  }

  let content = read(relativePath);

  if (!content.includes("const KKPHIM_FETCH_TIMEOUT_MS")) {
    content = content.replace(
      'const PLACEHOLDER_IMAGE = "/placeholder.svg";',
      `const PLACEHOLDER_IMAGE = "/placeholder.svg";
const KKPHIM_FETCH_TIMEOUT_MS = 8000;`
    );
  }

  content = content.replace(
    /async function fetchJson<T>\(path: string\): Promise<T> \{[\s\S]*?\n\}\n\nfunction extractItems/,
    `async function fetchJson<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : \`\${API_BASE}\${path}\`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KKPHIM_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      next: {
        revalidate: 1800,
      },
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

  content = content.replace(
    /export async function getMovieDetail\(slug: string\): Promise<MovieDetailResponse> \{[\s\S]*?\n\}\n\nexport async function getMoviesFromSlugs/,
    `export async function getMovieDetail(slug: string): Promise<MovieDetailResponse> {
  const customMovie = getCustomMovieBySlug(slug);

  if (customMovie) {
    return customMovie as MovieDetailResponse;
  }

  try {
    return await fetchJson<MovieDetailResponse>(\`/phim/\${slug}\`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    // Slug sai thật thì vẫn để trang chi tiết trả 404.
    if (message.includes("KKPhim API error: 404")) {
      throw error;
    }

    console.warn("Lỗi lấy chi tiết phim:", slug, error);

    return {
      movie: {
        name: "Không tải được dữ liệu phim",
        slug,
        origin_name: "Nguồn phim đang phản hồi chậm. Thử tải lại sau ít phút.",
        content:
          "KKPhim đang lỗi hoặc phản hồi quá chậm, nên BảoFlix tạm thời không lấy được thông tin phim này.",
        episode_current: "Đang lỗi nguồn",
      },
      episodes: [],
    };
  }
}

export async function getMoviesFromSlugs`
  );

  write(relativePath, content);
}

function patchWatchPage() {
  const relativePath = "app/xem/[slug]/page.tsx";
  if (!exists(relativePath)) {
    console.warn("skip app/xem/[slug]/page.tsx: not found");
    return;
  }

  let content = read(relativePath);

  const oldLine = `  const data = await getMovieDetail(slug);
  const servers = data.episodes ?? [];`;

  const newBlock = `  let data: Awaited<ReturnType<typeof getMovieDetail>>;

  try {
    data = await getMovieDetail(slug);
  } catch {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        <h1 className="text-2xl font-black">Không tải được phim</h1>

        <p className="mt-2 text-slate-400">
          Nguồn phim đang lỗi hoặc phản hồi quá chậm. Thử tải lại sau ít phút.
        </p>

        <Link
          href={\`/phim/\${slug}\`}
          className="mt-5 inline-block rounded-2xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500"
        >
          Quay lại chi tiết phim
        </Link>
      </div>
    );
  }

  const servers = data.episodes ?? [];`;

  if (content.includes(oldLine)) {
    content = content.replace(oldLine, newBlock);
  } else if (!content.includes("Không tải được phim")) {
    console.warn("Không tìm thấy đoạn getMovieDetail trong watch page; hãy kiểm tra thủ công.");
  }

  write(relativePath, content);
}

function patchMobileBackButton() {
  const relativePath = "components/MobileBackButton.tsx";
  if (!exists(relativePath)) {
    console.warn("skip components/MobileBackButton.tsx: not found");
    return;
  }

  const content = `"use client";

import { usePathname, useRouter } from "next/navigation";

function shouldHideBackButton(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/xem") ||
    /^\\/ca-nhan\\/[^/]+\\/xem/.test(pathname)
  );
}

export default function MobileBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (shouldHideBackButton(pathname)) {
    return null;
  }

  function goBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="fixed bottom-24 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/80 text-xl text-white shadow-2xl backdrop-blur md:hidden"
      aria-label="Quay lại"
    >
      ←
    </button>
  );
}
`;

  write(relativePath, content);
}

patchKkphim();
patchWatchPage();
patchMobileBackButton();

console.log("Done. Run: npm run lint && npm run build");