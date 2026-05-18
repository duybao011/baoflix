import Link from "next/link";

const topics = [
  {
    title: "Phim Vietsub",
    description: "Danh sách phim có phụ đề tiếng Việt.",
    href: "/danh-sach/phim-vietsub",
  },
  {
    title: "Phim thuyết minh",
    description: "Danh sách phim có thuyết minh.",
    href: "/danh-sach/phim-thuyet-minh",
  },
  {
    title: "Phim lồng tiếng",
    description: "Danh sách phim có lồng tiếng.",
    href: "/danh-sach/phim-long-tieng",
  },
  {
    title: "Bộ lọc nâng cao",
    description: "Lọc theo quốc gia, thể loại, năm, ngôn ngữ.",
    href: "/loc",
  },
];

export default function TopicPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-black">Chủ đề</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {topics.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/10"
          >
            <h2 className="text-xl font-black">{item.title}</h2>
            <p className="mt-2 text-slate-400">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}