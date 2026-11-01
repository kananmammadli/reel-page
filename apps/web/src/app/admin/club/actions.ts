"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isHost } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireHost() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !(await isHost(supabase, userData.user.id))) {
    throw new Error("Forbidden");
  }
  return { supabase, userId: userData.user.id };
}

async function sendExpoPush(tokens: string[], title: string, body: string): Promise<void> {
  await Promise.all(
    tokens.map((to) =>
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, title, body }),
      }).catch(() => {
        // Best-effort -- a failed push should never block the host's answer from saving.
      }),
    ),
  );
}

function str(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export type ActionState = { error: string } | null;

export async function saveClubMonth(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireHost();

  const id = str(formData, "id");
  const month = str(formData, "month");
  const titleId = str(formData, "title_id");
  if (!month || !titleId) return { error: "Month and title are required" };

  const fields = { month, title_id: titleId, pitch: str(formData, "pitch"), price_ref: str(formData, "price_ref") };

  let clubMonthId = id;
  if (clubMonthId) {
    const { error } = await supabase.from("club_months").update(fields).eq("id", clubMonthId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("club_months").insert(fields).select("id").single();
    if (error) return { error: error.message };
    clubMonthId = data.id;
  }

  revalidatePath("/admin/club");
  revalidatePath("/club");
  redirect(`/admin/club/${clubMonthId}`);
}

export async function deleteClubMonth(id: string): Promise<void> {
  const { supabase } = await requireHost();
  const { error } = await supabase.from("club_months").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/club");
  redirect("/admin/club");
}

export async function saveReleaseSchedule(clubMonthId: string, schedule: { episodeId: string; releaseAt: string }[]): Promise<{ error?: string }> {
  const { supabase } = await requireHost();
  const { error } = await supabase
    .from("club_releases")
    .upsert(schedule.map((s) => ({ club_month_id: clubMonthId, episode_id: s.episodeId, release_at: s.releaseAt })), { onConflict: "club_month_id,episode_id" });
  if (error) return { error: error.message };
  revalidatePath(`/admin/club/${clubMonthId}`);
  revalidatePath("/club");
  return {};
}

export async function answerQuestion(questionId: string, clubMonthId: string, answer: string): Promise<{ error?: string }> {
  const { supabase } = await requireHost();
  if (!answer.trim()) return { error: "An answer is required" };

  const { data: question, error } = await supabase
    .from("questions")
    .update({ answer: answer.trim(), answered_at: new Date().toISOString(), published: true })
    .eq("id", questionId)
    .select("user_id")
    .single();
  if (error) return { error: error.message };

  const admin = createAdminClient();
  const { data: tokens } = await admin.from("push_tokens").select("token").eq("user_id", question.user_id);
  if (tokens && tokens.length > 0) {
    await sendExpoPush(tokens.map((t) => t.token), "The host answered your question", answer.trim().slice(0, 120));
  }

  revalidatePath(`/admin/club/${clubMonthId}`);
  revalidatePath("/club");
  return {};
}

export async function pinMessage(messageId: string, clubMonthId: string, pinned: boolean): Promise<void> {
  const { supabase } = await requireHost();
  const { error } = await supabase.from("chat_messages").update({ pinned }).eq("id", messageId);
  if (error) throw error;
  revalidatePath(`/admin/club/${clubMonthId}`);
}

export async function deleteMessage(messageId: string, clubMonthId: string): Promise<void> {
  const { supabase } = await requireHost();
  const { error } = await supabase.from("chat_messages").update({ deleted_at: new Date().toISOString() }).eq("id", messageId);
  if (error) throw error;
  revalidatePath(`/admin/club/${clubMonthId}`);
}

export async function resolveReport(reportId: string, clubMonthId: string, status: "resolved" | "dismissed"): Promise<void> {
  const { supabase } = await requireHost();
  const { error } = await supabase.from("reports").update({ status }).eq("id", reportId);
  if (error) throw error;
  revalidatePath(`/admin/club/${clubMonthId}`);
}

export async function suspendMember(userId: string, clubMonthId: string): Promise<void> {
  await requireHost();
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ suspended_at: new Date().toISOString() }).eq("id", userId);
  if (error) throw error;
  revalidatePath(`/admin/club/${clubMonthId}`);
}

export async function unsuspendMember(userId: string, clubMonthId: string): Promise<void> {
  await requireHost();
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ suspended_at: null }).eq("id", userId);
  if (error) throw error;
  revalidatePath(`/admin/club/${clubMonthId}`);
}
