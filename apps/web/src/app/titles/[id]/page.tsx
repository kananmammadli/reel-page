import { notFound } from "next/navigation";
import { getEpisodes, getTitle } from "@reel-and-page/shared";
import { supabase } from "@/lib/supabase";
import { TitleEpisodeList } from "@/components/catalog/TitleEpisodeList";

export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const title = await getTitle(supabase, id);
  if (!title) notFound();

  const episodes = await getEpisodes(supabase, id);

  return <TitleEpisodeList title={title} episodes={episodes} />;
}
