"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getImageUrl } from "@/lib/kkphim";
import {
  readWatchHistory,
  removeWatchHistoryItem,
  type WatchHistoryItem,
} from "@/lib/watchStore";

function getHistoryHref(item: WatchHistoryItem) {
  if (item.href) {
    return item.href;
  }

  if (item.isCustom) {
    return `/ca-nhan/${item.slug}/xem?season=${item.seasonIndex ?? 0}&tap=${
      item.episodeIndex ?? 0
    }`;
  }

  return `/xem/${item.slug}?server=${item.serverIndex ?? 0}&tap=${
    item.episodeIndex ?? 0
  }`;
}

function getSourceLabel(item: WatchHistoryItem) {
  if (item.isCustom) {
    return item.seasonName || "Phim riêng";
  }

  return item.serverName || "Server";
}

export default function ContinueWatching() {
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);

  useEffect(() => {
    setHistory(readWatchHistory());

    function refreshHistory() {
      setHistory(readWatchHistory());
    }

    window.addEventListener("storage", refreshHistory);
    window.addEventListener("focus", refreshHistory);

    return () => {
      window.removeEventListener("storage", refreshHistory);
      window.removeEventListener("focus", refreshHistory);
    };
  }, []);

  function deleteItem(item: WatchHistoryItem) {
    const next = removeWatchHistoryItem({
      slug: item.slug,
      isCustom: item.isCustom,
    });

    setHistory(next);
  }

  if (!history.length) {
    return null;
  }

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Xem tiếp</h2>

          <p className="mt-1 text-sm text-slate-400">
            Những phim bạn đang xem dở.
          </p>
        </div>

        <Link
          href="/lich-su"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10"
        >
          Xem lịch sử
        </Link>
      </div>

      <div className="grid gap-4">
        {history.slice(0, 8).map((item) => {
          const href = getHistoryHref(item);
          const image = getImageUrl(item.poster_url || item.thumb_url);
          const sourceLabel = getSourceLabel(item);

          return (
            <div
              key={`${item.isCustom ? "custom" : "normal"}-${item.slug}`}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.07]"
            >
              <Link href={href} className="flex gap-4">
                <div className="h-28 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/5">
                  <img
                    src={image}
                    alt={item.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </div>

                <div className="min-w-0 flex-1 py-1">
                  <h3 className="line-clamp-1 font-black text-white">
                    {item.name}
                  </h3>

                  {item.origin_name && (
                    <p className="mt-1 line-clamp-1 text-sm text-slate-400">
                      {item.origin_name}
                    </p>
                  )}

                  <p className="mt-3 text-sm font-bold text-red-300">
                    Xem tiếp: {item.episodeName || "Tập đang xem"}
                  </p>

                  <p className="mt-1 text-sm font-bold text-yellow-300">
                    Nguồn: {sourceLabel}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                    {item.year && <span>{item.year}</span>}
                    {item.lang && <span>{item.lang}</span>}
                    {item.quality && <span>{item.quality}</span>}
                  </div>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => deleteItem(item)}
                className="absolute right-3 top-3 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-bold text-white opacity-100 hover:bg-red-600 md:opacity-0 md:group-hover:opacity-100"
              >
                Xóa
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}