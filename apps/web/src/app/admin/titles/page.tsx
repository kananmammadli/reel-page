import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminTitlesPage() {
  const supabase = await createClient();
  const { data: titles, error } = await supabase.from("titles").select("*").order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <div className={styles.main}>
      <div className={styles.actions}>
        <h1 style={{ flex: 1 }}>Titles</h1>
        <Link className={styles.button} href="/admin/titles/new">
          New title
        </Link>
      </div>

      <div className={styles.list}>
        {titles.length === 0 && <p className={styles.hint}>No titles yet.</p>}
        {titles.map((title) => (
          <Link key={title.id} href={`/admin/titles/${title.id}`} className={styles.row}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded art, size varies */}
            {title.poster_url && <img src={title.poster_url} alt="" className={styles.rowThumb} />}
            <div className={styles.rowMain}>
              <div>{title.title}</div>
              <div className={styles.rowMeta}>
                {title.creator} {title.year ? `· ${title.year}` : ""} · {title.type}
              </div>
            </div>
            <span className={`${styles.badge} ${title.published_at ? styles.badgeLive : ""}`}>{title.published_at ? "Published" : "Draft"}</span>
            <span className={styles.badge}>{title.is_free ? "Free" : "Paid"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
