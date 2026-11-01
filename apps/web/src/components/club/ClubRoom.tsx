"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  blockUser,
  getClubEpisodeAccess,
  reportMessage,
  sendChatMessage,
  submitQuestion,
  type ChatMessageWithAuthor,
  type ClubMonthWithTitle,
  type ClubRelease,
  type Episode,
  type QuestionWithAuthor,
} from "@reel-and-page/shared";
import { usePlayer } from "@/components/player/PlayerProvider";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/club/club.module.css";

const supabase = createClient();

function formatReleaseDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ClubRoom({
  clubMonth,
  episodes,
  releases,
  messages: initialMessages,
  questions: initialQuestions,
  blockedUserIds,
  userId,
  isEntitled,
  isHost,
  isCurrentMonth = true,
}: {
  clubMonth: ClubMonthWithTitle;
  episodes: Episode[];
  releases: ClubRelease[];
  messages: ChatMessageWithAuthor[];
  questions: QuestionWithAuthor[];
  blockedUserIds: string[];
  userId: string | null;
  isEntitled: boolean;
  isHost: boolean;
  isCurrentMonth?: boolean;
}) {
  const { current, play } = usePlayer();
  const [messages, setMessages] = useState(initialMessages);
  const [questions, setQuestions] = useState(initialQuestions);
  const [blocked, setBlocked] = useState(new Set(blockedUserIds));
  const [chatText, setChatText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const canRead = isEntitled || isHost;

  useEffect(() => {
    if (!canRead) return;
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
  }, [clubMonth.id, canRead]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const visibleMessages = useMemo(() => messages.filter((m) => !blocked.has(m.user_id)), [messages, blocked]);
  const messageById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  async function joinClub() {
    setError(null);
    setJoining(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "club" }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Checkout failed");
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setJoining(false);
    }
  }

  async function sendMessage() {
    if (!userId || !chatText.trim()) return;
    setError(null);
    try {
      await sendChatMessage(supabase, { clubMonthId: clubMonth.id, userId, body: chatText.trim(), replyTo: replyTo ?? undefined });
      setChatText("");
      setReplyTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that message");
    }
  }

  async function handleReport(messageId: string) {
    const reason = window.prompt("What's wrong with this message?");
    if (!reason || !userId) return;
    try {
      await reportMessage(supabase, { reporterId: userId, messageId, reason });
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
    if (!userId || !questionText.trim()) return;
    setError(null);
    try {
      await submitQuestion(supabase, { clubMonthId: clubMonth.id, userId, body: questionText.trim() });
      setQuestions((prev) => [
        { id: crypto.randomUUID(), club_month_id: clubMonth.id, user_id: userId, body: questionText.trim(), answer: null, answered_at: null, published: false, created_at: new Date().toISOString(), author: null },
        ...prev,
      ]);
      setQuestionText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit that question");
    }
  }

  function playEpisode(episode: Episode) {
    const release = releases.find((r) => r.episode_id === episode.id);
    const access = getClubEpisodeAccess(release, isEntitled);
    if (access !== "full") return;
    play(clubMonth.title, episode, "full");
  }

  return (
    <div className={styles.main}>
      <div className={styles.banner}>
        <div className={styles.muted} style={{ color: "inherit", opacity: 0.7 }}>
          This month&rsquo;s pick
        </div>
        <h1 style={{ margin: "4px 0" }}>{clubMonth.title.title}</h1>
        {clubMonth.pitch && <p className={styles.pitch}>{clubMonth.pitch}</p>}
      </div>

      {!canRead && isCurrentMonth && (
        <div className={styles.joinBox}>
          <p>Join the club to chat, ask questions, and unlock episodes as they&rsquo;re released.</p>
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.btn} onClick={joinClub} disabled={joining || !userId}>
            {!userId ? "Sign in to join" : joining ? "Starting checkout…" : "Join the club"}
          </button>
        </div>
      )}

      {!canRead && !isCurrentMonth && (
        <div className={styles.joinBox}>
          <p>You didn&rsquo;t have club access during this month, so its chat and Q&amp;A aren&rsquo;t available to you.</p>
        </div>
      )}

      <section>
        <h2 className={styles.sectionTitle}>Episodes</h2>
        {episodes.map((episode) => {
          const release = releases.find((r) => r.episode_id === episode.id);
          const access = getClubEpisodeAccess(release, isEntitled);
          const isPlaying = current?.episode.id === episode.id;
          return (
            <div key={episode.id} className={styles.episodeRow}>
              <span className={styles.episodeName}>
                {isPlaying ? "▶ " : ""}
                {episode.name}
              </span>
              {access === "full" ? (
                <button className={styles.ghost} onClick={() => playEpisode(episode)}>
                  Play
                </button>
              ) : access === "not-released-yet" && release ? (
                <span className={styles.muted}>Releases {formatReleaseDate(release.release_at)}</span>
              ) : (
                <span className={styles.muted}>Locked</span>
              )}
            </div>
          );
        })}
      </section>

      {canRead && (
        <>
          <section>
            <h2 className={styles.sectionTitle}>Chat</h2>
            <div className={styles.chat}>
              {visibleMessages.length === 0 && <p className={styles.muted}>No messages yet -- say hello.</p>}
              {visibleMessages.map((message) => {
                const parent = message.reply_to ? messageById.get(message.reply_to) : null;
                return (
                  <div key={message.id} className={`${styles.message} ${message.pinned ? styles.messagePinned : ""}`}>
                    <div className={styles.messageHead}>
                      <span>{message.author?.display_name ?? "Member"}</span>
                      {message.author?.role === "host" && <span className={styles.hostBadge}>Host</span>}
                      {message.pinned && <span className={styles.muted}>· pinned</span>}
                    </div>
                    {parent && <div className={styles.replyPreview}>{parent.author?.display_name ?? "Member"}: {parent.body}</div>}
                    <div>{message.body}</div>
                    {userId && message.user_id !== userId && (
                      <div className={styles.messageActions}>
                        <button className={styles.linkButton} onClick={() => setReplyTo(message.id)}>
                          Reply
                        </button>
                        <button className={styles.linkButton} onClick={() => handleReport(message.id)}>
                          Report
                        </button>
                        <button className={styles.linkButton} onClick={() => handleBlock(message.user_id)}>
                          Block
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>

            {userId && isCurrentMonth && (
              <div>
                {replyTo && (
                  <div className={styles.replyPreview}>
                    Replying to {messageById.get(replyTo)?.author?.display_name ?? "Member"}
                    <button className={styles.linkButton} style={{ marginLeft: 8 }} onClick={() => setReplyTo(null)}>
                      Cancel
                    </button>
                  </div>
                )}
                <div className={styles.composer}>
                  <input
                    type="text"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder="Say something…"
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  />
                  <button className={styles.btn} onClick={sendMessage} disabled={!chatText.trim()}>
                    Send
                  </button>
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className={styles.sectionTitle}>Q&amp;A</h2>
            {questions.length === 0 && <p className={styles.muted}>No questions yet.</p>}
            {questions.map((question) => (
              <div key={question.id} className={styles.question}>
                <div className={styles.messageHead}>
                  <span>{question.author?.display_name ?? "Member"}</span>
                  {!question.published && question.user_id === userId && <span className={styles.muted}>· awaiting an answer</span>}
                </div>
                <div>{question.body}</div>
                {question.answer && (
                  <div className={styles.answer}>
                    <div className={styles.messageHead}>
                      <span className={styles.hostBadge}>Host</span>
                    </div>
                    {question.answer}
                  </div>
                )}
              </div>
            ))}

            {userId && isCurrentMonth && (
              <div className={styles.composer}>
                <input type="text" value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Ask the host something…" />
                <button className={styles.btn} onClick={askQuestion} disabled={!questionText.trim()}>
                  Ask
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {error && canRead && <p className={styles.error}>{error}</p>}
    </div>
  );
}
