import { useEffect, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getContinueListening,
  getHomeRails,
  type CollectionWithTitles,
  type ContinueListeningItem,
  type Title,
} from "@reel-and-page/shared";

import { PosterCard } from "@/components/catalog/poster-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

export default function HomeScreen() {
  const [freeToStart, setFreeToStart] = useState<Title[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<Title[]>([]);
  const [collections, setCollections] = useState<CollectionWithTitles[]>([]);
  const [continueListening, setContinueListening] = useState<ContinueListeningItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const rails = await getHomeRails(supabase);
        if (cancelled) return;
        setFreeToStart(rails.freeToStart);
        setRecentlyAdded(rails.recentlyAdded);
        setCollections(rails.collections);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function refreshContinueListening(signedIn: boolean) {
      setContinueListening(signedIn ? await getContinueListening(supabase, 10) : []);
    }
    supabase.auth.getUser().then(({ data }) => refreshContinueListening(!!data.user));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      refreshContinueListening(!!session?.user);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.brand}>
            Reel & Page
          </ThemedText>

          {loading ? (
            <ThemedText themeColor="textSecondary">Loading…</ThemedText>
          ) : (
            <>
              {continueListening.length > 0 && (
                <ContinueListeningRail items={continueListening} />
              )}
              <Rail title="Free to start" titles={freeToStart} />
              <CollectionRail collections={collections} />
              <Rail title="Recently added" titles={recentlyAdded} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ContinueListeningRail({ items }: { items: ContinueListeningItem[] }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        Continue listening
      </ThemedText>
      <FlatList
        horizontal
        data={items}
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
    </View>
  );
}

function Rail({ title, titles }: { title: string; titles: Title[] }) {
  if (titles.length === 0) return null;
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <FlatList
        horizontal
        data={titles}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/titles/${item.id}`)}>
            <PosterCard id={item.id} title={item.title} year={item.year} type={item.type} posterUrl={item.poster_url} />
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {item.creator}
            </ThemedText>
          </Pressable>
        )}
      />
    </View>
  );
}

function CollectionRail({ collections }: { collections: CollectionWithTitles[] }) {
  if (collections.length === 0) return null;
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        Collections
      </ThemedText>
      <FlatList
        horizontal
        data={collections}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={[styles.poster, { backgroundColor: "#3d3a52" }]}>
              <ThemedText type="small" style={styles.posterLabel}>
                {item.titles.length} episodes
              </ThemedText>
              <ThemedText type="smallBold" style={styles.posterLabel}>
                {item.name}
              </ThemedText>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.four,
  },
  brand: {
    fontSize: 28,
    marginTop: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 17,
  },
  rail: {
    gap: Spacing.three,
  },
  card: {
    width: 130,
    gap: Spacing.one,
  },
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: 8,
    padding: 10,
    justifyContent: "space-between",
  },
  posterLabel: {
    color: "#fff8f2",
  },
});
