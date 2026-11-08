import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  blockUser,
  getChatMessages,
  getClubEpisodeAccess,
  getClubReleases,
  getCurrentClubMonth,
  getMyBlockedUserIds,
  getQuestions,
  hasClubMonthEntitlement,
  isHost as isHostCheck,
  reportMessage,
  sendChatMessage,
  submitQuestion,
  type ChatMessageWithAuthor,
  type ClubMonthWithTitle,
  type ClubRelease,
  type Episode,
  type QuestionWithAuthor,
} from "@reel-and-page/shared";
import { getEpisodes } from "@reel-and-page/shared";

import { usePlayer } from "@/components/player/player-provider";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";

function formatReleaseDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ClubScreen() {
  const theme = useTheme();
  const { current, play } = usePlayer();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [clubMonth, setClubMonth] = useState<ClubMonthWithTitle | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [releases, setReleases] = useState<ClubRelease[]>([]);
  const [entitled, setEntitled] = useState(false);
  const [host, setHost] = useState(false);
  const [messages, setMessages] = useState<ChatMessageWithAuthor[]>([]);
  const [questions, setQuestions] = useState<QuestionWithAuthor[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [chatText, setChatText] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const canRead = entitled || host;

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);

      const month = await getCurrentClubMonth(supabase);
      setClubMonth(month);
      if (!month) {
        setLoading(false);
        return;
      }

      const [eps, rels, ent, isHostUser] = await Promise.all([
        getEpisodes(supabase, month.title_id),
        getClubReleases(supabase, month.id),
        uid ? hasClubMonthEntitlement(supabase, uid, month.id) : Promise.resolve(false),
        uid ? isHostCheck(supabase, uid) : Promise.resolve(false),
      ]);
      setEpisodes(eps);
      setReleases(rels);
      setEntitled(ent);
      setHost(isHostUser);

      const canReadNow = ent || isHostUser;
      const [msgs, qs, blockedIds] = await Promise.all([
        canReadNow ? getChatMessages(supabase, month.id) : Promise.resolve([]),
        canReadNow ? getQuestions(supabase, month.id) : Promise.resolve([]),
        uid ? getMyBlockedUserIds(supabase, uid) : Promise.resolve([]),
      ]);
      setMessages(msgs);
      setQuestions(qs);
      setBlocked(new Set(blockedIds));
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!clubMonth || !canRead) return;
    const channel = supabase
      .channel(`club-chat-${clubMonth.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `club_month_id=eq.${clubMonth.id}` },
        async (payload) => {
          const row = payload.new as ChatMessageWithAuthor;
          const { data: author } = await supabase.from("profiles").select("display_name, role").eq("id", row.user_id).maybeSingle();
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, author: author ?? null }]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `club_month_id=eq.${clubMonth.id}` },
        (payload) => {
          const row = payload.new as ChatMessageWithAuthor;
          setMessages((prev) => (row.deleted_at ? prev.filter((m) => m.id !== row.id) : prev.map((m) => (m.id === row.id ? { ...m, ...row } : m))));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubMonth, canRead]);

  const visibleMessages = useMemo(() => messages.filter((m) => !blocked.has(m.user_id)), [messages, blocked]);

  async function joinClub() {
    setError(null);
    setJoining(true);
    setError("Joining from the app needs a real RevenueCat project -- not set up yet. Join from the website instead.");
    setJoining(false);
  }

  async function sendMessage() {
    if (!userId || !chatText.trim() || !clubMonth) return;
    setError(null);
    try {
      await sendChatMessage(supabase, { clubMonthId: clubMonth.id, userId, body: chatText.trim() });
      setChatText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that message");
    }
  }

  async function submitReport() {
    if (!userId || !reportingId || !reportReason.trim()) return;
    try {
      await reportMessage(supabase, { reporterId: userId, messageId: reportingId, reason: reportReason.trim() });
      setReportingId(null);
      setReportReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not file that report");
    }
  }

  async function handleBlock(blockedUserId: string) {
    if (!userId) return;
    try {
      await blockUser(supabase, userId, blockedUserId);
      setBlocked((prev) => new Set(prev).add(blockedUserId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not block that member");
    }
  }

  async function askQuestion() {
    if (!userId || !questionText.trim() || !clubMonth) return;
    setError(null);
    try {
      await submitQuestion(supabase, { clubMonthId: clubMonth.id, userId, body: questionText.trim() });
      setQuestions((prev) => [
        {
          id: `local-${Date.now()}`,
          club_month_id: clubMonth.id,
          user_id: userId,
          body: questionText.trim(),
          answer: null,
          answered_at: null,
          published: false,
          created_at: new Date().toISOString(),
          author: null,
        },
        ...prev,
      ]);
      setQuestionText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit that question");
    }
  }

  function playEpisode(episode: Episode) {
    if (!clubMonth) return;
    const release = releases.find((r) => r.episode_id === episode.id);
    if (getClubEpisodeAccess(release, entitled) !== "full") return;
    play(clubMonth.title, episode, "full");
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!clubMonth) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <ThemedText type="title" style={styles.title}>
            The club
          </ThemedText>
          <ThemedText themeColor="textSecondary">There&rsquo;s no club pick announced for this month yet.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.banner, { backgroundColor: "#3d3a52" }]}>
            <ThemedText type="small" style={styles.bannerLabel}>
              This month&rsquo;s pick
            </ThemedText>
            <ThemedText type="subtitle" style={styles.bannerTitle}>
              {clubMonth.title.title}
            </ThemedText>
            {clubMonth.pitch && <ThemedText style={styles.bannerPitch}>{clubMonth.pitch}</ThemedText>}
          </View>

          {!canRead && (
            <View style={[styles.joinBox, { borderColor: theme.backgroundSelected }]}>
              <ThemedText>Join the club to chat, ask questions, and unlock episodes as they&rsquo;re released.</ThemedText>
              {error && <ThemedText style={styles.error}>{error}</ThemedText>}
              <Pressable style={styles.btn} onPress={joinClub} disabled={joining}>
                <ThemedText style={styles.btnText}>{joining ? "…" : "Join the club"}</ThemedText>
              </Pressable>
            </View>
          )}

          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Episodes
          </ThemedText>
          {episodes.map((episode) => {
            const release = releases.find((r) => r.episode_id === episode.id);
            const access = getClubEpisodeAccess(release, entitled);
            const isPlaying = current?.episode.id === episode.id;
            return (
              <View key={episode.id} style={[styles.episodeRow, { borderColor: theme.backgroundSelected }]}>
                <ThemedText style={styles.flex1}>
                  {isPlaying ? "▶ " : ""}
                  {episode.name}
                </ThemedText>
                {access === "full" ? (
                  <Pressable onPress={() => playEpisode(episode)}>
                    <ThemedText themeColor="textSecondary">Play</ThemedText>
                  </Pressable>
                ) : access === "not-released-yet" && release ? (
                  <ThemedText themeColor="textSecondary" type="small">
                    Releases {formatReleaseDate(release.release_at)}
                  </ThemedText>
                ) : (
                  <ThemedText themeColor="textSecondary" type="small">
                    Locked
                  </ThemedText>
                )}
              </View>
            );
          })}

          {canRead && (
            <>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Chat
              </ThemedText>
              {visibleMessages.length === 0 && <ThemedText themeColor="textSecondary">No messages yet -- say hello.</ThemedText>}
              {visibleMessages.map((message) => (
                <View key={message.id} style={[styles.message, { backgroundColor: theme.backgroundElement }, message.pinned && styles.messagePinned]}>
                  <View style={styles.messageHead}>
                    <ThemedText type="smallBold">{message.author?.display_name ?? "Member"}</ThemedText>
                    {message.author?.role === "host" && (
                      <View style={styles.hostBadge}>
                        <ThemedText type="small" style={styles.hostBadgeText}>
                          Host
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText>{message.body}</ThemedText>
                  {userId && message.user_id !== userId && (
                    <View style={styles.messageActions}>
                      <Pressable onPress={() => setReportingId(message.id)}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Report
                        </ThemedText>
                      </Pressable>
                      <Pressable onPress={() => handleBlock(message.user_id)}>
                        <ThemedText type="small" themeColor="textSecondary">
                          Block
                        </ThemedText>
                      </Pressable>
                    </View>
                  )}
                  {reportingId === message.id && (
                    <View style={styles.reportRow}>
                      <TextInput
                        value={reportReason}
                        onChangeText={setReportReason}
                        placeholder="Why are you reporting this?"
                        placeholderTextColor={theme.textSecondary}
                        accessibilityLabel="Report reason"
                        style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text, flex: 1 }]}
                      />
                      <Pressable onPress={submitReport}>
                        <ThemedText type="small">Send</ThemedText>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}

              {userId && (
                <View style={styles.composer}>
                  <TextInput
                    value={chatText}
                    onChangeText={setChatText}
                    placeholder="Say something…"
                    placeholderTextColor={theme.textSecondary}
                    accessibilityLabel="Chat message"
                    style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
                  />
                  <Pressable style={styles.btn} onPress={sendMessage} disabled={!chatText.trim()}>
                    <ThemedText style={styles.btnText}>Send</ThemedText>
                  </Pressable>
                </View>
              )}

              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Q&amp;A
              </ThemedText>
              {questions.length === 0 && <ThemedText themeColor="textSecondary">No questions yet.</ThemedText>}
              {questions.map((question) => (
                <View key={question.id} style={[styles.message, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">{question.author?.display_name ?? "Member"}</ThemedText>
                  <ThemedText>{question.body}</ThemedText>
                  {question.answer && (
                    <View style={styles.answer}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Host:
                      </ThemedText>
                      <ThemedText>{question.answer}</ThemedText>
                    </View>
                  )}
                </View>
              ))}

              {userId && (
                <View style={styles.composer}>
                  <TextInput
                    value={questionText}
                    onChangeText={setQuestionText}
                    placeholder="Ask the host something…"
                    placeholderTextColor={theme.textSecondary}
                    accessibilityLabel="Question for the host"
                    style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
                  />
                  <Pressable style={styles.btn} onPress={askQuestion} disabled={!questionText.trim()}>
                    <ThemedText style={styles.btnText}>Ask</ThemedText>
                  </Pressable>
                </View>
              )}
            </>
          )}

          {error && canRead && <ThemedText style={styles.error}>{error}</ThemedText>}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  title: { fontSize: 28 },
  banner: { borderRadius: 12, padding: Spacing.three },
  bannerLabel: { color: "#fff8f2", opacity: 0.7 },
  bannerTitle: { color: "#fff8f2" },
  bannerPitch: { color: "#fff8f2", opacity: 0.85, marginTop: Spacing.one },
  joinBox: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.two, alignItems: "center" },
  sectionTitle: { fontSize: 17, marginTop: Spacing.two },
  episodeRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two, borderWidth: 1, borderRadius: 8, padding: Spacing.two },
  flex1: { flex: 1 },
  message: { borderRadius: 8, padding: Spacing.two, gap: Spacing.one },
  messagePinned: { borderWidth: 1, borderColor: "#8a1f2d" },
  messageHead: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  hostBadge: { backgroundColor: "#8a1f2d", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  hostBadgeText: { color: "#fffaf6" },
  messageActions: { flexDirection: "row", gap: Spacing.three },
  reportRow: { flexDirection: "row", gap: Spacing.two, alignItems: "center" },
  composer: { flexDirection: "row", gap: Spacing.two, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  btn: { backgroundColor: "#8a1f2d", borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  btnText: { color: "#fffaf6", fontWeight: "600" },
  answer: { marginTop: Spacing.one, paddingTop: Spacing.one, borderTopWidth: 1, borderTopColor: "rgba(128,128,128,0.2)" },
  error: { color: "#8a1f2d" },
});
