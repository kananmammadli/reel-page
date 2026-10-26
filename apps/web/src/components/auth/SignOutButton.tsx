"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut(supabase);
    router.push("/");
    router.refresh();
  }

  return <button onClick={handleSignOut}>Sign out</button>;
}
