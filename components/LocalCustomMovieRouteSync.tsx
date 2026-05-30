"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCustomMovieBySlugClient } from "@/lib/customMoviesClient";

type LocalCustomMovieRouteSyncProps = {
  slug: string;
  mode: "detail" | "watch";
  serverIndex?: number;
  episodeIndex?: number;
};

export default function LocalCustomMovieRouteSync({
  slug,
  mode,
  serverIndex = 0,
  episodeIndex = 0,
}: LocalCustomMovieRouteSyncProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const localMovie = getCustomMovieBySlugClient(slug);

    if (!localMovie) return;

    const target =
      mode === "watch"
        ? `/ca-nhan/${slug}/xem?season=${serverIndex}&tap=${episodeIndex}`
        : `/ca-nhan/${slug}`;

    if (pathname === target || pathname.startsWith(`/ca-nhan/${slug}`)) {
      return;
    }

    router.replace(target);
  }, [episodeIndex, mode, pathname, router, serverIndex, slug]);

  return null;
}
