import { getEpisodes, getCurrentClubMonth, getClubReleases, hasClubMonthEntitlement, getChatMessages, getQuestions, getMyBlockedUserIds, isHost } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import { ClubRoom } from "@/components/club/ClubRoom";
import styles from "./club.module.css";

export const dynamic = "force-dynamic";

export default async function ClubPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;

  const clubMonth = await getCurrentClubMonth(supabase);
  if (!clubMonth) {
    return (
      <div className={styles.main}>
        <h1>The club</h1>
        <p className={styles.muted}>There&rsquo;s no club pick announced for this month yet -- check back soon.</p>
      </div>
    );
  }

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
    />
  );
}
