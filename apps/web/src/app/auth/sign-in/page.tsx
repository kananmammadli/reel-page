"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, verifyOtp } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

const supabase = createClient();

export default function SignInPage() {
  const router = useRouter();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestOtp(supabase, email);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(supabase, email, code);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.main}>
      <h1>Sign in</h1>
      <p className={styles.muted}>
        An account is only needed for purchases, the club, quotes, and syncing across devices.
      </p>

      {step === "email" ? (
        <form className={styles.form} onSubmit={handleRequestCode}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className={styles.input}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send me a code"}
          </button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={handleVerifyCode}>
          <p className={styles.muted}>Enter the code sent to {email}.</p>
          <label className={styles.label} htmlFor="code">
            Code
          </label>
          <input
            id="code"
            className={styles.input}
            type="text"
            inputMode="numeric"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
          />
          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? "Checking…" : "Sign in"}
          </button>
        </form>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.divider}>
        <span>Also coming</span>
      </div>
      <button className={`${styles.btn} ${styles.ghost}`} disabled>
        Continue with Apple (needs Apple Developer setup)
      </button>
      <button className={`${styles.btn} ${styles.ghost}`} disabled>
        Continue with Google (needs Google Cloud setup)
      </button>
    </div>
  );
}
