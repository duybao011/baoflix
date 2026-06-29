import { connection } from "next/server";
import TvDashboard from "@/components/TvDashboard";
import TvModeSession from "@/components/TvModeSession";
import { getFilteredMovies } from "@/lib/kkphim";

export default async function TvPage() {
  await connection();
  const chineseSeriesResult = await getFilteredMovies({
    type: "phim-bo",
    country: "trung-quoc",
    page: 1,
    limit: 10,
  });

  return (
    <>
      <TvModeSession />
      <TvDashboard chineseSeries={chineseSeriesResult.items} />
    </>
  );
}
