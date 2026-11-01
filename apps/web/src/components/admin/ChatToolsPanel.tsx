"use client";

import { useState } from "react";
import { deleteMessage, pinMessage, resolveReport, suspendMember, unsuspendMember } from "@/app/admin/club/actions";
import styles from "@/app/admin/admin.module.css";

type MessageRow = {
  id: string;
  user_id: string;
  body: string;
  pinned: boolean;
  author: { display_name: string | null; role: string; suspended_at: string | null } | null;
};

type ReportRow = {
  id: string;
  status: string;
  reason: string;
  message: { body: string; user_id: string } | null;
  reporter: { display_name: string | null } | null;
};

export function ChatToolsPanel({ clubMonthId, messages, reports }: { clubMonthId: string; messages: MessageRow[]; reports: ReportRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.list}>
      <h3 className={styles.hint}>Open reports</h3>
      {reports.filter((r) => r.status === "open").length === 0 && <p className={styles.hint}>No open reports.</p>}
      {reports
        .filter((r) => r.status === "open")
        .map((report) => (
          <div key={report.id} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
            <div className={styles.rowMeta}>Reported by {report.reporter?.display_name ?? "Member"}</div>
            <div>&ldquo;{report.message?.body}&rdquo;</div>
            <div className={styles.hint}>Reason: {report.reason}</div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.ghostButton}
                disabled={busy === report.id}
                onClick={() => run(report.id, () => resolveReport(report.id, clubMonthId, "resolved"))}
              >
                Resolve
              </button>
              <button
                type="button"
                className={styles.ghostButton}
                disabled={busy === report.id}
                onClick={() => run(report.id, () => resolveReport(report.id, clubMonthId, "dismissed"))}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}

      <h3 className={styles.hint} style={{ marginTop: 16 }}>
        Recent messages
      </h3>
      {messages.length === 0 && <p className={styles.hint}>No messages yet.</p>}
      {messages.map((message) => {
        const suspended = !!message.author?.suspended_at;
        return (
          <div key={message.id} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
            <div className={styles.rowMeta}>
              {message.author?.display_name ?? "Member"} {message.pinned && "· pinned"} {suspended && "· suspended"}
            </div>
            <div>{message.body}</div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.ghostButton}
                disabled={busy === message.id}
                onClick={() => run(message.id, () => pinMessage(message.id, clubMonthId, !message.pinned))}
              >
                {message.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={busy === message.id}
                onClick={() => run(message.id, () => deleteMessage(message.id, clubMonthId))}
              >
                Delete
              </button>
              <button
                type="button"
                className={styles.ghostButton}
                disabled={busy === message.id}
                onClick={() =>
                  run(message.id, () => (suspended ? unsuspendMember(message.user_id, clubMonthId) : suspendMember(message.user_id, clubMonthId)))
                }
              >
                {suspended ? "Unsuspend member" : "Suspend member"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
