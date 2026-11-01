import Link from "next/link";
import { getContinueListening, getCurrentClubMonth, getHomeRails, hasClubMonthEntitlement } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import { PosterCard } from "@/components/catalog/PosterCard";
import styles from "./page.module.css";

// Supabase-js's internal fetch doesn't opt out of Next's build-time static
// generation on its own, and this catalog must reflect live DB state (it
// changes outside of app deploys), so force per-request rendering.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const [{ freeToStart, recentlyAdded, collections }, continueListening, clubMonth] = await Promise.all([
    getHomeRails(supabase),
    userData.user ? getContinueListening(supabase, 10) : Promise.resolve([]),
    getCurrentClubMonth(supabase),
  ]);
  const clubEntitled = clubMonth && userData.user ? await hasClubMonthEntitlement(supabase, userData.user.id, clubMonth.id) : false;

  return (
    <div className={styles.main}>
      {clubMonth && (
        <section>
          <Link
            href="/club"
            style={{
              display: "block",
              borderRadius: 12,
              padding: 20,
              background: "linear-gradient(160deg, #3d3a52, #15131f)",
              color: "#fff8f2",
              textDecoration: "none",
            }}
          >
            <div style={{ opacity: 0.7, fontSize: "0.85rem" }}>This month&rsquo;s club pick</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, margin: "4px 0" }}>{clubMonth.title.title}</div>
            {clubMonth.pitch && <div style={{ opacity: 0.85 }}>{clubMonth.pitch}</div>}
            <div style={{ marginTop: 10, fontWeight: 600 }}>{clubEntitled ? "Open the club →" : "Join the club →"}</div>
          </Link>
        </section>
      )}

      {continueListening.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Continue listening</h2>
          <div className={styles.rail}>
            {continueListening.map((item) => (
              <Link key={item.episode.id} href={`/titles/${item.title.id}`} className={styles.card}>
                <PosterCard
                  id={item.title.id}
                  title={item.title.title}
                  year={item.title.year}
                  type={item.title.type}
                  posterUrl={item.title.poster_url}
                />
                <div className={styles.cap}>{item.episode.name}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className={styles.sectionTitle}>Free to start</h2>
        {freeToStart.length === 0 ? (
          <p className={styles.empty}>Nothing free yet.</p>
        ) : (
          <div className={styles.rail}>
            {freeToStart.map((title) => (
              <Link key={title.id} href={`/titles/${title.id}`} className={styles.card}>
                <PosterCard id={title.id} title={title.title} year={title.year} type={title.type} posterUrl={title.poster_url} />
                <div className={styles.cap}>{title.creator}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Collections</h2>
        {collections.length === 0 ? (
          <p className={styles.empty}>No collections yet.</p>
        ) : (
          <div className={styles.rail}>
            {collections.map((collection) => (
              <Link
                key={collection.id}
                href={`/collections/${collection.id}`}
                className={styles.card}
              >
                <div
                  className={styles.poster}
                  style={{ background: "linear-gradient(160deg, #3d3a52, #15131f)" }}
                >
                  <span className={styles.posterLabel}>{collection.titles.length} episodes</span>
                  <span className={styles.posterTitle}>{collection.name}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Recently added</h2>
        {recentlyAdded.length === 0 ? (
          <p className={styles.empty}>Nothing here yet.</p>
        ) : (
          <div className={styles.rail}>
            {recentlyAdded.map((title) => (
              <Link key={title.id} href={`/titles/${title.id}`} className={styles.card}>
                <PosterCard id={title.id} title={title.title} year={title.year} type={title.type} posterUrl={title.poster_url} />
                <div className={styles.cap}>{title.creator}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
