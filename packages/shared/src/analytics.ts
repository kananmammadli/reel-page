import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.types";

type Client = SupabaseClient<Database>;

export type AnalyticsEventType = "play" | "preview_completed" | "purchase" | "club_join";

// First-party, privacy-friendly event log (SPEC.md §5) -- no third-party
// analytics SDK, so nothing beyond what this app already collects gets
// shared anywhere else. Write-only from the caller's side: there's no
// corresponding "get" export, since nothing but the host's sales
// dashboard ever reads this back (see RLS).
export async function trackEvent(
  client: Client,
  input: { eventType: AnalyticsEventType; userId?: string | null; titleId?: string | null; metadata?: Record<string, unknown> },
): Promise<void> {
  const { error } = await client.from("analytics_events").insert({
    event_type: input.eventType,
    user_id: input.userId ?? null,
    title_id: input.titleId ?? null,
    metadata: (input.metadata as Json) ?? null,
  });
  if (error) throw error;
}
