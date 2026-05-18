"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Trang chủ", href: "/", icon: "⌂" },
  { label: "Tìm", href: "/tim-kiem", icon: "⌕" },
  { label: "Lọc", href: "/loc", icon: "▦" },
  { label: "Yêu thích", href: "/yeu-thich", icon: "♡" },
  { label: "Lịch sử", href: "/lich-su", icon: "↺" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#070a12]/95 px-2 py-2 backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
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
                "flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-xs",
                active
                  ? "bg-red-600 text-white"
                  : "text-slate-300 hover:bg-white/10",
              ].join(" ")}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="mt-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}