import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./database.types";
import type { Title } from "./catalog";

type Client = SupabaseClient<Database>;

export type ClubMonth = Tables<"club_months">;
export type ClubRelease = Tables<"club_releases">;
export type ChatMessage = Tables<"chat_messages">;
export type Question = Tables<"questions">;
export type Profile = Tables<"profiles">;

export type ClubMonthWithTitle = ClubMonth & { title: Title };
export type Author = Pick<Profile, "display_name" | "role"> | null;
export type ChatMessageWithAuthor = ChatMessage & { author: Author };
export type QuestionWithAuthor = Question & { author: Author };

function currentMonthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export async function getCurrentClubMonth(client: Client): Promise<ClubMonthWithTitle | null> {
  const { data, error } = await client.from("club_months").select("*, title:titles(*)").eq("month", currentMonthStart()).maybeSingle();
  if (error) throw error;
  return data as ClubMonthWithTitle | null;
}

export async function getClubMonth(client: Client, id: string): Promise<ClubMonthWithTitle | null> {
  const { data, error } = await client.from("club_months").select("*, title:titles(*)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as ClubMonthWithTitle | null;
}

export async function getOwnedClubMonths(client: Client, userId: string): Promise<ClubMonthWithTitle[]> {
  const { data: entitlements, error } = await client.from("entitlements").select("ref_id").eq("user_id", userId).eq("kind", "club_month");
  if (error) throw error;
  if (!entitlements || entitlements.length === 0) return [];

  const { data, error: monthsError } = await client
    .from("club_months")
    .select("*, title:titles(*)")
    .in(
      "id",
      entitlements.map((e) => e.ref_id),
    )
    .order("month", { ascending: false });
  if (monthsError) throw monthsError;
  return data as unknown as ClubMonthWithTitle[];
}

export async function getClubReleases(client: Client, clubMonthId: string): Promise<ClubRelease[]> {
  const { data, error } = await client.from("club_releases").select("*").eq("club_month_id", clubMonthId);
  if (error) throw error;
  return data;
}

export async function hasClubMonthEntitlement(client: Client, userId: string, clubMonthId: string): Promise<boolean> {
  const { data, error } = await client
    .from("entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "club_month")
    .eq("ref_id", clubMonthId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export type ClubEpisodeAccess = "full" | "not-released-yet" | "not-a-member";

// Pure: no DB access, so it's trivially unit-testable and reusable by both
// the live /club page and (duplicated, since Edge Functions are a
// separate Deno runtime -- see get-audio-url) the signed-URL gate.
export function getClubEpisodeAccess(release: ClubRelease | undefined, hasEntitlement: boolean, now: Date = new Date()): ClubEpisodeAccess {
  if (!release) return "not-a-member";
  if (new Date(release.release_at) > now) return "not-released-yet";
  return hasEntitlement ? "full" : "not-a-member";
}

export async function getChatMessages(client: Client, clubMonthId: string): Promise<ChatMessageWithAuthor[]> {
  const { data, error } = await client
    .from("chat_messages")
    .select("*, author:profiles(display_name, role)")
    .eq("club_month_id", clubMonthId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as unknown as ChatMessageWithAuthor[];
}

export async function sendChatMessage(client: Client, input: { clubMonthId: string; userId: string; body: string; replyTo?: string }): Promise<void> {
  const { error } = await client
    .from("chat_messages")
    .insert({ club_month_id: input.clubMonthId, user_id: input.userId, body: input.body, reply_to: input.replyTo ?? null });
  if (error) throw error;
}

export async function getQuestions(client: Client, clubMonthId: string): Promise<QuestionWithAuthor[]> {
  const { data, error } = await client
    .from("questions")
    .select("*, author:profiles(display_name, role)")
    .eq("club_month_id", clubMonthId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as QuestionWithAuthor[];
}

export async function submitQuestion(client: Client, input: { clubMonthId: string; userId: string; body: string }): Promise<void> {
  const { error } = await client.from("questions").insert({ club_month_id: input.clubMonthId, user_id: input.userId, body: input.body });
  if (error) throw error;
}

export async function getMyBlockedUserIds(client: Client, userId: string): Promise<string[]> {
  const { data, error } = await client.from("blocks").select("blocked_user_id").eq("user_id", userId);
  if (error) throw error;
  return data.map((row) => row.blocked_user_id);
}

export async function blockUser(client: Client, userId: string, blockedUserId: string): Promise<void> {
  const { error } = await client.from("blocks").insert({ user_id: userId, blocked_user_id: blockedUserId });
  if (error) throw error;
}

export async function unblockUser(client: Client, userId: string, blockedUserId: string): Promise<void> {
  const { error } = await client.from("blocks").delete().eq("user_id", userId).eq("blocked_user_id", blockedUserId);
  if (error) throw error;
}

export async function reportMessage(client: Client, input: { reporterId: string; messageId: string; reason: string }): Promise<void> {
  const { error } = await client.from("reports").insert({ reporter_id: input.reporterId, message_id: input.messageId, reason: input.reason });
  if (error) throw error;
}
