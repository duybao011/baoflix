"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getImageUrl } from "@/lib/kkphim";

const HISTORY_KEY = "baoflix_history";

type HistoryItem = {
  slug: string;
  name: string;
  origin_name?: string;
  poster_url?: string;
  thumb_url?: string;
  episodeName: string;
  episodeIndex: number;
  serverIndex?: number;
  serverName?: string;
  watchedAt: string;
};

export default function ContinueWatching() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const list: HistoryItem[] = raw ? JSON.parse(raw) : [];
      setItems(list.slice(0, 12));
    } catch {
      setItems([]);
    }
  }, []);

  if (!items.length) return null;

  return (
    <section className="py-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Tiếp tục xem</h2>
          <p className="mt-1 text-sm text-slate-400">
            Quay lại đúng tập và đúng server fen xem gần nhất.
          </p>
        </div>

        <Link
          href="/lich-su"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
        >
          Xem lịch sử
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={`${item.slug}-${item.serverIndex ?? 0}-${item.episodeIndex}`}
            href={`/xem/${item.slug}?server=${item.serverIndex ?? 0}&tap=${item.episodeIndex}`}
            className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"
          >
            <img
              src={getImageUrl(item.poster_url || item.thumb_url)}
              alt={item.name}
              className="h-28 w-20 rounded-2xl object-cover"
            />

            <div className="flex min-w-0 flex-col justify-center">
              <h3 className="line-clamp-2 font-bold">{item.name}</h3>

              <p className="mt-1 line-clamp-1 text-sm text-slate-400">
                {item.origin_name}
              </p>

              <p className="mt-2 text-sm text-red-300">
                Xem tiếp: {item.episodeName}
              </p>

              {item.serverName && (
                <p className="mt-1 text-xs text-yellow-300">
                  {item.serverName}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}