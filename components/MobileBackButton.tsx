"use client";

import { useRouter } from "next/navigation";

export default function MobileBackButton() {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <button
      onClick={goBack}
      className="fixed bottom-24 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/80 text-xl text-white shadow-2xl backdrop-blur md:hidden"
      aria-label="Quay lại"
    >
      ←
    </button>
  );
}