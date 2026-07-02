import Link from "next/link";

type SearchParams = Record<string, string | number | undefined>;

type Props = {
  basePath: string;
  currentPage: number;
  totalPages?: number;
  searchParams?: SearchParams;
  focusTargetId?: string;
};

function shouldKeepParam(key: string, value: string) {
  if (!value || value === "tat-ca") return false;
  if (key === "page" && value === "1") return false;
  if (key === "sort_field" && value === "modified.time") return false;
  if (key === "sort_type" && value === "desc") return false;
  return true;
}

function createHref(
  basePath: string,
  searchParams: SearchParams,
  page: number,
  focusTargetId?: string
) {
  const params = new URLSearchParams();

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (value === undefined) return;

    const stringValue = String(value);
    if (!shouldKeepParam(key, stringValue)) return;

    params.set(key, stringValue);
  });

  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  const href = query ? `${basePath}?${query}` : basePath;
  return focusTargetId ? `${href}#${focusTargetId}` : href;
}

export default function Pagination({
  basePath,
  currentPage,
  totalPages,
  searchParams = {},
  focusTargetId,
}: Props) {
  if (!totalPages || totalPages <= 1) return null;

  const safeCurrent = Math.max(1, Math.min(currentPage, totalPages));
  const replaceNavigation = basePath === "/loc";

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
    <section data-tv-section="filter-pagination" className="pt-1 pb-6">
      <div
        data-tv-row
        data-tv-row-key="filter:pagination"
        data-tv-row-wrap="true"
        className="flex flex-wrap items-center justify-center gap-2"
      >
        {safeCurrent > 1 && (
          <Link
            href={createHref(basePath, searchParams, safeCurrent - 1, focusTargetId)}
            replace={replaceNavigation}
            scroll={false}
            data-tv-loc-page-nav={replaceNavigation ? "true" : undefined}
            data-tv-focus-key={`pagination:prev:${safeCurrent - 1}`}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
          >
            ← Trước
          </Link>
        )}

        {pages.map((page, index) => {
          const previous = pages[index - 1];
          const showDots = previous && page - previous > 1;

          return (
            <div key={page} className="flex items-center gap-2">
              {showDots && <span className="text-xs text-slate-500">...</span>}

              <Link
                href={createHref(basePath, searchParams, page, focusTargetId)}
                replace={replaceNavigation}
                scroll={false}
                data-tv-loc-page-nav={replaceNavigation ? "true" : undefined}
                data-tv-page-current={page === safeCurrent ? "true" : undefined}
                data-tv-focus-key={`pagination:page:${page}`}
                className={[
                  "rounded-xl border px-3 py-2 text-xs font-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black",
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
            href={createHref(basePath, searchParams, safeCurrent + 1, focusTargetId)}
            replace={replaceNavigation}
            scroll={false}
            data-tv-loc-page-nav={replaceNavigation ? "true" : undefined}
            data-tv-focus-key={`pagination:next:${safeCurrent + 1}`}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
          >
            Sau →
          </Link>
        )}
      </div>
    </section>
  );
}
