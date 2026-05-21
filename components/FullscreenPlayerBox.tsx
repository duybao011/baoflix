"use client";

import { ReactNode, useEffect, useState } from "react";

export default function FullscreenPlayerBox({
  children,
}: {
  children: ReactNode;
}) {
  const [cinemaMode, setCinemaMode] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCinemaMode(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      className={[
        "relative overflow-hidden border border-white/10 bg-black transition-all duration-300",
        cinemaMode
          ? "rounded-2xl"
          : "rounded-3xl",
      ].join(" ")}
    >
      <div
        className={[
          "bg-black transition-all duration-300",
          cinemaMode
            ? "h-[78vh] w-full"
            : "aspect-video w-full",
        ].join(" ")}
      >
        {children}
      </div>

      <div className="absolute right-4 top-4 z-50 flex gap-2">
        {!cinemaMode ? (
          <button
            type="button"
            onClick={() => setCinemaMode(true)}
            className="rounded-xl bg-black/75 px-4 py-2 text-sm font-black text-white backdrop-blur hover:bg-red-600"
          >
            Rạp phim
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCinemaMode(false)}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white backdrop-blur hover:bg-red-500"
          >
            Thu nhỏ
          </button>
        )}
      </div>
    </div>
  );
}