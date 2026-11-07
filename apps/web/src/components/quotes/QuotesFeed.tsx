"use client";

import type { QuoteWithContext } from "@reel-and-page/shared";
import { usePlayer } from "@/components/player/PlayerProvider";
import styles from "@/app/quotes/quotes.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function QuotesFeed({ quotes }: { quotes: QuoteWithContext[] }) {
  const { play } = usePlayer();

  if (quotes.length === 0) {
    return <p className={styles.empty}>Nothing saved yet -- tap the pen on the mini player while something&rsquo;s playing.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {quotes.map((quote) => (
        <div key={quote.id} className={styles.quote}>
          <p className={styles.quoteText}>&ldquo;{quote.text}&rdquo;</p>
          <div className={styles.quoteMeta}>
            <span>
              {quote.title.title} · {quote.episode.name} · {formatDate(quote.created_at)}
            </span>
            <button className={styles.linkButton} onClick={() => play(quote.title, quote.episode, "full", quote.at_s)}>
              Jump to this moment
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
