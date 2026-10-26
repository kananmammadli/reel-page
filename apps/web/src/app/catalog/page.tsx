"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { searchTitles, type CatalogFilter, type Title } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/client";
import { PosterCard } from "@/components/catalog/PosterCard";
import styles from "./page.module.css";

const supabase = createClient();

const FILTERS: { key: CatalogFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "film", label: "Films" },
  { key: "story", label: "Stories" },
  { key: "free", label: "Free" },
];

export default function CatalogPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const results = await searchTitles(supabase, query, filter);
        if (!cancelled) setTitles(results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [query, filter]);

  return (
    <div className={styles.main}>
      <h1>Catalog</h1>
      <input
        className={styles.search}
        type="search"
        placeholder="Search films, stories, directors"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search"
      />
      <div className={styles.chips}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={styles.chip}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : titles.length === 0 ? (
        <p className={styles.empty}>Nothing matches that search. Try a director or author name.</p>
      ) : (
        <div className={styles.list}>
          {titles.map((title) => (
            <Link key={title.id} href={`/titles/${title.id}`} className={styles.item}>
              <PosterCard
                id={title.id}
                title={title.title}
                year={title.year}
                type={title.type}
                posterUrl={title.poster_url}
                className={styles.itemPoster}
                compact
              />
              <div className={styles.meta}>
                <b>{title.title}</b>
                <span>
                  {title.creator} · {title.genre}
                </span>
              </div>
              <span>{title.is_free ? "Free" : ""}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
