import { redirect } from "next/navigation";
import { computeJournalStats, getListeningDays, getQuotes } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import { QuotesFeed } from "@/components/quotes/QuotesFeed";
import styles from "./quotes.module.css";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/auth/sign-in");

  const [quotes, listeningDays] = await Promise.all([getQuotes(supabase, userData.user.id), getListeningDays(supabase, userData.user.id)]);
  const stats = computeJournalStats(quotes.length, listeningDays);

  return (
    <div className={styles.main}>
      <h1>Quotes</h1>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.quotesSaved}</div>
          <div className={styles.statLabel}>Quotes saved</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.streakDays}</div>
          <div className={styles.statLabel}>Day streak</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.totalMinutes}</div>
          <div className={styles.statLabel}>Minutes listened</div>
        </div>
      </div>

      <QuotesFeed quotes={quotes} />
    </div>
  );
}
