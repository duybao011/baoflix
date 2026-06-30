"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getImageUrl } from "@/lib/kkphim";

type BadgeTone = "red" | "yellow" | "dark";

type CompactMovieCardProps = {
  href: string;
  title: string;
  originName?: string;
  image?: string;
  topBadge?: string;
  topBadgeTone?: BadgeTone;
  rightBadge?: string;
  bottomPrimary?: string;
  bottomSecondary?: string;
  meta?: Array<string | number | false | null | undefined>;
  onRemove?: () => void;
  removeLabel?: string;
  removeAriaLabel?: string;
  confirmRemove?: boolean;
  hideRemoveUntilHover?: boolean;
};

const TV_CARD_FOCUS_CLASS =
  "focus-visible:scale-[1.035] focus-visible:border-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

function getBadgeClass(tone: BadgeTone) {
  if (tone === "yellow") return "bg-yellow-300 text-black";
  if (tone === "dark") return "bg-black/75 text-white";
  return "bg-red-600 text-white";
}

export default function CompactMovieCard({
  href,
  title,
  originName,
  image,
  topBadge,
  topBadgeTone = "red",
  rightBadge,
  bottomPrimary,
  bottomSecondary,
  meta = [],
  onRemove,
  removeLabel = "Xóa",
  removeAriaLabel,
  confirmRemove = false,
  hideRemoveUntilHover = false,
}: CompactMovieCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  function handleRemoveClick() {
    if (!onRemove) return;

    if (confirmRemove && !confirmingDelete) {
      setConfirmingDelete(true);

      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }

      resetTimerRef.current = window.setTimeout(() => {
        setConfirmingDelete(false);
        resetTimerRef.current = null;
      }, 2200);

      return;
    }

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    onRemove();
  }

  const visibleMeta = meta.filter(Boolean);

  return (
    <article
      data-tv-card="compact-movie"
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] transition hover:-translate-y-1 hover:bg-white/[0.075]"
    >
      <Link
        href={href}
        prefetch={false}
        data-tv-focus-key={`compact-card:${href}`}
        className={["block rounded-2xl", TV_CARD_FOCUS_CLASS].join(" ")}
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-slate-900">
          <img
            src={getImageUrl(image)}
            alt={title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105 group-focus-within:scale-105"
            loading="lazy"
            decoding="async"
          />

          {(bottomPrimary || bottomSecondary) && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent p-2 pt-14">
              {bottomPrimary && (
                <p className="line-clamp-1 text-[11px] font-black text-red-300">
                  {bottomPrimary}
                </p>
              )}

              {bottomSecondary && (
                <p className="mt-0.5 line-clamp-1 text-[10px] font-bold text-yellow-300">
                  {bottomSecondary}
                </p>
              )}
            </div>
          )}

          {topBadge && (
            <span
              className={[
                "absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-black",
                getBadgeClass(topBadgeTone),
              ].join(" ")}
            >
              {topBadge}
            </span>
          )}

          {rightBadge && (
            <span className="absolute right-2 top-2 rounded-full bg-yellow-300 px-2 py-1 text-[10px] font-black text-black">
              {rightBadge}
            </span>
          )}
        </div>

        <div className="space-y-1 p-3">
          <h2 className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-5 text-white">
            {title}
          </h2>

          {originName && (
            <p className="line-clamp-1 text-xs text-slate-400">{originName}</p>
          )}

          {visibleMeta.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
              {visibleMeta.map((item, index) => (
                <span key={`${item}-${index}`}>
                  {index > 0 ? "• " : ""}
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>

      {onRemove && (
        <button
          type="button"
          onClick={handleRemoveClick}
          data-tv-skip
          tabIndex={-1}
          className={[
            "absolute right-2 top-2 rounded-full border px-2.5 py-1 text-[11px] font-black text-white backdrop-blur",
            confirmingDelete
              ? "border-red-400 bg-red-600"
              : "border-white/10 bg-black/75 hover:bg-red-600",
            hideRemoveUntilHover && !confirmingDelete
              ? "opacity-100 md:opacity-0 md:group-hover:opacity-100"
              : "opacity-90",
          ].join(" ")}
          aria-label={removeAriaLabel || removeLabel}
        >
          {confirmingDelete ? "Chắc chắn?" : removeLabel}
        </button>
      )}
    </article>
  );
}
