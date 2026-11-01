import { createClient } from "@/lib/supabase/server";
import { ClubMonthForm } from "@/components/admin/ClubMonthForm";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function NewClubMonthPage() {
  const supabase = await createClient();
  const { data: titles, error } = await supabase.from("titles").select("*").order("title");
  if (error) throw error;

  return (
    <div className={styles.main}>
      <h1>Schedule a club month</h1>
      <ClubMonthForm titles={titles} />
    </div>
  );
}
