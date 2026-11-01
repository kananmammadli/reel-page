import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  const supabase = await createClient();
  const { data: collections, error } = await supabase.from("collections").select("*").order("name");
  if (error) throw error;

  return (
    <div className={styles.main}>
      <div className={styles.actions}>
        <h1 style={{ flex: 1 }}>Collections</h1>
        <Link className={styles.button} href="/admin/collections/new">
          New collection
        </Link>
      </div>
      <div className={styles.list}>
        {collections.length === 0 && <p className={styles.hint}>No collections yet.</p>}
        {collections.map((collection) => (
          <Link key={collection.id} href={`/admin/collections/${collection.id}`} className={styles.row}>
            <div className={styles.rowMain}>{collection.name}</div>
            <span className={styles.badge}>{collection.price_ref ? "Priced" : "No price set"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
