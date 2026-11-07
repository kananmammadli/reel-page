import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { computeJournalStats, getListeningDays, getQuotes, type QuoteWithContext } from "@reel-and-page/shared";

import { usePlayer } from "@/components/player/player-provider";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function QuotesScreen() {
  const theme = useTheme();
  const { play } = usePlayer();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [quotes, setQuotes] = useState<QuoteWithContext[]>([]);
  const [stats, setStats] = useState({ quotesSaved: 0, totalMinutes: 0, streakDays: 0 });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setSignedIn(false);
        setLoading(false);
        return;
      }
      setSignedIn(true);
      const [q, days] = await Promise.all([getQuotes(supabase, userData.user.id), getListeningDays(supabase, userData.user.id)]);
      setQuotes(q);
      setStats(computeJournalStats(q.length, days));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!signedIn) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <ThemedText type="title" style={styles.title}>
            Quotes
          </ThemedText>
          <ThemedText themeColor="textSecondary">Sign in from Profile to save and revisit lines while you listen.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>
            Quotes
          </ThemedText>

          <View style={styles.statRow}>
            <View style={[styles.stat, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="subtitle" style={styles.statValue}>
                {stats.quotesSaved}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Quotes saved
              </ThemedText>
            </View>
            <View style={[styles.stat, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="subtitle" style={styles.statValue}>
                {stats.streakDays}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Day streak
              </ThemedText>
            </View>
            <View style={[styles.stat, { borderColor: theme.backgroundSelected }]}>
              <ThemedText type="subtitle" style={styles.statValue}>
                {stats.totalMinutes}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Min. listened
              </ThemedText>
            </View>
          </View>

          {quotes.length === 0 ? (
            <ThemedText themeColor="textSecondary">Nothing saved yet -- tap the pen on the mini player while something&rsquo;s playing.</ThemedText>
          ) : (
            quotes.map((quote) => (
              <View key={quote.id} style={[styles.quote, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.quoteText}>&ldquo;{quote.text}&rdquo;</ThemedText>
                <View style={styles.quoteMeta}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.flex1}>
                    {quote.title.title} · {quote.episode.name} · {formatDate(quote.created_at)}
                  </ThemedText>
                  <Pressable onPress={() => play(quote.title, quote.episode, "full", quote.at_s)}>
                    <ThemedText type="small">Jump to this moment</ThemedText>
                  </Pressable>
                </View>
              </View>
            ))
          )}
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
  statRow: { flexDirection: "row", gap: Spacing.two },
  stat: { flex: 1, borderWidth: 1, borderRadius: 8, padding: Spacing.two, alignItems: "center" },
  statValue: { fontSize: 20 },
  quote: { borderRadius: 8, padding: Spacing.three, gap: Spacing.one },
  quoteText: { fontStyle: "italic" },
  quoteMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  flex1: { flex: 1 },
});
