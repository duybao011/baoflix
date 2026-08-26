"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isMobileDevice } from "@/lib/tvMode";

export default function TvModeFloatingButton() {
  const pathname = usePathname();
  const [showOnDevice, setShowOnDevice] = useState(false);

  useEffect(() => {
    setShowOnDevice(!isMobileDevice());
  }, []);

  const hiddenPaths = ["/tv", "/xem", "/ca-nhan"];
  const shouldHide = hiddenPaths.some((path) => pathname.startsWith(path));

  if (shouldHide || !showOnDevice) return null;

  return (
    <Link
      href="/tv"
      className="fixed bottom-24 right-4 z-40 rounded-full border border-yellow-300/30 bg-yellow-300 px-4 py-3 text-sm font-black text-black shadow-2xl shadow-black/40 hover:bg-yellow-200 lg:hidden"
    >
      TV
    </Link>
  );
}
