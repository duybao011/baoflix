import EditCustomMovieForm from "@/components/EditCustomMovieForm";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default function EditCustomMoviePage({ params }: PageProps) {
  return <EditCustomMovieForm params={params} />;
}
