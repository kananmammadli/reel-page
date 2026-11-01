import { notFound } from "next/navigation";
import type { TranscriptEntry } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import { EpisodeForm } from "@/components/admin/EpisodeForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteEpisode } from "../actions";
import styles from "../../../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function EditEpisodePage({ params }: { params: Promise<{ id: string; episodeId: string }> }) {
  const { id, episodeId } = await params;
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("episodes").select("*").eq("id", episodeId).maybeSingle();
  if (error) throw error;
  if (!row) notFound();

  const episode = { ...row, transcript: (row.transcript as unknown as TranscriptEntry[] | null) ?? [] };

  return (
    <div className={styles.main}>
      <h1>{episode.name}</h1>
      <EpisodeForm titleId={id} episode={episode} nextPosition={episode.position} />
      <DeleteButton action={deleteEpisode.bind(null, episodeId, id)} confirmText={`Delete "${episode.name}"?`} label="Delete episode" />
    </div>
  );
}
