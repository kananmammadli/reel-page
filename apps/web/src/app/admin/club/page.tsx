import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminClubPage() {
  const supabase = await createClient();
  const { data: months, error } = await supabase.from("club_months").select("*, title:titles(title)").order("month", { ascending: false });
  if (error) throw error;

  return (
    <div className={styles.main}>
      <div className={styles.actions}>
        <h1 style={{ flex: 1 }}>Club</h1>
        <Link className={styles.button} href="/admin/club/new">
          Schedule a month
        </Link>
      </div>
      <div className={styles.list}>
        {months.length === 0 && <p className={styles.hint}>No club months scheduled yet.</p>}
        {months.map((month) => (
          <Link key={month.id} href={`/admin/club/${month.id}`} className={styles.row}>
            <div className={styles.rowMain}>
              <div>{month.month}</div>
              <div className={styles.rowMeta}>{(month.title as unknown as { title: string } | null)?.title ?? "Untitled"}</div>
            </div>
            <span className={styles.badge}>{month.price_ref ? "Priced" : "No price set"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
