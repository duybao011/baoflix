"use client";

import { useState } from "react";

type TabKey = "info" | "episodes" | "cast" | "related";

type Props = {
  info: React.ReactNode;
  episodes: React.ReactNode;
  cast: React.ReactNode;
  related: React.ReactNode;
};

const tabs: { key: TabKey; label: string }[] = [
  { key: "info", label: "Thông tin" },
  { key: "episodes", label: "Tập phim" },
  { key: "cast", label: "Diễn viên" },
  { key: "related", label: "Liên quan" },
];

export default function MovieDetailTabs({
  info,
  episodes,
  cast,
  related,
}: Props) {
  const [active, setActive] = useState<TabKey>("episodes");

  const content = {
    info,
    episodes,
    cast,
    related,
  };

  return (
    <section className="mt-8">
      <div className="sticky top-[138px] z-30 -mx-1 mb-5 flex gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-[#070a12]/90 p-2 backdrop-blur">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={[
              "whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-bold transition",
              active === tab.key
                ? "bg-red-600 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>{content[active]}</div>
    </section>
  );
}