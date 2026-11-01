import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CollectionForm } from "@/components/admin/CollectionForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteCollection } from "../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: collection, error: collectionError }, { data: titles, error: titlesError }, { data: memberships, error: membershipsError }] =
    await Promise.all([
      supabase.from("collections").select("*").eq("id", id).maybeSingle(),
      supabase.from("titles").select("*").order("title"),
      supabase.from("collection_titles").select("title_id").eq("collection_id", id),
    ]);
  if (collectionError) throw collectionError;
  if (titlesError) throw titlesError;
  if (membershipsError) throw membershipsError;
  if (!collection) notFound();

  return (
    <div className={styles.main}>
      <h1>{collection.name}</h1>
      <CollectionForm collection={collection} titles={titles} selectedTitleIds={memberships.map((m) => m.title_id)} />
      <DeleteButton action={deleteCollection.bind(null, collection.id)} confirmText={`Delete "${collection.name}"?`} label="Delete collection" />
    </div>
  );
}
