import { notFound } from "next/navigation";
import { getEpisodes, getTitle } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import { EpisodeForm } from "@/components/admin/EpisodeForm";
import styles from "../../../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function NewEpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [title, episodes] = await Promise.all([getTitle(supabase, id), getEpisodes(supabase, id)]);
  if (!title) notFound();

  return (
    <div className={styles.main}>
      <h1>New episode — {title.title}</h1>
      <EpisodeForm titleId={id} nextPosition={episodes.length + 1} />
    </div>
  );
}
