import { createClient } from "@/lib/supabase/server";
import { TitleForm } from "@/components/admin/TitleForm";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function NewTitlePage() {
  const supabase = await createClient();
  const { data: collections, error } = await supabase.from("collections").select("*").order("name");
  if (error) throw error;

  return (
    <div className={styles.main}>
      <h1>New title</h1>
      <TitleForm collections={collections} />
    </div>
  );
}
