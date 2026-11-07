import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { isHost } from "@reel-and-page/shared";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reel & Page",
  description: "Audio commentaries on films and short stories.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const host = userData.user ? await isHost(supabase, userData.user.id) : false;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <PlayerProvider>
          <nav
            style={{
              display: "flex",
              gap: 16,
              padding: "14px 20px",
              borderBottom: "1px solid #e4dbd8",
              alignItems: "center",
            }}
          >
            <Link href="/" style={{ fontWeight: 700 }}>
              Reel &amp; Page
            </Link>
            <Link href="/catalog">Catalog</Link>
            <Link href="/club">Club</Link>
            {userData.user && <Link href="/quotes">Quotes</Link>}
            {host && <Link href="/admin">Admin</Link>}
            <Link href={userData.user ? "/account" : "/auth/sign-in"} style={{ marginLeft: "auto" }}>
              {userData.user ? "Profile" : "Sign in"}
            </Link>
          </nav>
          <main style={{ flex: 1 }}>{children}</main>
          <MiniPlayer />
        </PlayerProvider>
      </body>
    </html>
  );
}
