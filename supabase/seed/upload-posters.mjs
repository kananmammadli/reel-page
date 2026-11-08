#!/usr/bin/env node
// Local-dev-only tool: uploads the pre-generated placeholder cover art in
// supabase/seed/posters/ to the Supabase Storage 'posters' bucket and sets
// titles.poster_url, keyed by title (ids are random per-environment, so
// filenames can't be).
//
// Run after `supabase db reset` (or `supabase start`):
//   pnpm seed:posters
//
// Images are original, generated art (gradient + grain + a genre motif,
// title baked in) -- not real poster scans, so there's no licensing
// question either way, but this also sidesteps it: these titles are a mix
// of public-domain-old (Nosferatu, Metropolis...) and still-copyrighted
// (Casablanca) films, so real poster art isn't safe to reuse uniformly.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const postersDir = join(dirname(fileURLToPath(import.meta.url)), "posters");

const SLUGS = {
  "Сердце-обличитель": "tell-tale-heart",
  "Жёлтые обои": "yellow-wallpaper",
  "Дары волхвов": "gift-of-the-magi",
  Носферату: "nosferatu",
  "Шерлок младший": "sherlock-jr",
  Генерал: "the-general",
  Метрополис: "metropolis",
  Касабланка: "casablanca",
};

const { data: titles, error: titlesError } = await supabase.from("titles").select("id, title");
if (titlesError) throw titlesError;

for (const row of titles) {
  const slug = SLUGS[row.title];
  if (!slug) continue; // not one of the seeded titles this script knows art for

  const file = readFileSync(join(postersDir, `${slug}.jpg`));
  const storagePath = `${row.id}.jpg`;

  const { error: uploadError } = await supabase.storage.from("posters").upload(storagePath, file, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from("posters").getPublicUrl(storagePath);
  const { error: updateError } = await supabase.from("titles").update({ poster_url: pub.publicUrl }).eq("id", row.id);
  if (updateError) throw updateError;

  console.log("done:", row.title);
}
