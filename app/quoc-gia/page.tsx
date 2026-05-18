import Link from "next/link";
import { getCountries } from "@/lib/kkphim";

export default async function CountriesPage() {
  const countries = await getCountries();

  return (
    <div>
      <h1 className="mb-2 text-3xl font-black">Quốc gia</h1>

      <p className="mb-6 text-slate-400">
        Chọn quốc gia để xem danh sách phim tương ứng.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {countries.map((item) => (
          <Link
            key={item.slug}
            href={`/quoc-gia/${item.slug}`}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm hover:bg-white/10"
          >
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}