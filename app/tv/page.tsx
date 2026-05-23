import TvDashboard from "@/components/TvDashboard";
import { getFilteredMovies } from "@/lib/kkphim";

export default async function TvPage() {
  const chineseSeriesResult = await getFilteredMovies({
    type: "phim-bo",
    country: "trung-quoc",
    page: 1,
    limit: 12,
  });

  return <TvDashboard chineseSeries={chineseSeriesResult.items} />;
}