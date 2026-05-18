"use client";

import { useEffect } from "react";

const SEARCH_HISTORY_KEY = "baoflix_search_history";

export default function SearchHistoryRecorder({ keyword }: { keyword: string }) {
  useEffect(() => {
    const q = keyword.trim();

    if (!q) return;

    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];

      const next = [
        q,
        ...list.filter((item) => item.toLowerCase() !== q.toLowerCase()),
      ].slice(0, 12);

      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, [keyword]);

  return null;
}