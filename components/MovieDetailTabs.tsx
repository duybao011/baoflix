"use client";

import { ReactNode, useState } from "react";

type TabKey = "episodes" | "cast" | "related" | "info";

type Props = {
  info: ReactNode;
  episodes: ReactNode;
  cast: ReactNode;
  related: ReactNode;
  defaultTab?: TabKey;
};

const tabs: {
  key: TabKey;
  label: string;
}[] = [
  {
    key: "episodes",
    label: "Tập phim",
  },
  {
    key: "cast",
    label: "Diễn viên",
  },
  {
    key: "related",
    label: "Liên quan",
  },
  {
    key: "info",
    label: "Thông tin",
  },
];

export default function MovieDetailTabs({
  info,
  episodes,
  cast,
  related,
  defaultTab = "episodes",
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  const content = {
    episodes,
    cast,
    related,
    info,
  };

  return (
    <section className="mt-6">
      <div className="mb-5 flex flex-wrap gap-2 rounded-3xl border border-white/10 bg-black/20 p-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={[
              "rounded-2xl px-5 py-3 text-sm font-black transition",
              activeTab === tab.key
                ? "bg-red-600 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>{content[activeTab]}</div>
    </section>
  );
}