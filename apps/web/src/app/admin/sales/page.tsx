import { getPayments, summarizePayments } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

function formatAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amountCents / 100);
}

export default async function SalesPage() {
  const supabase = await createClient();
  const [payments, titlesResult, collectionsResult, subscriptionsResult] = await Promise.all([
    getPayments(supabase),
    supabase.from("titles").select("id, title"),
    supabase.from("collections").select("id, name"),
    supabase.from("subscriptions").select("status"),
  ]);
  if (titlesResult.error) throw titlesResult.error;
  if (collectionsResult.error) throw collectionsResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;

  const summary = summarizePayments(payments, titlesResult.data, collectionsResult.data);
  const activeMembers = subscriptionsResult.data.filter((s) => s.status === "active").length;

  return (
    <div className={styles.main}>
      <h1>Sales</h1>

      <div className={styles.statGrid}>
        {summary.totals.length === 0 && (
          <div className={styles.stat}>
            <div className={styles.statValue}>0</div>
            <div className={styles.statLabel}>No confirmed payments yet</div>
          </div>
        )}
        {summary.totals.map((total) => (
          <div key={total.currency} className={styles.stat}>
            <div className={styles.statValue}>{formatAmount(total.amountCents, total.currency)}</div>
            <div className={styles.statLabel}>
              {total.count} {total.count === 1 ? "payment" : "payments"} ({total.currency.toUpperCase()})
            </div>
          </div>
        ))}
        <div className={styles.stat}>
          <div className={styles.statValue}>{activeMembers}</div>
          <div className={styles.statLabel}>Active club members</div>
        </div>
      </div>

      <section>
        <h2 className={styles.hint}>Revenue by title</h2>
        {summary.byTitle.length === 0 ? (
          <p className={styles.hint}>No title purchases yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Unlocks</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {summary.byTitle.map((row) => (
                <tr key={`${row.currency}-${row.id}`}>
                  <td>{row.label}</td>
                  <td>{row.count}</td>
                  <td>{formatAmount(row.amountCents, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className={styles.hint}>Revenue by collection</h2>
        {summary.byCollection.length === 0 ? (
          <p className={styles.hint}>No collection purchases yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Collection</th>
                <th>Unlocks</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {summary.byCollection.map((row) => (
                <tr key={`${row.currency}-${row.id}`}>
                  <td>{row.label}</td>
                  <td>{row.count}</td>
                  <td>{formatAmount(row.amountCents, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className={styles.hint}>Club revenue</h2>
        {summary.club.length === 0 ? (
          <p className={styles.hint}>No club payments yet.</p>
        ) : (
          <ul>
            {summary.club.map((row) => (
              <li key={row.currency}>
                {formatAmount(row.amountCents, row.currency)} ({row.count} {row.count === 1 ? "charge" : "charges"})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className={styles.hint}>Revenue by month</h2>
        {summary.byMonth.length === 0 ? (
          <p className={styles.hint}>No payments yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Month</th>
                <th>Payments</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {summary.byMonth.map((row) => (
                <tr key={`${row.currency}-${row.month}`}>
                  <td>{row.month}</td>
                  <td>{row.count}</td>
                  <td>{formatAmount(row.amountCents, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
