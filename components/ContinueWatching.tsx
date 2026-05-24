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

function formatWatchedTime(value?: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function ContinueCard({
  item,
  onDelete,
}: {
  item: WatchHistoryItem;
  onDelete: () => void;
}) {
  const href = getHistoryHref(item);
  const image = getImageUrl(item.poster_url || item.thumb_url);
  const sourceLabel = getSourceLabel(item);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] transition hover:-translate-y-1 hover:bg-white/[0.075]">
      <Link href={href} className="block">
        <div className="relative aspect-[2/3] overflow-hidden bg-slate-900">
          <img
            src={image}
            alt={item.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent p-2 pt-14">
            <p className="line-clamp-1 text-[11px] font-black text-red-300">
              Xem tiếp: {item.episodeName || "Tập đang xem"}
            </p>

            <p className="mt-0.5 line-clamp-1 text-[10px] font-bold text-yellow-300">
              {sourceLabel}
            </p>
          </div>

          {item.quality && (
            <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-black text-white">
              {item.quality}
            </span>
          )}

          {item.isCustom && (
            <span className="absolute right-2 top-2 rounded-full bg-yellow-300 px-2 py-1 text-[10px] font-black text-black">
              Riêng
            </span>
          )}
        </div>

        <div className="space-y-1 p-3">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-5 text-white">
            {item.name}
          </h3>

          {item.origin_name && (
            <p className="line-clamp-1 text-xs text-slate-400">
              {item.origin_name}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
            {item.year && <span>{item.year}</span>}
            {item.lang && <span>• {item.lang}</span>}
            {item.watchedAt && <span>• {formatWatchedTime(item.watchedAt)}</span>}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={onDelete}
        className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/75 px-2.5 py-1 text-[11px] font-black text-white opacity-100 backdrop-blur hover:bg-red-600 md:opacity-0 md:group-hover:opacity-100"
        aria-label={`Xóa ${item.name} khỏi xem tiếp`}
      >
        Xóa
      </button>
    </article>
  );
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

  const firstItem = history[0];
  const compactItems = history.slice(1, 9);

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Xem tiếp</h2>

          <p className="mt-1 text-sm text-slate-400">
            Mở nhanh những phim fen đang xem dở.
          </p>
        </div>

        <Link
          href="/lich-su"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10"
        >
          Xem lịch sử
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,1.25fr)_2fr]">
        <Link
          href={getHistoryHref(firstItem)}
          className="group relative overflow-hidden rounded-3xl border border-yellow-300/20 bg-yellow-300/10 p-3 transition hover:-translate-y-1 hover:border-yellow-300/60 hover:bg-yellow-300/15"
        >
          <div className="grid gap-4 sm:grid-cols-[120px_1fr] lg:grid-cols-1 xl:grid-cols-[140px_1fr]">
            <div className="overflow-hidden rounded-2xl bg-white/5">
              <img
                src={getImageUrl(firstItem.poster_url || firstItem.thumb_url)}
                alt={firstItem.name}
                className="aspect-[2/3] w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
            </div>

            <div className="flex min-w-0 flex-col justify-center p-1">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
                Đang xem gần nhất
              </p>

              <h3 className="mt-3 line-clamp-2 text-xl font-black text-white">
                {firstItem.name}
              </h3>

              {firstItem.origin_name && (
                <p className="mt-1 line-clamp-1 text-sm text-slate-400">
                  {firstItem.origin_name}
                </p>
              )}

              <p className="mt-3 text-sm font-black text-red-300">
                Xem tiếp: {firstItem.episodeName || "Tập đang xem"}
              </p>

              <p className="mt-1 text-sm font-bold text-yellow-300">
                Nguồn: {getSourceLabel(firstItem)}
              </p>

              <div className="mt-4">
                <span className="inline-flex rounded-2xl bg-yellow-300 px-5 py-3 text-sm font-black text-black">
                  ▶ Vào xem tiếp
                </span>
              </div>
            </div>
          </div>
        </Link>

        {compactItems.length > 0 && (
          <div
            data-tv-row
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
          >
            {compactItems.map((item) => (
              <ContinueCard
                key={`${item.isCustom ? "custom" : "normal"}-${item.slug}`}
                item={item}
                onDelete={() => deleteItem(item)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}