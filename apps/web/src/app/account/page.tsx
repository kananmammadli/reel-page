import { redirect } from "next/navigation";
import Link from "next/link";
import { getContinueListening } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import { PosterCard } from "@/components/catalog/PosterCard";
import { SignOutButton } from "@/components/auth/SignOutButton";
import styles from "@/app/page.module.css";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/auth/sign-in");

  const library = await getContinueListening(supabase, 50);

  return (
    <div className={styles.main}>
      <h1>Profile</h1>
      <p className={styles.empty}>Signed in as {userData.user.email}</p>
      <SignOutButton />

      <section>
        <h2 className={styles.sectionTitle}>Library</h2>
        <p className={styles.empty}>
          Things you&rsquo;ve started. Owned commentaries and club membership arrive in milestone 4.
        </p>
        {library.length === 0 ? (
          <p className={styles.empty}>Nothing yet -- start an episode and it&rsquo;ll show up here.</p>
        ) : (
          <div className={styles.rail}>
            {library.map((item) => (
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
