import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { MiniPlayer } from "@/components/player/MiniPlayer";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <PlayerProvider>
          <nav style={{ display: "flex", gap: 16, padding: "14px 20px", borderBottom: "1px solid #e4dbd8" }}>
            <Link href="/" style={{ fontWeight: 700 }}>
              Reel &amp; Page
            </Link>
            <Link href="/catalog">Catalog</Link>
          </nav>
          <main style={{ flex: 1 }}>{children}</main>
          <MiniPlayer />
        </PlayerProvider>
      </body>
    </html>
  );
}
