import { useEffect, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { User } from "@supabase/supabase-js";
import { getContinueListening, requestOtp, signOut, verifyOtp, type ContinueListeningItem } from "@reel-and-page/shared";

import { PosterCard } from "@/components/catalog/poster-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";

export default function AccountScreen() {
  const theme = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [library, setLibrary] = useState<ContinueListeningItem[]>([]);

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setCheckingSession(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function run() {
      setLibrary(user ? await getContinueListening(supabase, 50) : []);
    }
    run();
  }, [user]);

  async function handleRequestCode() {
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

  async function handleVerifyCode() {
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(supabase, email, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut(supabase);
  }

  if (checkingSession) return null;

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <ThemedText type="title" style={styles.title}>
            Sign in
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            An account is only needed for purchases, the club, quotes, and syncing across devices.
          </ThemedText>

          {step === "email" ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
              />
              <Pressable style={styles.btn} onPress={handleRequestCode} disabled={loading}>
                <ThemedText style={styles.btnText}>{loading ? "Sending…" : "Send me a code"}</ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText themeColor="textSecondary">Enter the code sent to {email}.</ThemedText>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]}
              />
              <Pressable style={styles.btn} onPress={handleVerifyCode} disabled={loading}>
                <ThemedText style={styles.btnText}>{loading ? "Checking…" : "Sign in"}</ThemedText>
              </Pressable>
            </>
          )}

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <View style={styles.divider} />
          <Pressable style={[styles.btn, styles.ghostBtn]} disabled>
            <ThemedText>Continue with Apple (needs Apple Developer setup)</ThemedText>
          </Pressable>
          <Pressable style={[styles.btn, styles.ghostBtn]} disabled>
            <ThemedText>Continue with Google (needs Google Cloud setup)</ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedText type="title" style={styles.title}>
          Profile
        </ThemedText>
        <ThemedText themeColor="textSecondary">Signed in as {user.email}</ThemedText>
        <Pressable style={styles.btn} onPress={handleSignOut}>
          <ThemedText style={styles.btnText}>Sign out</ThemedText>
        </Pressable>

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Library
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Things you&rsquo;ve started. Owned commentaries and club membership arrive in milestone 4.
        </ThemedText>

        {library.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Nothing yet -- start an episode and it&rsquo;ll show up here.
          </ThemedText>
        ) : (
          <FlatList
            horizontal
            data={library}
            keyExtractor={(item) => item.episode.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            renderItem={({ item }) => (
              <Pressable style={styles.card} onPress={() => router.push(`/titles/${item.title.id}`)}>
                <PosterCard
                  id={item.title.id}
                  title={item.title.title}
                  year={item.title.year}
                  type={item.title.type}
                  posterUrl={item.title.poster_url}
                />
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.episode.name}
                </ThemedText>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  btn: {
    backgroundColor: "#8a1f2d",
    borderRadius: 999,
    paddingVertical: Spacing.two,
    alignItems: "center",
  },
  btnText: {
    color: "#fffaf6",
    fontWeight: "600",
  },
  ghostBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.3)",
  },
  error: {
    color: "#8a1f2d",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(128,128,128,0.2)",
    marginVertical: Spacing.two,
  },
  sectionTitle: {
    fontSize: 17,
    marginTop: Spacing.three,
  },
  empty: {
    marginTop: Spacing.one,
  },
  rail: {
    gap: Spacing.three,
  },
  card: {
    width: 130,
    gap: Spacing.one,
  },
});
