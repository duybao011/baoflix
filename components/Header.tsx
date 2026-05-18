import Link from "next/link";
import SearchBox from "@/components/SearchBox";

const navItems = [
  { label: "Chủ đề", href: "/chu-de" },
  { label: "Thể loại", href: "/the-loai" },
  { label: "Quốc gia", href: "/quoc-gia" },
  { label: "Diễn viên", href: "/dien-vien" },
  { label: "Bộ lọc", href: "/loc" },
  { label: "Phim lẻ", href: "/danh-sach/phim-le" },
  { label: "Phim bộ", href: "/danh-sach/phim-bo" },
  { label: "TV Shows", href: "/danh-sach/tv-shows" },
  { label: "Hoạt hình", href: "/danh-sach/hoat-hinh" },
  { label: "Vietsub", href: "/danh-sach/phim-vietsub" },
  { label: "Thuyết minh", href: "/danh-sach/phim-thuyet-minh" },
  { label: "Lồng tiếng", href: "/danh-sach/phim-long-tieng" },
  { label: "Yêu thích", href: "/yeu-thich" },
  { label: "Lịch sử", href: "/lich-su" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070a12]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="text-2xl font-black tracking-tight">
            <span className="text-red-500">Bảo</span>Flix
          </Link>

          <SearchBox />
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}