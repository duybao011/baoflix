import Link from "next/link";

type SearchParams = Record<string, string | number | undefined>;

type Props = {
  basePath: string;
  currentPage: number;
  totalPages?: number;
  searchParams?: SearchParams;
};

function createHref(
  basePath: string,
  searchParams: SearchParams,
  page: number
) {
  const params = new URLSearchParams();

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && key !== "page") {
      params.set(key, String(value));
    }
  });

  params.set("page", String(page));

  return `${basePath}?${params.toString()}`;
}

export default function Pagination({
  basePath,
  currentPage,
  totalPages,
  searchParams = {},
}: Props) {
  if (!totalPages || totalPages <= 1) return null;

  const safeCurrent = Math.max(1, Math.min(currentPage, totalPages));

  const pages = Array.from(
    new Set([
      1,
      safeCurrent - 2,
      safeCurrent - 1,
      safeCurrent,
      safeCurrent + 1,
      safeCurrent + 2,
      totalPages,
    ])
  ).filter((page) => page >= 1 && page <= totalPages);

  return (
    <div data-tv-row data-tv-row-wrap="true" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {safeCurrent > 1 && (
        <Link
          href={createHref(basePath, searchParams, safeCurrent - 1)}
          data-tv-focus-key={`pagination:prev:${safeCurrent - 1}`}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
        >
          ← Trang trước
        </Link>
      )}

      {pages.map((page, index) => {
        const previous = pages[index - 1];
        const showDots = previous && page - previous > 1;

        return (
          <div key={page} className="flex items-center gap-2">
            {showDots && <span className="text-slate-500">...</span>}

            <Link
              href={createHref(basePath, searchParams, page)}
              data-tv-focus-key={`pagination:page:${page}`}
              className={[
                "rounded-xl border px-4 py-3 text-sm font-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black",
                page === safeCurrent
                  ? "border-red-500 bg-red-600 text-white"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
              ].join(" ")}
            >
              {page}
            </Link>
          </div>
        );
      })}

      {safeCurrent < totalPages && (
        <Link
          href={createHref(basePath, searchParams, safeCurrent + 1)}
          data-tv-focus-key={`pagination:next:${safeCurrent + 1}`}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
        >
          Trang sau →
        </Link>
      )}
    </div>
  );
}
