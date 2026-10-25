import styles from "@/app/page.module.css";

// No poster_url in the seed data yet (real artwork comes with the admin
// panel in milestone 5), so render a gradient card from the title, mirroring
// prototype/reel-and-page.html's CSS-only poster approach. Swaps to an <img>
// once titles.poster_url is set.
const GRADIENTS = [
  ["#6b1d2a", "#2a1018"],
  ["#3d3a52", "#15131f"],
  ["#2f3b2c", "#0f1410"],
  ["#8a5a1c", "#2b1b08"],
  ["#4f2a46", "#1b0d18"],
  ["#5a1a1a", "#1a0707"],
  ["#8c7a2c", "#2d2709"],
  ["#2c4a5a", "#0b1820"],
] as const;

function gradientFor(id: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length]!;
}

export function PosterCard({
  id,
  title,
  year,
  type,
  posterUrl,
  className,
  compact = false,
}: {
  id: string;
  title: string;
  year: number | null;
  type: "film" | "story";
  posterUrl?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const classes = className ? `${styles.poster} ${className}` : styles.poster;

  if (posterUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- remote admin-uploaded art, size varies
    return <img src={posterUrl} alt={title} className={classes} />;
  }

  const [c1, c2] = gradientFor(id);
  return (
    <div className={classes} style={{ background: `linear-gradient(160deg, ${c1}, ${c2})` }}>
      {!compact && (
        <span className={styles.posterLabel}>
          {type === "film" ? "Film" : "Story"} {year ? `· ${year}` : ""}
        </span>
      )}
      <span className={styles.posterTitle} style={compact ? { fontSize: "0.5rem" } : undefined}>
        {title}
      </span>
    </div>
  );
}
