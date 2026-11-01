import { redirect } from "next/navigation";
import Link from "next/link";
import { getContinueListening, getOwnedClubMonths, getOwnedCollections, getOwnedTitles } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import { PosterCard } from "@/components/catalog/PosterCard";
import { SignOutButton } from "@/components/auth/SignOutButton";
import styles from "@/app/page.module.css";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/auth/sign-in");

  const [continueListening, ownedTitles, ownedCollections, ownedClubMonths] = await Promise.all([
    getContinueListening(supabase, 50),
    getOwnedTitles(supabase, userData.user.id),
    getOwnedCollections(supabase, userData.user.id),
    getOwnedClubMonths(supabase, userData.user.id),
  ]);

  return (
    <div className={styles.main}>
      <h1>Profile</h1>
      <p className={styles.empty}>Signed in as {userData.user.email}</p>
      <SignOutButton />

      <section>
        <h2 className={styles.sectionTitle}>Owned commentaries</h2>
        {ownedTitles.length === 0 && ownedCollections.length === 0 ? (
          <p className={styles.empty}>Nothing purchased yet.</p>
        ) : (
          <div className={styles.rail}>
            {ownedCollections.map((collection) => (
              <Link key={collection.id} href={`/collections/${collection.id}`} className={styles.card}>
                <div className={styles.poster} style={{ background: "linear-gradient(160deg, #3d3a52, #15131f)" }}>
                  <span className={styles.posterTitle}>{collection.name}</span>
                </div>
              </Link>
            ))}
            {ownedTitles.map((title) => (
              <Link key={title.id} href={`/titles/${title.id}`} className={styles.card}>
                <PosterCard id={title.id} title={title.title} year={title.year} type={title.type} posterUrl={title.poster_url} />
                <div className={styles.cap}>{title.creator}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {ownedClubMonths.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Club months</h2>
          <div className={styles.rail}>
            {ownedClubMonths.map((month) => (
              <Link key={month.id} href={`/club/${month.id}`} className={styles.card}>
                <div className={styles.poster} style={{ background: "linear-gradient(160deg, #3d3a52, #15131f)" }}>
                  <span className={styles.posterLabel}>{month.month}</span>
                  <span className={styles.posterTitle}>{month.title.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className={styles.sectionTitle}>Continue listening</h2>
        {continueListening.length === 0 ? (
          <p className={styles.empty}>Nothing yet -- start an episode and it&rsquo;ll show up here.</p>
        ) : (
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
        )}
      </section>
    </div>
  );
}
