import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isHost } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

// Layer 1 of the defense-in-depth required by tasks.md milestone 5: a
// non-host is redirected before any admin UI renders. Layer 2 is RLS on
// every table/bucket this section writes to (see
// supabase/migrations/20261101120000_admin.sql) -- that's what actually
// stops a direct POST to a server action, since this check alone is only
// a UI nicety (see node_modules/next/dist/docs Server Actions guide:
// "render-time gating is not a security boundary").
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !(await isHost(supabase, userData.user.id))) {
    redirect("/");
  }

  return (
    <div>
      <nav className={styles.nav}>
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/titles">Titles</Link>
        <Link href="/admin/collections">Collections</Link>
        <Link href="/admin/club">Club</Link>
        <Link href="/admin/sales">Sales</Link>
      </nav>
      {children}
    </div>
  );
}
