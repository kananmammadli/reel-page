import { notFound } from "next/navigation";
import {
  getEpisodes,
  getClubMonth,
  getClubReleases,
  hasClubMonthEntitlement,
  getChatMessages,
  getQuestions,
  getMyBlockedUserIds,
  isHost,
} from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import { ClubRoom } from "@/components/club/ClubRoom";

export const dynamic = "force-dynamic";

function isCurrentMonth(month: string): boolean {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  return month === monthStart;
}

export default async function ClubMonthPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const clubMonth = await getClubMonth(supabase, id);
  if (!clubMonth) notFound();

  const [episodes, releases, entitled, host] = await Promise.all([
    getEpisodes(supabase, clubMonth.title_id),
    getClubReleases(supabase, clubMonth.id),
    userId ? hasClubMonthEntitlement(supabase, userId, clubMonth.id) : Promise.resolve(false),
    userId ? isHost(supabase, userId) : Promise.resolve(false),
  ]);

  const canRead = entitled || host;
  const [messages, questions, blockedUserIds] = await Promise.all([
    canRead ? getChatMessages(supabase, clubMonth.id) : Promise.resolve([]),
    canRead ? getQuestions(supabase, clubMonth.id) : Promise.resolve([]),
    userId ? getMyBlockedUserIds(supabase, userId) : Promise.resolve([]),
  ]);

  return (
    <ClubRoom
      clubMonth={clubMonth}
      episodes={episodes}
      releases={releases}
      messages={messages}
      questions={questions}
      blockedUserIds={blockedUserIds}
      userId={userId}
      isEntitled={entitled}
      isHost={host}
      isCurrentMonth={isCurrentMonth(clubMonth.month)}
    />
  );
}
