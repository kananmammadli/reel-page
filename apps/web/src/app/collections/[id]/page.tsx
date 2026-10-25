import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollection } from "@reel-and-page/shared";
import { supabase } from "@/lib/supabase";
import { PosterCard } from "@/components/catalog/PosterCard";
import styles from "@/app/page.module.css";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collection = await getCollection(supabase, id);
  if (!collection) notFound();

  return (
    <div className={styles.main}>
      <h1>{collection.name}</h1>
      <p className={styles.empty}>{collection.titles.length} commentaries, yours to keep.</p>
      <div className={styles.rail}>
        {collection.titles.map((title) => (
          <Link key={title.id} href={`/titles/${title.id}`} className={styles.card}>
            <PosterCard
              id={title.id}
              title={title.title}
              year={title.year}
              type={title.type}
              posterUrl={title.poster_url}
            />
            <div className={styles.cap}>{title.creator}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
