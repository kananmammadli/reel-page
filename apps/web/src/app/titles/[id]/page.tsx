import { notFound } from "next/navigation";
import { getEpisodes, getPlaybackPositionsForTitle, getTitle } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import { TitleEpisodeList } from "@/components/catalog/TitleEpisodeList";

export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const title = await getTitle(supabase, id);
  if (!title) notFound();

  const episodes = await getEpisodes(supabase, id);
  const { data: userData } = await supabase.auth.getUser();
  const savedPositions = userData.user
    ? await getPlaybackPositionsForTitle(
        supabase,
        episodes.map((e) => e.id),
      )
    : {};

  return <TitleEpisodeList title={title} episodes={episodes} savedPositions={savedPositions} />;
}
