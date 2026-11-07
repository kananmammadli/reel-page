import { useEffect, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Switch, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { User } from "@supabase/supabase-js";
import {
  getContinueListening,
  getOwnedClubMonths,
  getOwnedCollections,
  getOwnedTitles,
  getReflectionSettings,
  getReflections,
  requestOtp,
  setReflectionEnabled,
  signOut,
  verifyOtp,
  type ClubMonthWithTitle,
  type Collection,
  type ContinueListeningItem,
  type Reflection,
  type Title,
} from "@reel-and-page/shared";

import { PosterCard } from "@/components/catalog/poster-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import { isPurchasesConfigured, restorePurchases } from "@/lib/purchases";
import { registerForPushNotifications } from "@/lib/notifications";

export default function AccountScreen() {
  const theme = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [library, setLibrary] = useState<ContinueListeningItem[]>([]);
  const [ownedTitles, setOwnedTitles] = useState<Title[]>([]);
  const [ownedCollections, setOwnedCollections] = useState<Collection[]>([]);
  const [ownedClubMonths, setOwnedClubMonths] = useState<ClubMonthWithTitle[]>([]);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [reflectionEnabled, setReflectionEnabledState] = useState(false);
  const [reflectionBusy, setReflectionBusy] = useState(false);
  const [reflections, setReflections] = useState<Reflection[]>([]);

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
      if (!user) {
        setLibrary([]);
        setOwnedTitles([]);
        setOwnedCollections([]);
        setOwnedClubMonths([]);
        setReflectionEnabledState(false);
        setReflections([]);
        return;
      }
      setLibrary(await getContinueListening(supabase, 50));
      setOwnedTitles(await getOwnedTitles(supabase, user.id));
      setOwnedCollections(await getOwnedCollections(supabase, user.id));
      setOwnedClubMonths(await getOwnedClubMonths(supabase, user.id));
      const settings = await getReflectionSettings(supabase, user.id);
      setReflectionEnabledState(settings?.enabled ?? false);
      setReflections(await getReflections(supabase, user.id));
    }
    run();
  }, [user]);

  async function handleReflectionToggle(value: boolean) {
    if (!user) return;
    setReflectionBusy(true);
    try {
      await setReflectionEnabled(supabase, user.id, value);
      setReflectionEnabledState(value);
      if (!value) setReflections([]);
    } finally {
      setReflectionBusy(false);
    }
  }

  async function handlePushToggle(value: boolean) {
    setPushMessage(null);
    if (!value || !user) {
      setPushEnabled(false);
      return;
    }
    setPushBusy(true);
    try {
      const result = await registerForPushNotifications(user.id);
      if (result.error) {
        setPushMessage(result.error);
        setPushEnabled(false);
      } else {
        setPushEnabled(true);
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function handleRestore() {
    setRestoreMessage(null);
    setRestoring(true);
    try {
      if (!isPurchasesConfigured()) throw new Error("Purchases aren't set up yet");
      await restorePurchases();
      setRestoreMessage("Restored.");
    } catch (err) {
      setRestoreMessage(err instanceof Error ? err.message : "Could not restore purchases");
    } finally {
      setRestoring(false);
    }
  }

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
        <Pressable style={[styles.btn, styles.ghostBtn]} onPress={handleRestore} disabled={restoring}>
          <ThemedText>{restoring ? "Restoring…" : "Restore purchases"}</ThemedText>
        </Pressable>
        {restoreMessage && <ThemedText themeColor="textSecondary">{restoreMessage}</ThemedText>}

        <View style={styles.row}>
          <ThemedText style={styles.flex1}>Club notifications</ThemedText>
          <Switch value={pushEnabled} onValueChange={handlePushToggle} disabled={pushBusy} />
        </View>
        {pushMessage && (
          <ThemedText type="small" themeColor="textSecondary">
            {pushMessage}
          </ThemedText>
        )}

        <ThemedText type="small" themeColor="textSecondary">
          Weekly, Reel &amp; Page can look for a recurring theme in your saved quotes and suggest one reflective question, with your listening
          time and quotes saved for the week. This is a prompt for reflection, not therapy or professional advice.
        </ThemedText>
        <View style={styles.row}>
          <ThemedText style={styles.flex1}>Weekly reflection</ThemedText>
          <Switch value={reflectionEnabled} onValueChange={handleReflectionToggle} disabled={reflectionBusy} />
        </View>
        {!reflectionEnabled && reflections.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Turning this off deletes any saved reflections.
          </ThemedText>
        )}
        {reflectionEnabled &&
          reflections.map((r) => (
            <View key={r.id} style={[styles.message, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Week of {r.week_start} · {r.quotes_count} quotes · {r.total_minutes} min
              </ThemedText>
              {r.main_theme && <ThemedText type="small">Theme: {r.main_theme}</ThemedText>}
              {r.reflective_question && <ThemedText type="small">{r.reflective_question}</ThemedText>}
            </View>
          ))}

        {ownedClubMonths.length > 0 && (
          <>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Club months
            </ThemedText>
            <FlatList
              horizontal
              data={ownedClubMonths}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
              renderItem={({ item }) => (
                <Pressable style={styles.card} onPress={() => router.push("/club")}>
                  <View style={[styles.collectionPoster, { backgroundColor: "#3d3a52" }]}>
                    <ThemedText type="smallBold" style={styles.posterLabel}>
                      {item.title.title}
                    </ThemedText>
                  </View>
                </Pressable>
              )}
            />
          </>
        )}

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Owned commentaries
        </ThemedText>
        {ownedTitles.length === 0 && ownedCollections.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Nothing purchased yet.
          </ThemedText>
        ) : (
          <FlatList
            horizontal
            data={[...ownedCollections.map((c) => ({ collection: c })), ...ownedTitles.map((t) => ({ title: t }))]}
            keyExtractor={(item) => ("collection" in item ? item.collection.id : item.title.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            renderItem={({ item }) =>
              "collection" in item ? (
                <Pressable style={styles.card} onPress={() => router.push(`/titles/${item.collection.id}`)}>
                  <View style={[styles.collectionPoster, { backgroundColor: "#3d3a52" }]}>
                    <ThemedText type="smallBold" style={styles.posterLabel}>
                      {item.collection.name}
                    </ThemedText>
                  </View>
                </Pressable>
              ) : (
                <Pressable style={styles.card} onPress={() => router.push(`/titles/${item.title.id}`)}>
                  <PosterCard id={item.title.id} title={item.title.title} year={item.title.year} type={item.title.type} posterUrl={item.title.poster_url} />
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {item.title.creator}
                  </ThemedText>
                </Pressable>
              )
            }
          />
        )}

        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Continue listening
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
  message: {
    borderRadius: 8,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  flex1: {
    flex: 1,
  },
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
  collectionPoster: {
    aspectRatio: 2 / 3,
    borderRadius: 8,
    padding: 10,
    justifyContent: "flex-end",
  },
  posterLabel: {
    color: "#fff8f2",
  },
});
