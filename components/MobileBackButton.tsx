"use client";

import { usePathname, useRouter } from "next/navigation";

function shouldHideBackButton(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/xem") ||
    /^\/ca-nhan\/[^/]+\/xem/.test(pathname)
  );
}

export default function MobileBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (shouldHideBackButton(pathname)) {
    return null;
  }

  function goBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="fixed bottom-24 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/80 text-xl text-white shadow-2xl backdrop-blur md:hidden"
      aria-label="Quay lại"
    >
      ←
    </button>
  );
}
