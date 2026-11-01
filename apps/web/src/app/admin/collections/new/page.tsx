import { createClient } from "@/lib/supabase/server";
import { CollectionForm } from "@/components/admin/CollectionForm";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage() {
  const supabase = await createClient();
  const { data: titles, error } = await supabase.from("titles").select("*").order("title");
  if (error) throw error;

  return (
    <div className={styles.main}>
      <h1>New collection</h1>
      <CollectionForm titles={titles} />
    </div>
  );
}
