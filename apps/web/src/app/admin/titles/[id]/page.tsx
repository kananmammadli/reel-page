import Link from "next/link";
import { notFound } from "next/navigation";
import { getEpisodes } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import { TitleForm } from "@/components/admin/TitleForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteTitle } from "../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function EditTitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: title, error: titleError }, { data: collections, error: collectionsError }, { data: memberships, error: membershipsError }, episodes] =
    await Promise.all([
      supabase.from("titles").select("*").eq("id", id).maybeSingle(),
      supabase.from("collections").select("*").order("name"),
      supabase.from("collection_titles").select("collection_id").eq("title_id", id),
      getEpisodes(supabase, id),
    ]);
  if (titleError) throw titleError;
  if (collectionsError) throw collectionsError;
  if (membershipsError) throw membershipsError;
  if (!title) notFound();

  return (
    <div className={styles.main}>
      <h1>{title.title}</h1>
      <TitleForm title={title} collections={collections} selectedCollectionIds={memberships.map((m) => m.collection_id)} />

      <section>
        <div className={styles.actions}>
          <h2 style={{ flex: 1 }}>Episodes</h2>
          <Link className={styles.button} href={`/admin/titles/${id}/episodes/new`}>
            Add episode
          </Link>
        </div>
        <div className={styles.list}>
          {episodes.length === 0 && <p className={styles.hint}>No episodes yet.</p>}
          {episodes.map((episode) => (
            <Link key={episode.id} href={`/admin/titles/${id}/episodes/${episode.id}`} className={styles.row}>
              <div className={styles.rowMain}>
                <div>
                  {episode.position}. {episode.name}
                </div>
                <div className={styles.rowMeta}>
                  {episode.duration_s ? `${Math.round(episode.duration_s / 60)} min` : "duration unknown"} ·{" "}
                  {episode.transcript.length > 0 ? `${episode.transcript.length} transcript lines` : "no transcript"}
                </div>
              </div>
              <span className={`${styles.badge} ${episode.preview_path ? styles.badgeLive : ""}`}>
                {episode.preview_path ? "Preview ready" : "No preview"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <DeleteButton action={deleteTitle.bind(null, title.id)} confirmText={`Delete "${title.title}" and all its episodes?`} label="Delete title" />
    </div>
  );
}
