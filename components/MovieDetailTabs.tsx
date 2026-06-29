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

const TV_FOCUS_CLASS =
  "focus-visible:scale-[1.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const tabs: {
  key: TabKey;
  label: string;
}[] = [
  { key: "episodes", label: "Tập phim" },
  { key: "cast", label: "Diễn viên" },
  { key: "related", label: "Liên quan" },
  { key: "info", label: "Thông tin" },
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
    <section
      data-tv-tabs-root
      data-tv-scope="movie-detail-tabs"
      className="mt-5"
    >
      <div
        data-tv-tab-list
        data-tv-row
        data-tv-row-loop="true"
        className="mb-4 inline-flex max-w-full gap-1.5 rounded-2xl border border-white/10 bg-black/25 p-1.5"
        role="tablist"
        aria-label="Thông tin phim"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`baoflix-tv-tab-panel-${tab.key}`}
              data-tv-tab-button={tab.key}
              data-tv-tab-active={active ? "true" : undefined}
              data-tv-focus-key={`detail-tab:${tab.key}`}
              data-tv-default={active ? "true" : undefined}
              onClick={() => setActiveTab(tab.key)}
              className={[
                "rounded-xl px-4 py-2 text-xs font-black transition min-[1280px]:text-sm",
                active
                  ? "bg-yellow-300 text-black"
                  : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white",
                TV_FOCUS_CLASS,
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`baoflix-tv-tab-panel-${activeTab}`}
        role="tabpanel"
        data-tv-tab-panel
        data-tv-tab-panel-active="true"
        data-tv-scope="movie-detail-tab-panel"
      >
        {content[activeTab]}
      </div>
    </section>
  );
}
