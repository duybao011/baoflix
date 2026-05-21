import ExportCustomMovieCode from "@/components/ExportCustomMovieCode";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ExportCustomMovieCodePage({ params }: PageProps) {
  const { slug } = await params;

  return <ExportCustomMovieCode slug={slug} />;
}