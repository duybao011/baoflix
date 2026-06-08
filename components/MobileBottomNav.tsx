"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Trang chủ", href: "/", icon: "⌂" },
  { label: "Tìm", href: "/tim-kiem", icon: "⌕" },
  { label: "Lọc", href: "/loc", icon: "▦" },
  { label: "Yêu thích", href: "/yeu-thich", icon: "♡" },
  { label: "Lịch sử", href: "/lich-su", icon: "↺" },
  { label: "Cài đặt", href: "/cai-dat", icon: "⚙" },
];

function shouldHideBottomNav(pathname: string) {
  return pathname.startsWith("/xem") || pathname.includes("/xem?");
}

export default function MobileBottomNav() {
  const pathname = usePathname();

  if (shouldHideBottomNav(pathname)) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#070a12]/95 px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
      <div className="grid grid-cols-6 gap-1">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex min-h-[52px] flex-col items-center justify-center rounded-2xl px-1 py-2 text-[11px]",
                active
                  ? "bg-red-600 text-white"
                  : "text-slate-300 hover:bg-white/10",
              ].join(" ")}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="mt-1 max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
