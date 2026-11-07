import { createClient } from "jsr:@supabase/supabase-js@2";

// Weekly, opt-in-only (SPEC.md §3.6): finds recurring themes across a
// user's saved quotes from the past 7 days and suggests one reflective
// question, alongside plain listening-time/quotes-saved counts. Never
// labeled as therapy or professional advice -- every surface that shows
// this output must carry that label; this function only produces the
// content, it doesn't render it.
//
// Triggered by a weekly pg_cron job (see supabase/migrations/..._quotes.sql),
// not by any end user, so it checks a shared secret instead of a JWT --
// see CRON_SECRET in supabase/functions/.env.example.

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type ReflectionOutput = { main_theme: string; reflective_question: string };

async function summarizeQuotes(quoteTexts: string[]): Promise<ReflectionOutput | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;

  const prompt = `A listener saved these lines from films/stories they listened to this week:\n\n${quoteTexts.map((t) => `- "${t}"`).join("\n")}\n\nRespond with only a JSON object: {"main_theme": "<one short phrase naming a recurring theme across these lines>", "reflective_question": "<one open, gentle reflective question inspired by them>"}. No other text.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return null;

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.main_theme === "string" && typeof parsed.reflective_question === "string") return parsed;
  } catch {
    // Model didn't return valid JSON -- skip this user's reflection this
    // week rather than storing garbage.
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("X-Cron-Secret") !== cronSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const weekStartDate = weekStart.toISOString().slice(0, 10);

  const { data: settings, error: settingsError } = await supabase.from("reflection_settings").select("user_id").eq("enabled", true);
  if (settingsError) return jsonResponse({ error: settingsError.message }, 500);

  let created = 0;
  let skipped = 0;

  for (const { user_id } of settings ?? []) {
    const { data: quotes } = await supabase.from("quotes").select("text").eq("user_id", user_id).gte("created_at", weekStart.toISOString());
    if (!quotes || quotes.length === 0) {
      skipped++;
      continue;
    }

    const { data: days } = await supabase.from("listening_days").select("seconds").eq("user_id", user_id).gte("day", weekStartDate);
    const totalMinutes = Math.round((days ?? []).reduce((sum, d) => sum + d.seconds, 0) / 60);

    const summary = await summarizeQuotes(quotes.map((q) => q.text));
    if (!summary) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("reflections").upsert(
      {
        user_id,
        week_start: weekStartDate,
        quotes_count: quotes.length,
        total_minutes: totalMinutes,
        main_theme: summary.main_theme,
        reflective_question: summary.reflective_question,
      },
      { onConflict: "user_id,week_start" },
    );
    if (!error) created++;
  }

  return jsonResponse({ created, skipped });
});
