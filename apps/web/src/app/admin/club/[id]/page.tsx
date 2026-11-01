import { notFound } from "next/navigation";
import { getEpisodes, getClubReleases, getQuestions } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import { ClubMonthForm } from "@/components/admin/ClubMonthForm";
import { ReleaseScheduleForm } from "@/components/admin/ReleaseScheduleForm";
import { QuestionInbox } from "@/components/admin/QuestionInbox";
import { ChatToolsPanel } from "@/components/admin/ChatToolsPanel";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteClubMonth } from "../actions";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function EditClubMonthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: clubMonth, error: clubMonthError } = await supabase.from("club_months").select("*").eq("id", id).maybeSingle();
  if (clubMonthError) throw clubMonthError;
  if (!clubMonth) notFound();

  const [{ data: titles, error: titlesError }, episodes, releases, questions, { data: messages, error: messagesError }, { data: reports, error: reportsError }] =
    await Promise.all([
      supabase.from("titles").select("*").order("title"),
      getEpisodes(supabase, clubMonth.title_id),
      getClubReleases(supabase, clubMonth.id),
      getQuestions(supabase, clubMonth.id),
      supabase
        .from("chat_messages")
        .select("*, author:profiles(display_name, role, suspended_at)")
        .eq("club_month_id", clubMonth.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("reports")
        .select("*, message:chat_messages!inner(body, user_id, club_month_id), reporter:profiles!reports_reporter_id_profiles_fkey(display_name)")
        .eq("message.club_month_id", clubMonth.id)
        .order("created_at", { ascending: false }),
    ]);
  if (titlesError) throw titlesError;
  if (messagesError) throw messagesError;
  if (reportsError) throw reportsError;

  return (
    <div className={styles.main}>
      <h1>Club -- {clubMonth.month}</h1>
      <ClubMonthForm clubMonth={clubMonth} titles={titles} />

      <section>
        <h2 className={styles.hint}>Release schedule</h2>
        <ReleaseScheduleForm clubMonthId={clubMonth.id} episodes={episodes} releases={releases} />
      </section>

      <section>
        <h2 className={styles.hint}>Q&amp;A inbox</h2>
        <QuestionInbox clubMonthId={clubMonth.id} questions={questions} />
      </section>

      <section>
        <h2 className={styles.hint}>Chat tools</h2>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined shapes from ad-hoc selects, not worth a dedicated shared type for an admin-only panel */}
        <ChatToolsPanel clubMonthId={clubMonth.id} messages={(messages as any) ?? []} reports={(reports as any) ?? []} />
      </section>

      <DeleteButton action={deleteClubMonth.bind(null, clubMonth.id)} confirmText="Delete this club month? Chat/Q&A history goes with it." label="Delete club month" />
    </div>
  );
}
