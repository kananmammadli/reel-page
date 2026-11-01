"use client";

import { useState } from "react";
import type { QuestionWithAuthor } from "@reel-and-page/shared";
import { answerQuestion } from "@/app/admin/club/actions";
import styles from "@/app/admin/admin.module.css";

function QuestionRow({ question, clubMonthId }: { question: QuestionWithAuthor; clubMonthId: string }) {
  const [answer, setAnswer] = useState(question.answer ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnswer() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await answerQuestion(question.id, clubMonthId, answer);
      if (result.error) throw new Error(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that answer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.row} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
      <div className={styles.rowMeta}>{question.author?.display_name ?? "Member"}</div>
      <div>{question.body}</div>
      {question.answered_at ? (
        <div className={styles.hint}>Answered: {question.answer}</div>
      ) : (
        <>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} placeholder="Write an answer…" />
          {error && <span className={styles.error}>{error}</span>}
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={handleAnswer} disabled={submitting || !answer.trim()}>
              {submitting ? "Publishing…" : "Answer & publish"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function QuestionInbox({ clubMonthId, questions }: { clubMonthId: string; questions: QuestionWithAuthor[] }) {
  const unanswered = questions.filter((q) => !q.answered_at);
  const answered = questions.filter((q) => q.answered_at);

  return (
    <div className={styles.list}>
      {unanswered.length === 0 && answered.length === 0 && <p className={styles.hint}>No questions yet.</p>}
      {unanswered.map((q) => (
        <QuestionRow key={q.id} question={q} clubMonthId={clubMonthId} />
      ))}
      {answered.map((q) => (
        <QuestionRow key={q.id} question={q} clubMonthId={clubMonthId} />
      ))}
    </div>
  );
}
